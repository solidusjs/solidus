var SITE_DIR = '/site';
var API_MOCK_DIR = '/api';
var DEFAULT_ENCODING = 'UTF8';

var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var async = require('async');
var express = require('express');
var router = express();
var walk = require('walk');
var request = require('request');

var views_path = path.join( __dirname, SITE_DIR, 'views' );
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
	router.get( route, function( req, res ){

		var context = {
			params: req.params,
			resources: {}
		};

		fs.readFile( absolute_path, DEFAULT_ENCODING, function( err, data ){

			var parameters = {};
			var parameters_exec = /^{{!\s([\S\s]+?)\s}}/.exec( data );
			var parameters = ( parameters_exec )? JSON.parse( parameters_exec[1] ): {};
			var resources = parameters.resources;
			var resources_data = {};

			if( resources ){
				var resources_array = _( resources ).pairs();
				async.each( resources_array, function( resource, callback ){
					request.get( resource[1], function( err, response, body ){
						if( err ) return callback( err );
						var data = JSON.parse(body);
						resources_data[resource[0]] = data;
						callback();
					});
				}, function( err ){
					context.params = req.params;
					context.resources = resources_data;
					console.log( context );
					res.render( relative_path, context );
				});
			}
			else {
				context.params = req.params;
				console.log( context );
				res.render( relative_path, context );
			}

		});

	});

	next();

});

var express_handlebars = require('express3-handlebars');
var express_handlebars_config = {
	extname: '.hbs',
	partialsDir: views_path,
	layoutsDir: views_path
};
if( fs.existsSync( path.join( views_path, 'layout.hbs' ) ) ) express_handlebars_config.defaultLayout = 'layout';

router.engine( 'hbs', express_handlebars( express_handlebars_config ));
router.set( 'view engine', 'hbs' );
router.set( 'views', views_path );

var assets_path = path.join( __dirname, SITE_DIR, 'assets' );
var api_mock_path = path.join( __dirname, API_MOCK_DIR );

router.use( express.static( assets_path ) );
router.use( '/api', express.static( api_mock_path ) );
router.listen( 8080 );