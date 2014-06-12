const DEFAULT_ENCODING = 'UTF8';
const DEFAULT_VIEW_EXTENSION = 'hbs';
const DEFAULT_PORT = 8080;
const DEFAULT_LIVERELOAD_PORT = 35729;
const DEFAULT_DEV_ASSETS_MAX_AGE = 0;
const DEFAULT_PROD_ASSETS_MAX_AGE = 1000 * 60 * 60 * 24 * 365; // 1 year, in ms
const DEFAULT_DEV_LOG_LEVEL = 3;
const DEFAULT_PROD_LOG_LEVEL = 2;
const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_LEVEL = process.env.SENTRY_LEVEL;
const VERSION = require('../package.json').version;

// native
var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

// third party
var _ = require('underscore');
var async = require('async');
var http = require('http');
http.globalAgent.maxSockets = Infinity;
var https = require('https');
https.globalAgent.maxSockets = Infinity;
var express = require('express');
var expose = require('express-expose');
var Handlebars = require('handlebars');
var handlebars_helper = require('handlebars-helper');
handlebars_helper.help( Handlebars );
var express_handlebars = require('express3-handlebars');
var chokidar = require('chokidar');
var glob = require('glob');
var raven = require('raven');
var cls = require('continuation-local-storage');

// our party! \o/
var Page = require('./page.js');
var Preprocessor = require('./preprocessor.js');
var Redirect = require('./redirect.js');
var Logger = require('./logger.js');

// make the path into a Windows compatible path
var deGlobifyPath = function( file_path ){
  return file_path.replace( /(\/)/g, path.sep );
};

// escape backslashes in path for use in regex
var escapePathForRegex = function( file_path ){
  return file_path.replace( /(\\)/g, '\\\\' );
};

