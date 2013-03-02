var DEFAULT_ENCODING = 'UTF8';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var _ = require('underscore');
var async = require('async');
var request = require('request');
var handlebars = require('handlebars');
var config;

var Page = function( page_path, options ){

	var page = this;

	options = options || {};
	this.options = options;
	this.path = page_path;
	this.relative_path = path.relative( config.views_path, page_path );

	this.createRoute = function(){

		var router = config.router;
		page.is_index = /index\.hbs$/i.test( this.relative_path );
		var route = this.relative_path.replace( /\.[a-z0-9]+$/i, '' );
		var route = '/'+ route;
		route = route.replace( '/index', '' ); // replace indexes with base routes
		route = route.replace( /{([a-z_-]*)}/ig, ':$1' ); // replace dynamic bits
		if( route === '' ) route = '/';
		page.route = route;

		// Ensure we don't overwrite index routes
		var existing_index;

		for( var page_path in Page.pages ){
			var current_page = Page.pages[page_path];
			var routes_match = page.route === current_page.route;
			if( routes_match && current_page.is_index ) return existing_index = true;
		}

		if( !existing_index ){

			router.routes.get = _( router.routes.get ).reject( function( current_route ){
				return current_route.path === route;
			});

			router.get( route +'.json', function( req, res ){
				page.render( req, res, {
					json: true
				});
			});

			router.get( route, function( req, res ){
				page.render( req, res );
			});

		}
		else {
			page.route = null;
		}

		return route;

	};

	this.parsePage = function( callback ){

		fs.readFile( this.path, DEFAULT_ENCODING, function( err, data ){

			var params = {};
			var params_exec = /^{{!\s([\S\s]+?)\s}}/.exec( data );
			params = ( params_exec )? JSON.parse( params_exec[1] ): {};

			page.params = params;
			
			if( callback ) callback( params );

			//page.precompileClientTemplates( data );

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
			var preprocessor_path = path.join( config.preprocessors_path, preprocessor );
			fs.readFile( preprocessor_path, DEFAULT_ENCODING, function( err, data ){
				try {
					vm.runInNewContext( data, context, preprocessor_path );
				}
				catch( err ){
					console.error( 'Error in preprocessor: '+ preprocessor_path, err );
				}
			});
		}

		if( callback ) callback( context );

	};

	this.precompileClientTemplates = function( data ){

		var path_clean = this.relative_path.replace( /\.[a-z0-9]+$/i, '' );
		var name = path_clean.replace(/\\/g,'/').replace( /^\//, '' ).replace( /\/$/, '' );
		var compiled_hbs = handlebars.precompile( data );
		var processed = '';

		client_templates[name] = 'function( data ){ return Handlebars.template('+ compiled_hbs +')( data ); };';

	};

	this.render = function( req, res, options ){

		options = options || {};

		var context = {
			parameters: {},
			query: {},
			resources: {},
			templates: Page.templates_string
		};

		// req.params is actually an array with crap stuck to it
		// so we have to parse that stuff out into a real object
		var parameters = {};
		for( var key in req.params ) parameters[key] = req.params[key];
		context.parameters = parameters;

		this.fetchResources( page.params.resources, req.params, function( resources ){
			context.resources = resources;
			context = page.preprocessContext( context, page.params.preprocessor, function( context ){
				if( options.json ) return res.json( context );
				res.expose( context, 'solidus.context' );
				res.render( page.path, context );
			});
		});

	};

	this.destroy = function(){

		// find the route
		// delete it
		// remove from client templates

	};

	this.createRoute();
	this.parsePage();

};

Page.config = function( page_config ){
	config = page_config;
};

Page.pages = {};
Page.templates_string = '';

module.exports = Page;