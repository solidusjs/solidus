const DEFAULT_ENCODING = 'UTF8';
const DEFAULT_RESOURCE_TIMEOUT = 3500;

var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('underscore');
var async = require('async');
var request = require('request');

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
		route = route.replace( /{([a-z_-]*)}/ig, ':$1' ); // replace dynamic bits
		if( route === '' ) route = '/';
		page.route = route;

		// only overwrite existing routes if we're an index page
		var existing_route = _( router.routes.get ).find( function( route_data ){
			return route_data.path === route;
		});
		if( existing_route ){
			console.log('[SOLIDUS]'.red.bold +' Warning. You have a conflicting route at "'+ existing_route.path +'"' );
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
	this.parsePage = function( callback ){

		fs.readFile( this.path, DEFAULT_ENCODING, function( err, data ){

			var params = {};
			var params_exec = /^{{!\s([\S\s]+?)\s}}/.exec( data );
			try {
				params = ( params_exec )? JSON.parse( params_exec[1] ): {};
			}
			catch( err ){
				if( server.options.log_level >= 1 ) console.log('[SOLIDUS]'.red.bold +' Error preprocessing "'+ page.path +'"', err );
			}
			finally {
				page.params = params;
				_( page ).extend({
					title: params.title,
					description: params.description,
					name: params.name,
					layout: params.layout
				});
				if( callback ) callback( params );
			}

		});

	};

	// fetches remote resources
	this.fetchResources = function( resources, params, callback ){

		var resources_data = {};

		if( resources ){
			var resources_array = _( resources ).pairs();
			async.each( resources_array, function( resource, cb ){
				var resource_name = resource[0];
				var resource_url = resource[1];
				// replace variable strings like {this} in the resource url with url or query parameters
				resource_url = resource_url.replace( /\{([^\}]*)\}/ig, function( match, capture, index, str ){
					var replacement = params[capture] || '';
					return replacement;
				});
				request.get({
					url: resource_url,
					json: true,
					timeout: DEFAULT_RESOURCE_TIMEOUT,
					agent: false
				}, function( err, response, data ){
					if( err ){
						if( server.options.log_level >= 1 ) console.log('[SOLIDUS]'.red.bold +' Error retrieving resource "'+ resource_name +'":', err );
						return cb( err );
					} else if( 400 > response.statusCode && response.statusCode >= 200 ){
						resources_data[resource[0]] = data;
					} else {
						if( server.options.log_level >= 1 ) console.log('[SOLIDUS]'.red.bold +' Error retrieving resource "'+ resource_name +'":', response.statusCode );
					}
					cb();
				});
			}, function( err ){
				if( callback ) callback( err, resources_data );
			});
		}
		else {
			if( callback ) callback( resources_data );
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

		options = options || {};

		var context = {
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
			layout: ( this.layout || this.layout === false )? this.layout: this.getLayout()
		};
		context = _( context ).defaults( router.locals );

		// req.params is actually an array with crap stuck to it
		// so we have to parse that stuff out into a real object
		var parameters = {};
		for( var key in req.params ) parameters[key] = req.params[key];
		context.parameters = _( parameters ).extend( req.query );

		this.fetchResources( page.params.resources, context.parameters, function( err, resources ){
			context.resources = resources;
			page.preprocess( context, function( context ){
				if( options.json ) return res.json( context );
				res.expose( context, 'solidus.context', 'context' );
				res.render( page.relative_path, context );
			});
		});

	};

	// get the view's layout
	this.getLayout = function(){

		var layouts = _( server.layouts ).sortBy( function( layout_path ){
			return -layout_path.length;
		});
		var local_layout = _( layouts ).find( function( layout_path ){
			var layout_regex = new RegExp( layout_path.replace( /layout\..+$/i, '' ), 'i' );
			return layout_regex.test( page.path );
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
	this.parsePage( function(){
		page.emit( 'ready' );
	});

};

// properly inherit from EventEmitter part 2
util.inherits( Page, EventEmitter );

Page.layouts = {};

module.exports = Page;