var DEFAULT_ENCODING = 'UTF8';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var _ = require('underscore');
var async = require('async');
var request = require('request');

var Page = function( page_path, options ){

	var page = this;

	options = options || {};
	this.options = options;
	var server = this.options.server;
	var router = server.router;
	this.path = page_path;
	this.relative_path = path.relative( server.paths.views, page_path );

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
				request.get({ url: resource_url, json: true }, function( err, response, data ){
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

	this.preprocessContext = function( context, preprocessor, callback ){

		if( preprocessor ){
			var preprocessor_path = path.join( server.paths.preprocessors, preprocessor );
			fs.readFile( preprocessor_path, DEFAULT_ENCODING, function( err, data ){
				try {
					vm.runInNewContext( data, { data: context }, preprocessor_path );
				}
				catch( err ){
					if( server.options.log_level >= 1 ) console.error( '[SOLIDUS]'.red.bold +' Error in preprocessor: '+ preprocessor_path, err );
				}
				finally {
					if( callback ) callback( context );
				}
			});
		}
		else {
			callback( context );
		}

	};

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
			query: {},
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
			page.preprocessContext( context, page.params.preprocessor, function( context ){
				if( options.json ) return res.json( context );
				res.expose( context, 'solidus.context', 'context' );
				var dir_to = path.dirname( page.relative_path.replace( /\.hbs$/i, '' ) );
				if( Page.layouts[dir_to] ) context.layout = path.join( dir_to, 'layout' );
				res.render( page.path, context );
			});
		});

	};

	this.destroy = function(){

		router.routes.get = _( router.routes.get ).reject( function( current_route ){
			return current_route.path === page.route;
		});

	};

	this.createRoute();
	this.parsePage();

};

Page.layouts = {};

module.exports = Page;