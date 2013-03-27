var SITE_DIR = process.cwd();
var API_MOCK_DIR = '/api';
var DEFAULT_ENCODING = 'UTF8';
var DEFAULT_PORT = 8080;

var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var async = require('async');
var express = require('express');
var expose = require('express-expose');
var router = express();
var chokidar = require('chokidar');
var request = require('request');
var colors = require('colors');
var Page = require('./lib/page.js');

var views_path = path.join( SITE_DIR, 'views' );
var preprocessors_path = path.join( SITE_DIR, 'preprocessors' );

var solidus = {};

solidus.start = function( options ){

	var defaults = {
		port: DEFAULT_PORT
	};
	options = _( options ).defaults( defaults );

	// Loop through our views directory and create Page objects for each valid view
	var watcher = chokidar.watch( views_path, {
		persistent: true,
		ignored: /(^\.)|(\/\.)/
	});

	Page.config({
		router: router,
		views_path: views_path,
		preprocessors_path: preprocessors_path
	});
	var pages = Page.pages;
	var layouts = Page.layouts;

	// Add a new Page any time a file is added to the views path
	watcher.on( 'add', function( file_path ){

		var path_to = path.relative( views_path, file_path );
		var dir_to = path.dirname( path_to );
		var name = path.basename( file_path, '.hbs' );
		if( name === 'layout' && dir_to !== '.' ){
			layouts[dir_to] = true;
		}
		else {
			var page = new Page( file_path );
		}

	});

	// Update the Page when the view's contents are modified
	watcher.on( 'change', function( file_path ){

		var page = pages[file_path];
		if( page ) page.parsePage();

	});

	// Remove the page when its view is deleted
	watcher.on( 'remove', function( file_path ){

		// remove this page or layout
		var path_to = path.relative( views_path, file_path );
		var dir_to = path.dirname( path_to );
		var name = path.basename( file_path, '.hbs' );
		if( name === 'layout' && dir_to !== '.' ){
			delete layouts[dir_to];
		}
		else {
			pages[file_path].destroy();
			delete pages[file_path];
		}

	});

	// Set up Express server
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
	var assets_path = path.join( SITE_DIR, 'assets' );
	router.use( express.static( assets_path ) );

	// Set up redirects
	fs.readFile( 'redirects.json', 'UTF8', function( err, data ){
		var redirects = JSON.parse( data );
		for( var i in redirects ){
			router.get( redirects[i].from, function( req, res ){
				res.redirect( redirects[i].to );
			});
		}
	});

	router.listen( options.port );

	console.log( '[SOLIDUS]'.cyan.bold +' Server running on port '+ options.port );

};

module.exports = solidus;