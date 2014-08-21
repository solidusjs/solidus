const DEFAULT_ENCODING = 'UTF8';
const DEFAULT_PAGE_TIMEOUT = 5000;
const MODIFIED_ROUND_TIME = 1000 * 60 * 5; // 5 minutes
const EXPIRY_TIME = 1000 * 60 * 5; // 5 minutes

var url = require('url');
var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('underscore');
var async = require('async');

var CachedResource = require('./cached_resource.js');
var routing = require('./routing.js');

// rounds datetime to nearest 5 minutes (in the past)
var getRoundedTime = function( datetime, round_by ){
  var remainder = datetime % round_by;
  var rounded_time = new Date( datetime - remainder );
  return rounded_time;
};

var Page = function( page_path, options ){

  // properly inherit from EventEmitter part 1
  EventEmitter.call( this );

  var page = this;

  options = options || {};
  this.options = options;
  var server = this.options.server;
  var router = server.router;
  this.path = page_path;
  this.relative_path = path.relative( server.paths.views, page_path );

  // adds a route based on the page's path
  this.createRoute = function(){

    page.is_index = /index\.hbs$/i.test( this.relative_path );
    var route = this.relative_path.replace( /\.[a-z0-9]+$/i, '' ).replace( /\\/g, '/' );
    var route = '/'+ route;
    route = route.replace( '/index', '' ); // replace indexes with base routes
    route = routing.formatRouteForExpress(route);
    if( route === '' ) route = '/';
    page.route = route;

    // only overwrite existing routes if we're an index page
    var existing_route = _( router.routes.get ).find( function( route_data ){
      return route_data.path === route;
    });
    if( existing_route ){
      server.logger.log( 'Warning. You have a conflicting route at "'+ existing_route.path +'"', 0 );
      if( !page.is_index ) return route; // return out if this isn't an index
      router.routes.get = _( router.routes.get ).without( existing_route ); // ensure the old route is removed if this is an index
    }

    router.get( route +'.json', function( req, res ){
      page.render( req, res, {
        json: true
      });
    });

    router.get( route, function( req, res ){
      page.render( req, res );
    });

    return route;

  };

  // reads the json configuration inside the view
  this.parseConfig = function( callback ){

    fs.readFile( this.path, DEFAULT_ENCODING, function( err, data ){

      var params = {};
      var params_exec = /^\s*{{!\s*({[\S\s]+?})\s*}}/.exec( data );
      try {
        params = ( params_exec )? JSON.parse( params_exec[1] ): {};
      }
      catch( err ){
        server.logger.log( 'Error preprocessing "'+ page.path +'" '+ err, 0 );
      }
      params.resources = params.resources || {};

      page.partials = page.findPartials(data);

      page.params = params;
      _( page ).extend({
        title: params.title,
        description: params.description,
        name: params.name,
        layout: params.layout
      });
      if( callback ) callback( params );

    });

  };

  // finds the names of the partials used by the template
  this.findPartials = function(template) {
    var template_without_comments = template.replace(/{{!--[\s\S]*?--}}/g, '').replace(/{{![\s\S]*?}}/g, '');
    var partials = [];
    var partial_regex = /{{>\s*([^\s}]+)[\s\S]*?}}/g;
    var match;
    while (match = partial_regex.exec(template_without_comments)) {
      // Fix quoted strings
      var name = match[1].replace(/(^['"])|(["']$)/g, '').replace(/\\(['"])/, '$1');
      partials.push(name);
    }
    return _.uniq(partials);
  }

  this.allPartials = function() {
    var partials = {};
    _.each(page.partials, function(name) {
      var file_path  = server.pathFromPartialName(name);
      partials[name] = file_path;

      var partial = server.views[file_path];
      if (partial) {
        partials = _.extend(partials, partial.allPartials());
      }
    });
    return partials;
  };

  this.toObjectString = function(parent_file_path) {
    var root = path.dirname(parent_file_path);
    var preprocessor = server.preprocessors[page.params.preprocessor];
    var partials = page.allPartials();
    var properties = [];
    var template_options = [];

    if (!_.isEmpty(page.params.resources)) {
      properties.push('resources:' + JSON.stringify(page.params.resources));
    }

    if (preprocessor) {
      properties.push('preprocessor:require(' + JSON.stringify(path.relative(root, preprocessor.path)) + ')');
    }

    properties.push('template:require(' + JSON.stringify(path.relative(root, page.path)) + ')');

    if (!_.isEmpty(server.site_helpers)) {
      template_options.push('helpers:require(' + JSON.stringify(path.relative(root, server.paths.helpers)) + ')');
    }

    if (!_.isEmpty(partials)) {
      var requires = _.map(partials, function(file_path, name) {
        return JSON.stringify(name) + ':require(' + JSON.stringify(path.relative(root, file_path)) + ')';
      })
      template_options.push('partials:{' + requires.join(',') + '}');
    }

    if (!_.isEmpty(template_options)) {
      properties.push('template_options:{' + template_options.join(',') + '}');
    }

    return '{' + properties.join(',') + '}';
  };

  // fetches remote resources
  this.fetchResources = function( params, iterator, callback ){

    var page = this;

    if( page.params.resources ){
      // convert resources object into array
      var resources_array = _( page.params.resources ).map( function( options, name ){
        var resource = new CachedResource(options, server.auth, params, server.logger);
        resource.name = name;
        return resource;
      });
      async.each( resources_array, function( resource, cb ){
        resource.get(function(err, resource_response) {
          if( err ){
            server.logger.log( 'Error retrieving resource "'+ resource.name +'": '+ err, 3 );
          } else {
            iterator(resource, resource_response);
          }
          cb();
        });
      }, callback);
    }
    else {
      callback();
    }

  };

  // preprocesses the page's context
  this.preprocess = function( context, callback ){

    var preprocessor = server.preprocessors[page.params.preprocessor];

    if( preprocessor ){
      preprocessor.process( context, function( processed_context ){
        if( callback ) callback( processed_context );
      });
    }
    else {
      if( callback ) callback( context );
    }

  };

  // generates the page's markup
  this.render = function( req, res, options ){

    var start_serve = new Date;
    options = options || {};
    // generate url data to be served in context
    var href = req.protocol +'://'+ req.get('host') + req.url;
    var url_data = url.parse( href, true );
    url_data = _.pick( url_data, 'host', 'port', 'hostname', 'hash', 'search', 'query', 'pathname', 'path', 'href', 'protocol' );
    url_data.origin = url_data.protocol +'//'+ url_data.host;

    var context = {
      url: url_data,
      page: {
        path: this.path,
        title: this.title,
        description: this.description,
        name: this.name
      },
      parameters: {},
      query: req.query,
      resources: {},
      assets: {
        scripts: '<script src="/compiled/scripts.js"></script>',
        styles: '<link rel="stylesheet" href="/compiled/styles.css" />'
      },
      layout: this.getLayout()
    };
    context = _( context ).defaults( router.locals );

    // req.params is actually an array with crap stuck to it
    // so we have to parse that stuff out into a real object
    var parameters = {};
    for( var key in req.params ) parameters[key] = req.params[key];
    context.parameters = _( parameters ).extend( req.query );

    // actually render the page
    // uses once so we can have a custom timeout for .render
    var renderPage = _.once( function( context ){
      context = context || {};
      if( !server.options.dev ){
        res.set({
          'Cache-Control': 'public, max-age='+ ( 60 * 5 ),
          'Expires': new Date( Date.now() + EXPIRY_TIME ).toUTCString(),
          'Last-Modified': getRoundedTime( Date.now(), MODIFIED_ROUND_TIME ).toUTCString()
        });
      }
      context.helpers = server.site_helpers;
      if( options.json ) return res.json( context );
      res.expose( context, 'solidus.context', 'context' );
      server.logger.log( page.route +' served in '+ ( new Date - start_serve ) +'ms', 3 );
      res.render( page.relative_path, context );
    });

    // render the page manually if our context isn't fast enough
    setTimeout( function(){
      renderPage( context )
    }, DEFAULT_PAGE_TIMEOUT );

    var start_resources = new Date;
    this.fetchResources( context.parameters,
      function(resource, resource_response) {
        context.resources[resource.name] = resource_response.data;
      },
      function() {
        server.logger.log( page.route +' resources fetched in '+ ( new Date - start_resources ) +'ms', 3 );
        var start_preprocess = new Date;
        page.preprocess( context, function( context ){
          server.logger.log( page.route +' preprocessed in '+ ( new Date - start_preprocess ) +'ms', 3 );
          renderPage( context );
        });
      }
    );

  };

  // get the view's layout
  this.getLayout = function(){

    if( this.layout || this.layout === false ) return this.layout;
    var layouts = _( server.layouts ).sortBy( function( layout_path ){
      return -layout_path.length;
    });
    var local_layout = _( layouts ).find( function( layout_path ){
      var layout_dir = layout_path.replace( /layout\..+$/i, '' );
      return page.path.indexOf( layout_dir ) > -1;
    });
    if( !local_layout ) return null;
    local_layout = path.relative( server.paths.views, local_layout );
    return local_layout;

  };

  // removes the page's route
  this.destroy = function(){

    router.routes.get = _( router.routes.get ).reject( function( current_route ){
      return current_route.path === page.route;
    });

  };

  this.createRoute();
  this.parseConfig( function(){
    page.emit( 'ready' );
  });

};

// properly inherit from EventEmitter part 2
util.inherits( Page, EventEmitter );

Page.layouts = {};

module.exports = Page;
