var SITE_DIR = '/site';

var fs = require('fs');
var path = require('path');
var express = require('express');
var router = express();
var findit = require('findit');
var walk = require('walk');

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
		res.render( relative_path );
	});

	next();

});

var express_handlebars = require('express3-handlebars');

router.engine( 'hbs', express_handlebars({
	extname: '.hbs',
	partialsDir: views_path
}));
router.set( 'view engine', 'hbs' );
router.set( 'views', views_path );

var assets_path = path.join( __dirname, SITE_DIR, 'assets' );

router.use( express.static( assets_path ) );
router.listen( 8080 );