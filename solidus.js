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
var walk = require('walk');
var request = require('request');
var igneous = require('igneous');

var views_path = path.join( __dirname, SITE_DIR, 'views' );
var preprocessors_path = path.join( __dirname, SITE_DIR, 'preprocessors' );

var walker = walk.walk( views_path, {
	followLinks: false
});

// Walk through files and create routes
walker.on( 'file', function( root, stat, next ){

	var absolute_path = path.join( root, stat.name );
	var relative_path = path.relative( views_path, absolute_path );
	var path_bits = relative_path.split('.');
	var route = '/'+ path_bits[0];
	route = route.replace( '/index', '' ); // replace indexes with base routes
	route = route.replace( /{([a-z_-]*)}/ig, ':$1' ); // replace dynamic bits
	if( route === '' ) route = '/';
	var context = {
		parameters: {},
		resources: {}
	};

	var extractViewParameters = function( callback ){

		fs.readFile( absolute_path, DEFAULT_ENCODING, function( err, data ){

			var params = {};
			var params_exec = /^{{!\s([\S\s]+?)\s}}/.exec( data );
			params = ( params_exec )? JSON.parse( params_exec[1] ): {};

			if( callback ) callback( params );
			
		});

	};

	var fetchResources = function( resources, callback ){

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

	var preprocessContext = function( context, preprocessor ){

		if( preprocessor ){
			var preprocessor_path = path.join( preprocessors_path, preprocessor );
			delete require.cache[preprocessor_path];
			var preprocess = require( preprocessor_path );
			context = preprocess( context );
		}

		return context;

	};

	var renderView = function( req, res, options ){

		options = options || {};

		// req.params is actually an array with crap stuck to it
		// so we have to parse that stuff out into a real object
		var parameters = {};
		for( var key in req.params ) parameters[key] = req.params[key];
		context.parameters = parameters;

		extractViewParameters( function( parameters ){

			view_params = parameters;

			fetchResources( view_params.resources, function( resources ){
				context.resources = resources;
				context = preprocessContext( context, view_params.preprocessor );
				if( options.json ) return res.json( context );
				res.expose( context, 'solidus.context' );
				res.render( relative_path, context );
			});
			
		});

	};

	// serve up the normal page
	router.get( route, function( req, res ){

		renderView( req, res );

	});

	router.get( route +'.json', function( req, res ){

		renderView( req, res, {
			json: true
		});

	});

	next();

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

router.use( express.static( assets_path ) );
router.use( '/api', express.static( api_mock_path ) );
router.listen( 8080 );