var SolidusServer = function( options ){

  // properly inherit from EventEmitter part 1
  EventEmitter.call( this );

  var solidus_server = this;

  // mix options and defaults
  options = options || {};
  var defaults = {
    port: DEFAULT_PORT,
    log_level: options.dev ? DEFAULT_DEV_LOG_LEVEL : DEFAULT_PROD_LOG_LEVEL,
    site_path: process.cwd(),
    assets_max_age: options.dev ? DEFAULT_DEV_ASSETS_MAX_AGE : DEFAULT_PROD_ASSETS_MAX_AGE,
    livereload_port: DEFAULT_LIVERELOAD_PORT
  };
  this.options = options = _( options ).defaults( defaults );

  // file paths
  var paths = this.paths = {
    site: options.site_path,
    views: path.join( options.site_path, 'views' ),
    auth: path.join( options.site_path, 'auth.json' ),
    redirects: path.join( options.site_path, 'redirects.js' ),
    preprocessors: path.join( options.site_path, 'preprocessors' ),
    assets: path.join( options.site_path, 'assets' ),
    notfound: path.join( options.site_path, 'views', '404.hbs' ),
    helpers: path.join( options.site_path, 'helpers.js' )
  };

  // set up collections
  var redirects = this.redirects = [];
  var views = this.views = {};
  var preprocessors = this.preprocessors = {};
  var layouts = this.layouts = [];
  var auth = this.auth = {};
  var site_helpers = this.site_helpers = {};

  this.session = cls.createNamespace('solidus');
  this.request_id = 0;

  // set up express server
  var router = this.router = express();
  var server = this.server = http.createServer( router );
  var hbs_config = {
    extname: '.hbs',
    partialsDir: paths.views,
    layoutsDir: paths.views,
    handlebars: Handlebars
  };
  if( fs.existsSync( path.join( paths.views, 'layout.hbs' ) ) ) hbs_config.defaultLayout = 'layout';
  var handlebars = this.handlebars = express_handlebars.create( hbs_config );
  router.engine( DEFAULT_VIEW_EXTENSION, handlebars.engine );
  router.set( 'view engine', DEFAULT_VIEW_EXTENSION );
  router.set( 'views', paths.views );
  router.use( express.compress() );
  router.use(function(req, res, next) {
    res.set({'X-Powered-By': 'Solidus/' + VERSION});
    return next();
  });
  router.use( express.static( paths.assets, {
    maxAge: options.assets_max_age
  }));
  router.use(function(req, res, next) {
    // Set unique id to current request, for logging purposes
    solidus_server.session.bindEmitter(req);
    solidus_server.session.bindEmitter(res);
    solidus_server.session.run(function() {
      solidus_server.session.set('request_id', solidus_server.request_id += 1);
      next();
    });
  });
  router.use( router.router );
  // log express errors to sentry
  // log uncaught exceptions to sentry and exit
  if( SENTRY_DSN ){
    router.use( raven.middleware.express( SENTRY_DSN ) );
    var raven_client = solidus_server.raven_client = new raven.Client( SENTRY_DSN );
    raven_client.patchGlobal( function(){
      process.exit(1);
    });
  }
  // catch-all middleware at the end of the stack for 404 handling
  router.use( function( req, res, next ){
    res.status( 404 );
    // it's cheaper to check this than to fs.exists the notfound path
    if( views[paths.notfound] ){
      res.render( paths.notfound );
    }
    else {
      res.send('404 Not Found');
    }
  });

  var locals = {
    dev: options.dev,
    development: options.dev
  };
  if( options.dev ){
    locals.livereload_port = options.livereload_port;
    locals.log_server_port = options.log_server_port;
  }
  router.locals(locals);

  // set up the logger
  this.logger = new Logger({
    level: options.log_level,
    session: this.session,
    dev: options.dev
  });

  var layout_regex = new RegExp( '\/layout\.hbs$', 'i' );

  // adds a new page
  // adds a new layout if the view is a layout
  this.addView = function( view_path, callback ){

    var path_to = path.relative( paths.views, view_path );
    var dir_to = path.dirname( path_to );
    var name = path.basename( view_path, '.'+ DEFAULT_VIEW_EXTENSION );
    if( name === 'layout' ) layouts.push( view_path );
    views[view_path] = new Page( view_path, {
      server: solidus_server
    });
    if( callback ) views[view_path].on( 'ready', callback );

  };

  // updates a view's configuration
  this.updateView = function( view_path ){

    views[view_path].parseConfig();

  };

  // removes a view and its route
  this.removeView = function( view_path ){

    views[view_path].destroy();
    delete views[view_path];
    if( layout_regex.test( view_path ) ) layouts = _( layouts ).without( view_path );

  };

  // creates pages for every view
  this.setupViews = function(){

    glob( paths.views +'/**/*.'+ DEFAULT_VIEW_EXTENSION, function( err, view_paths ){
      view_paths = view_paths.map( deGlobifyPath );
      async.each( view_paths, solidus_server.addView, function( err ){
        solidus_server.emit('ready');
      });
    });

  };

  // loads global auth
  this.setupAuth = function(){

    try {
      delete require.cache[require.resolve( paths.auth )];
      this.auth = require( paths.auth );
    } catch( err ){}

  };

  // removes all global auth
  this.clearAuth = function(){

    this.auth = {};

  };

  // creates redirect routes
  this.setupRedirects = function(){

    var redirects = this.redirects;

    try {
      // invalidate require() cache
      // this is necessary for updates in dev to work
      delete require.cache[require.resolve( paths.redirects )];
      var redirects_data = require( paths.redirects );
      for( var i in redirects_data ){
        redirects.push( new Redirect( redirects_data[i], {
          server: solidus_server
        }));
      }
    } catch( err ){}

  };

  // removes all redirects
  this.clearRedirects = function(){

    var redirects = this.redirects;
    for( var i in redirects ) redirects[i].destroy();
    redirects = [];

  };

  this.updateRedirects = function(){

    this.clearRedirects();
    this.setupRedirects();

  };

  // creates a new preprocessor object
  this.addPreprocessor = function( preprocessor_path ){

    var path_to = path.relative( paths.preprocessors, preprocessor_path );
    preprocessors[path_to] = new Preprocessor( preprocessor_path, {
      server: solidus_server
    });

  };

  // updates the source of a preprocessor
  this.updatePreprocessor = function( preprocessor_path ){

    Preprocessor.resetWorkers();

  };

  // removes an existing preprocessor object
  this.removePreprocessor = function( preprocessor_path ){

    var path_to = path.relative( paths.preprocessors, preprocessor_path );
    delete preprocessors[path_to];

  };

  // creates preprocessor objects
  this.setupPreprocessors = function(){

    glob( paths.preprocessors +'/**/*.js', function( err, preprocessor_paths ){
      preprocessor_paths = preprocessor_paths.map( deGlobifyPath );
      async.each( preprocessor_paths, solidus_server.addPreprocessor );
    });

  };

  this.setupSiteHelpers = function() {
    var site_helpers = {};

    if (fs.existsSync(paths.helpers)) {
      try {
        delete require.cache[require.resolve(paths.helpers)];
        site_helpers = require(paths.helpers);
      } catch (err) {
        return this.logger.log('Error: could not load ' + path.relative(paths.site, paths.helpers) + ': ' + err, 3);
      }
    }

    this.site_helpers = site_helpers;
  };

  // watches preprocessors dir and adds/removes when necessary
  this.watch = function(){

    var view_regex = new RegExp( escapePathForRegex( paths.views ) +'.+\.hbs', 'i' );
    var preprocessor_regex = new RegExp( escapePathForRegex( paths.preprocessors ) +'.+\.js', 'i' );
    var redirects_regex = new RegExp( escapePathForRegex( paths.redirects ), 'i' );
    var auth_regex = new RegExp( escapePathForRegex( paths.auth ), 'i' );
    var helpers_regex = new RegExp( escapePathForRegex( paths.helpers ), 'i' );

    var watcher = this.watcher = chokidar.watch( paths.site, {
      ignored: function( file_path ) {
        // Ignore hidden files and directories
        if( /[\/\\]\./.test( file_path ) ) return true;

        // Ignore /deploy and /node_modules
        var root = path.relative( paths.site, file_path ).split( /[\/\\]/ )[ 0 ];
        if( root == 'deploy' || root == 'node_modules' ) return true;

        return false;
      },
      ignoreInitial: true,
      interval: 1000
    });

    watcher.on( 'add', function( file_path ){
      if( view_regex.test( file_path ) ) solidus_server.addView( file_path );
      else if( preprocessor_regex.test( file_path ) ) solidus_server.addPreprocessor( file_path );
      else if( redirects_regex.test( file_path ) ) solidus_server.setupRedirects();
      else if( auth_regex.test( file_path ) ) solidus_server.setupAuth();
      else if( helpers_regex.test( file_path ) ) solidus_server.setupSiteHelpers();
    });
    watcher.on( 'unlink', function( file_path ){
      if( view_regex.test( file_path ) ) solidus_server.removeView( file_path );
      else if( preprocessor_regex.test( file_path ) ) solidus_server.removePreprocessor( file_path );
      else if( redirects_regex.test( file_path ) ) solidus_server.clearRedirects();
      else if( auth_regex.test( file_path ) ) solidus_server.clearAuth();
      else if( helpers_regex.test( file_path ) ) solidus_server.setupSiteHelpers();
    });
    watcher.on( 'change', function( file_path ){
      if( view_regex.test( file_path ) ) solidus_server.updateView( file_path );
      else if( preprocessor_regex.test( file_path ) ) solidus_server.updatePreprocessor( file_path );
      else if( redirects_regex.test( file_path ) ) solidus_server.updateRedirects();
      else if( auth_regex.test( file_path ) ) solidus_server.setupAuth();
      else if( helpers_regex.test( file_path ) ) solidus_server.setupSiteHelpers();
    });

  };

  // starts the http server
  this.start = function( params ){

    _.extend( this.options, params );
    if (params.log_level !== undefined && params.log_level !== null) this.logger.level = params.log_level;
    server.listen( params.port, function(){
      solidus_server.emit( 'listen', params.port );
      solidus_server.logger.log('Server ' + VERSION + ' running on port ' + params.port, 2);
    });

  };

  this.startLogServer = function() {
    this.logger.log_server = require('socket.io').listen(this.options.log_server_port);

    if (this.options.log_server_level !== undefined && this.options.log_server_level !== null) {
      this.logger.log_server_level = this.options.log_server_level;
    } else if (this.options.log_level !== undefined && this.options.log_level !== null) {
      this.logger.log_server_level = this.options.log_level;
    }

    this.logger.log('Log server running on port ' + this.options.log_server_port, 2);
  };

  // ends the http listener and stops the server
  this.stop = function(){

    server.close();
    if (this.watcher) this.watcher.close();
    if (this.logger.log_server) this.logger.log_server.engine.close();

  };

  // use "this" as "this" for all methods attached to "this"
  _( this ).bindAll( 'addView', 'updateView', 'removeView', 'setupRedirects', 'clearRedirects' );

  this.setupViews();
  this.setupAuth();
  this.setupRedirects();
  this.setupPreprocessors();
  this.setupSiteHelpers();

  if (options.log_server_port) {
    this.startLogServer();
  }

  if( options.dev ){
    this.watch();
  }

  this.start({
    port: options.port
  });

};

// properly inherit from EventEmitter part 2
util.inherits( SolidusServer, EventEmitter );

// export our module
module.exports = SolidusServer;