const DEFAULT_ENCODING = 'UTF8';
const MODIFIED_ROUND_TIME = 1000 * 60 * 5; // 5 minutes
const EXPIRY_TIME = 1000 * 60 * 5; // 5 minutes

var url = require('url');
var fs = require('fs');
var path = require('path');
var util = require('util');
var http = require('http');
var EventEmitter = require('events').EventEmitter;

var _ = require('underscore');
var async = require('async');

var Resource = require('./resource.js');
var utils = require('./utils.js');

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
    route = utils.formatRouteForExpress(route);
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
  this.fetchResources = function( req, context, iterator, callback ){

    var page = this;

    if( page.params.resources ){
      // convert resources object into array
      var resources_array = _( page.params.resources ).map( function( options, name ){
        var resource = new Resource(server.resourceOptions(req, options), server.auth, context.parameters, server.logger);
        resource.name = name;
        return resource;
      });
      async.each( resources_array, function( resource, cb ){
        resource.get(function(err, resource_response) {
          if (err) {
            var status = err.status || 500;
            var error  = 'Resource error: ' + err.message;
            var is_optional = context.is_preview || resource.options.optional;

            // A page with a missing static resource is broken, not missing
            if (status == 404 && !resource.resource.dynamic) status = 500;

            if (status == 404) {
              server.logger.log(page.route + ' [' + resource.name + '] ' + error, 3);
            } else {
              server.logger.log(page.route + ' [' + resource.name + '] ' + error, is_optional ? 1 : 0);
              if (!is_optional) {
                page.logToSentry(error, {
                  error:    err,
                  resource: {name: resource.name, url: resource.resource.url},
                  response: resource_response ? {status: resource_response.status, body: resource_response.data} : null,
                  context:  _.omit(context, 'resources')
                });
              }
            }

            err = {status: status, error: error, message: err, resource: resource.name};
            cb(is_optional ? null : err);
          } else {
            iterator(resource, resource_response);
            cb();
          }
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

    if (preprocessor) {
      preprocessor.process(context, function(err, processed_context) {
        if (err) {
          var error = 'Preprocessor error: ' + (_.isString(err) ? err : err.message);
          var stack = err.stack ? ('\n' + err.stack) : '';

          server.logger.log(page.route + ' [' + preprocessor.relative_path + '] ' + error + stack, 0);
          page.logToSentry(error, {
            error:        err,
            preprocessor: preprocessor.relative_path,
            context:      context
          });

          callback({status: 500, error: error, message: stack.split('\n'), preprocessor: preprocessor.relative_path}, processed_context);
        } else if (_.isNumber(processed_context)) {
          var error   = 'Preprocessor error: status code ' + processed_context;
          var message = http.STATUS_CODES[processed_context];

          if (processed_context == 404) {
            server.logger.log(page.route + ' [' + preprocessor.relative_path + '] ' + error, 3);
          } else {
            server.logger.log(page.route + ' [' + preprocessor.relative_path + '] ' + error, 0);
            page.logToSentry(error, {
              error:        err,
              preprocessor: preprocessor.relative_path,
              context:      context
            });
          }

          callback({status: processed_context, error: error, message: message, preprocessor: preprocessor.relative_path}, context);
        } else if (_.isString(processed_context)) {
          callback({status: 302, redirect_url: processed_context}, context);
        } else if (_.isArray(processed_context) && processed_context.length === 2 && _.isNumber(processed_context[0]) && _.isString(processed_context[1])) {
          callback({status: processed_context[0], redirect_url: processed_context[1]}, context);
        } else if (!_.isObject(processed_context)) {
          var error   = 'Preprocessor error: invalid context returned';

          server.logger.log(page.route + ' [' + preprocessor.relative_path + '] ' + error, 0);
          page.logToSentry(error, {
            error:        err,
            preprocessor: preprocessor.relative_path,
            context:      context
          });

          callback({status: 500, error: error, preprocessor: preprocessor.relative_path}, context);
        } else {
          callback(null, processed_context);
        }
      });
    } else {
      callback(null, context);
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
      layout: this.getLayout(),
      is_preview: !!req.query.is_preview,
      no_cache: req.no_cache
    };
    context = _( context ).defaults( router.locals );

    // req.params is actually an array with crap stuck to it
    // so we have to parse that stuff out into a real object
    var parameters = {};
    for( var key in req.params ) parameters[key] = req.params[key];
    context.parameters = _( parameters ).extend( req.query );

    // actually render the page
    var renderPage = function(err, context) {
      var status = err ? err.status : 200;
      server.logger.log(page.route + ' [' + status + '] served in ' + (new Date - start_serve) +'ms', !err || status == 404 ? 3 : 0);

      res.status(status);
      res.set(server.responseCacheHeaders(req, {
        max_age: 60 * 5,
        expires: new Date(Date.now() + EXPIRY_TIME)
      }));

      if (err) {
        err.redirect_url ? res.redirect(status, err.redirect_url) : renderErrorPage(err, context);
      } else {
        renderSuccessPage(context);
      }
    };

    var renderErrorPage = function(err, context) {
      context = context || {};
      context.error = err;
      if (options.json) {
        res.json(context);
      } else if (server.views[server.paths.error]) {
        res.expose(context, 'solidus.context', 'context');
        res.render(server.paths.error, context);
      } else {
        res.send(err.status + ' ' + http.STATUS_CODES[err.status]);
      }
    }

    var renderSuccessPage = function(context) {
      context = context || {};
      context.helpers = server.site_helpers;
      if (options.json) {
        res.json(context);
      } else {
        res.expose(context, 'solidus.context', 'context');
        res.render(page.relative_path, context);
      }
    };

    var start_resources = new Date;
    this.fetchResources( req, context,
      function(resource, resource_response) {
        context.resources[resource.name] = resource_response.data;
      },
      function(err) {
        server.logger.log( page.route +' resources fetched in '+ ( new Date - start_resources ) +'ms', 3 );
        if (err) return renderPage(err, context);

        var start_preprocess = new Date;
        page.preprocess(context, function(err, context) {
          server.logger.log( page.route +' preprocessed in '+ ( new Date - start_preprocess ) +'ms', 3 );
          if (err && !context.is_preview) return renderPage(err, context);

          renderPage(null, context);
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

  this.logToSentry = function(err, extra) {
    if (server.raven_client) server.raven_client.captureError(err, {extra: extra});
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
