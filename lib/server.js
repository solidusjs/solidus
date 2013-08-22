const DEFAULT_ENCODING = 'UTF8';
const DEFAULT_VIEW_EXTENSION = 'hbs';
const DEFAULT_PORT = 8080;

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
var express_handlebars = require('express3-handlebars');
var chokidar = require('chokidar');
var fileset = require('fileset');

// our party! \o/
var Page = require('./page.js');
var Preprocessor = require('./preprocessor.js');
var Redirect = require('./redirect.js');
var Logger = require('./logger.js');

var SolidusServer = function( options ){

	// properly inherit from EventEmitter part 1
	EventEmitter.call( this );

	var solidus_server = this;

	// mix options and defaults
	var defaults = {
		port: DEFAULT_PORT,
		log_level: 2,
		site_path: process.cwd()
	};
	this.options = options = _( options || {} ).defaults( defaults );

	// file paths
	var paths = this.paths = {
		site: options.site_path,
		views: path.join( options.site_path, 'views' ),
		redirects: path.join( options.site_path, 'redirects.json' ),
		preprocessors: path.join( options.site_path, 'preprocessors' ),
		assets: path.join( options.site_path, 'assets' )
	};

	// set up express server
	var router = this.router = express();
	var server = this.server = http.createServer( router );
	var hbs_config = {
		extname: '.hbs',
		partialsDir: paths.views,
		layoutsDir: paths.views
	};
	if( fs.existsSync( path.join( paths.views, 'layout.hbs' ) ) ) hbs_config.defaultLayout = 'layout';
	var handlebars = this.handlebars = express_handlebars.create( hbs_config );
	router.engine( DEFAULT_VIEW_EXTENSION, handlebars.engine );
	router.set( 'view engine', DEFAULT_VIEW_EXTENSION );
	router.set( 'views', paths.views );
	router.use( express.compress() );
	router.use( express.static( paths.assets, {
		maxAge: 1000 * 60 * 60
	}));
	router.locals({
		dev: options.dev,
		development: options.dev
	});

	// set up the logger
	this.logger = new Logger({
		level: options.log_level
	});

	// set up collections
	var redirects = this.redirects = [];
	var views = this.views = {};
	var preprocessors = this.preprocessors = {};
	var layouts = this.layouts = [];

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

		views[view_path].parsePage();

	};

	// removes a view and its route
	this.removeView = function( view_path ){

		views[view_path].destroy();
		delete views[view_path];
		if( layout_regex.test( view_path ) ) layouts = _( layouts ).without( view_path );

	};

	// creates pages for every view
	this.setupViews = function(){

		fileset( paths.views +'/**/*.'+ DEFAULT_VIEW_EXTENSION, '', function( err, view_paths ){
			async.each( view_paths, solidus_server.addView, function( err ){
				solidus_server.emit('ready');
			});
		});

	};

	// creates redirect routes
	this.setupRedirects = function(){

		var redirects = this.redirects;

		fs.readFile( paths.redirects, DEFAULT_ENCODING, function( err, data ){
			if( !data ) return;
			if( err ) throw err;
			solidus_server.clearRedirects();
			var redirects_json = JSON.parse( data );
			for( var i in redirects_json ){
				var redirect = new Redirect( redirects_json[i], {
					server: solidus_server
				});
				redirects.push( redirect );
			}
		});

	};

	// removes all redirects
	this.clearRedirects = function(){

		var redirects = this.redirects;
		for( var i in redirects ) redirects[i].destroy();
		redirects = [];

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

		var path_to = path.relative( paths.preprocessors, preprocessor_path );
		preprocessors[path_to].updateSource();

	};

	// removes an existing preprocessor object
	this.removePreprocessor = function( preprocessor_path ){

		var path_to = path.relative( paths.preprocessors, preprocessor_path );
		delete preprocessors[path_to];

	};

	// creates preprocessor objects
	this.setupPreprocessors = function(){

		fileset( paths.preprocessors +'/**/*.js', '', function( err, preprocessor_paths ){
			async.each( preprocessor_paths, solidus_server.addPreprocessor );
		});

	};

	// watches preprocessors dir and adds/removes when necessary
	this.watch = function(){

		var view_regex = new RegExp( paths.views +'.+\.hbs', 'i' );
		var preprocessor_regex = new RegExp( paths.preprocessors +'.+\.js', 'i' );
		var redirects_regex = new RegExp( paths.redirects, 'i' );

		var watcher = this.watcher = chokidar.watch( paths.site, {
			ignored: /^\./,
			ignoreInitial: true,
			interval: 1000
		});

		watcher.on( 'add', function( file_path ){
			if( view_regex.test( file_path ) ) solidus_server.addView( file_path );
			else if( preprocessor_regex.test( file_path ) ) solidus_server.addPreprocessor( file_path );
			else if( redirects_regex.test( file_path ) ) solidus_server.setupRedirects();
		});
		watcher.on( 'unlink', function( file_path ){
			if( view_regex.test( file_path ) ) solidus_server.removeView( file_path );
			else if( preprocessor_regex.test( file_path ) ) solidus_server.removePreprocessor( file_path );
			else if( redirects_regex.test( file_path ) ) solidus_server.clearRedirects();
		});
		watcher.on( 'change', function( file_path ){
			if( view_regex.test( file_path ) ) solidus_server.updateView( file_path );
			else if( preprocessor_regex.test( file_path ) ) solidus_server.updatePreprocessor( file_path );
			else if( redirects_regex.test( file_path ) ) solidus_server.setupRedirects();
		});

	};

	// starts the http server
	this.start = function( params ){

		_.extend( this.options, params );
		if( params.log_level ) this.logger.level = params.log_level;
		server.listen( params.port, function(){
			solidus_server.emit( 'listen', params.port );
			solidus_server.logger.log( 'Server running on port '+ params.port, 2 );
		});

	};

	// ends the http listener and stops the server
	this.stop = function(){

		server.close();
		if( this.watcher ) this.watcher.close();
		
	};

	// use "this" as "this" for all methods attached to "this"
	_( this ).bindAll( 'addView', 'updateView', 'removeView', 'setupRedirects', 'clearRedirects' );

	this.setupViews();
	this.setupRedirects();
	this.setupPreprocessors();

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