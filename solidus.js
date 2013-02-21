var SITE_DIR = '/site';
var API_MOCK_DIR = '/api';
var DEFAULT_ENCODING = 'UTF8';

var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var async = require('async');
var express = require('express');
var expose = require('express-expose');
var router = express();
var chokidar = require('chokidar');
var request = require('request');
var igneous = require('igneous');

var views_path = path.join( __dirname, SITE_DIR, 'views' );
var preprocessors_path = path.join( __dirname, SITE_DIR, 'preprocessors' );

var watcher = chokidar.watch( views_path, {
	persistent: true
});

var pages = {};

var Page = function( page_path, options ){

	var page = this;

	this.path = page_path;
	this.relative_path = path.relative( views_path, page_path );
	this.options = options || {};

	this.createRoute = function(){

		page.is_index = /index\.hbs$/i.test( this.relative_path );
		var route = this.relative_path.replace( /\.[a-z0-9]+$/i, '' );
		var route = '/'+ route;
		route = route.replace( '/index', '' ); // replace indexes with base routes
		route = route.replace( /{([a-z_-]*)}/ig, ':$1' ); // replace dynamic bits
		if( route === '' ) route = '/';
		page.route = route;

		// Ensure we don't overwrite index routes
		var existing_index;

		for( var page_path in pages ){
			var current_page = pages[page_path];
			var routes_match = page.route === current_page.route;
			if( routes_match && current_page.is_index ) return existing_index = true;
		}

		if( !existing_index ){

			router.routes.get = _( router.routes.get ).reject( function( current_route ){
				console.log( route === current_route.path );
				return current_route.path === route;
			});

			router.get( route, function( req, res ){
				page.render( req, res );
			});

			router.get( route +'.json', function( req, res ){
				page.render( req, res, {
					json: true
				});
			});

		}
		else {
			page.route = null;
		}
console.log( _( router.routes.get ).pluck('path') );
		return route;

	};

	this.parsePage = function( callback ){

		fs.readFile( this.path, DEFAULT_ENCODING, function( err, data ){

			var params = {};
			var params_exec = /^{{!\s([\S\s]+?)\s}}/.exec( data );
			params = ( params_exec )? JSON.parse( params_exec[1] ): {};

			page.params = params;
			
			if( callback ) callback( params );

		});

	};

	this.fetchResources = function( resources, callback ){

		var resources_data = {};

		if( resources ){
			var resources_array = _( resources ).pairs();
			async.each( resources_array, function( resource, cb ){
				request.get( resource[1], function( err, response, body ){
					if( err ) return cb( err );
					var data = JSON.parse(body);
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

	this.preprocessContext = function( context, preprocessor ){

		if( preprocessor ){
			var preprocessor_path = path.join( preprocessors_path, preprocessor );
			delete require.cache[preprocessor_path];
			var preprocess = require( preprocessor_path );
			context = preprocess( context );
		}

		return context;

	};

	this.render = function( req, res, options ){

		options = options || {};

		var context = {
			parameters: {},
			query: {},
			resources: {}
		};

		// req.params is actually an array with crap stuck to it
		// so we have to parse that stuff out into a real object
		var parameters = {};
		for( var key in req.params ) parameters[key] = req.params[key];
		context.parameters = parameters;

		this.fetchResources( page.params.resources, function( resources ){
			context.resources = resources;
			context = page.preprocessContext( context, page.params.preprocessor );
			if( options.json ) return res.json( context );
			res.expose( context, 'solidus.context' );
			res.render( page.path, context );
		});

	};

	this.destroy = function(){

		// find the route
		// delete it

	};

	this.createRoute();
	this.parsePage();

};

watcher.on( 'add', function( path ){

	var page = new Page( path );
	pages[path] = page;

});

watcher.on( 'remove', function( path ){

	// remove this page

	pages[path].destroy();
	delete pages[path];

});

var igneous_middleware = igneous({
	root: path.join( __dirname, SITE_DIR ),
	minify: false,
	flows: [{
		route: 'templates.js',
		type: 'jst',
		extensions: ['hbs'],
		base: '/views',
		paths: ['/'],
		jst_lang: 'handlebars',
		jst_namespace: 'templates'
	}]
});

router.use( igneous_middleware );

var express_handlebars = require('express3-handlebars');
var express_handlebars_config = {
	extname: '.hbs',
	partialsDir: views_path,
	layoutsDir: views_path
};
if( fs.existsSync( path.join( views_path, 'layout.hbs' ) ) ) express_handlebars_config.defaultLayout = 'layout';
var handlebars = express_handlebars.create( express_handlebars_config );

router.engine( 'hbs', handlebars.engine );
router.set( 'view engine', 'hbs' );
router.set( 'views', views_path );

var assets_path = path.join( __dirname, SITE_DIR, 'assets' );
var api_mock_path = path.join( __dirname, API_MOCK_DIR );

//router.use( express.static( assets_path ) );
router.use( '/api', express.static( api_mock_path ) );
router.listen( 8080 );