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
					permanent_name: params.permanent_name
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
				var resource_url = resource[1];
				for( var param in params ){
					var value = params[param];
					resource_url = resource_url.replace( '{'+ param +'}', value );
				}
				request.get({
					url: resource_url,
					json: true,
					timeout: DEFAULT_RESOURCE_TIMEOUT
				}, function( err, response, data ){
					if( err ) return cb( err );
					resources_data[resource[0]] = data;
					cb();
				});
			}, function( err ){
				if( callback ) callback( resources_data );
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
				permanent_name: this.permanent_name
			},
			parameters: {},
			query: req.query,
			resources: {},
			assets: {
				scripts: '<script src="/compiled/scripts.js"></script>',
				styles: '<link rel="stylesheet" href="/compiled/styles.css" />'
			}
		};

		// req.params is actually an array with crap stuck to it
		// so we have to parse that stuff out into a real object
		var parameters = {};
		for( var key in req.params ) parameters[key] = req.params[key];
		context.parameters = parameters;

		this.fetchResources( page.params.resources, req.params, function( resources ){
			context.resources = resources;
			page.preprocess( context, function( context ){
				if( options.json ) return res.json( context );
				res.expose( context, 'solidus.context', 'context' );
				var dir_to = path.dirname( page.relative_path.replace( /\.hbs$/i, '' ) );
				if( Page.layouts[dir_to] ) context.layout = path.join( dir_to, 'layout' );
				res.render( page.path, context );
			});
		});

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