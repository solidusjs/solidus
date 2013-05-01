var SITE_DIR = process.cwd();
var API_MOCK_DIR = '/api';
var DEFAULT_ENCODING = 'UTF8';
var DEFAULT_PORT = 8080;

var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var async = require('async');
var http = require('http');
var express = require('express');
var expose = require('express-expose');
var router = express();
var server = http.createServer( router );
var chokidar = require('chokidar');
var request = require('request');
var colors = require('colors');
var Page = require('./lib/page.js');

var views_path = path.join( SITE_DIR, 'views' );
var redirects_path = path.join( SITE_DIR, 'redirects.json' );
var preprocessors_path = path.join( SITE_DIR, 'preprocessors' );

var solidus = {};

// Start the solidus server
solidus.start = function( options ){

	var defaults = {
		port: DEFAULT_PORT,
		log_level: 1
	};
	solidus.options = options = _( options || {} ).defaults( defaults );

	this.setupPages();
	this.setupRedirects();
	this.setupServer({
		port: options.port
	});

};

// Set up page routes
solidus.setupPages = function(){

	// Loop through our views directory and create Page objects for each valid view
	var view_watcher = chokidar.watch( views_path, {
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
	view_watcher.on( 'add', function( file_path ){

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
	view_watcher.on( 'change', function( file_path ){

		var page = pages[file_path];
		if( page ) page.parsePage();

	});

	// Remove the page when its view is deleted
	view_watcher.on( 'unlink', function( file_path ){

		// remove this page or layout
		var path_to = path.relative( views_path, file_path );
		var dir_to = path.dirname( path_to );
		var name = path.basename( file_path, '.hbs' );
		if( name === 'layout' && dir_to !== '.' ){
			delete layouts[dir_to];
		}
		else {
			var page = pages[file_path];
			if( page ){
				page.destroy();
				delete pages[file_path];
			}
		}

	});

};

// Set up redirect routes
solidus.setupRedirects = function(){

	this.redirect_routes = [];

	var redirects_watcher = chokidar.watch( redirects_path, {
		persistent: true,
		ignored: /(^\.)|(\/\.)/
	});

	redirects_watcher.on( 'add', function( file_path ){

		fs.readFile( file_path, DEFAULT_ENCODING, function( err, data ){
			if( !data ) return;
			var redirects = JSON.parse( data );
			for( var i in redirects ) solidus.createRedirect( redirects[i] );
		});

	});

	redirects_watcher.on( 'change', function( file_path ){

		fs.readFile( file_path, DEFAULT_ENCODING, function( err, data ){
			if( !data ) return;
			var redirects = JSON.parse( data );
			solidus.clearRedirects();
			for( var i in redirects ) solidus.createRedirect( redirects[i] );
		});

	});

	redirects_watcher.on( 'unlink', function( file_path ){

		solidus.clearRedirects();

	});

};

solidus.createRedirect = function( redirect ){

	var status = 302;
	var route = path.normalize( redirect.from ).replace( /\\/g, '/' );
	if( redirect.start || redirect.end ){
		status = 302;
	}
	router.get( route, function( req, res ){
		res.redirect( status, redirect.to );
	});
	this.redirect_routes.push( route );

};

solidus.clearRedirects = function(){

	router.routes.get = _( router.routes.get ).reject( function( current_route ){
		var matching_route = solidus.redirect_routes.indexOf( current_route.path ) > -1;
		// probably shouldn't be doing this
		if( matching_route ) solidus.redirect_routes = _( solidus.redirect_routes ).without( current_route.path );
		return matching_route;
	});

};

// Setup the express server
solidus.setupServer = function( params ){

	params = params || {};

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

	server.listen( params.port );

	if( solidus.options.log_level >= 1 ) console.log( '[SOLIDUS]'.cyan.bold +' Server running on port '+ params.port );

};

// Stop the express server
solidus.stop = function(){

	server.close();	

};

module.exports = solidus;