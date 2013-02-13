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

walker.on( 'file', function( root, stat, next ){

	var absolute_path = path.join( root, stat.name );
	var relative_path = path.relative( views_path, absolute_path );
	var path_bits = relative_path.split('.');
	var route = '/'+ path_bits[0];

	route = route.replace( '/index', '/' ); // replace indexes with base routes
	route = route.replace( /{([a-z_-]*)}/ig, ':$1' ); // replace dynamic bits
	router.get( route, function( req, res ){
		res.send( relative_path );
	});

	next();

});

router.listen( 8080 );