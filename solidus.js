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
var redirects_path = path.join( SITE_DIR, 'redirects.json' );
var preprocessors_path = path.join( SITE_DIR, 'preprocessors' );

var solidus = {};

solidus.start = function( options ){

	var defaults = {
		port: DEFAULT_PORT
	};
	options = _( options ).defaults( defaults );

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

	// Watch our redirects file for changes
	var redirect_routes = [];

	var redirects_watcher = chokidar.watch( redirects_path, {
		persistent: true
	});

	var createRedirect = function( redirect ){
		var status = 302;
		var route = path.normalize( redirect.from ).replace( /\\/g, '/' );
		if( redirect.start || redirect.end ){
			status = 302;
		}
		router.get( route, function( req, res ){
			res.redirect( status, redirect.to );
		});
		redirect_routes.push( route );
	};

	var clearRedirects = function(){
		router.routes.get = _( router.routes.get ).reject( function( current_route ){
			var matching_route = redirect_routes.indexOf( current_route.path ) > -1;
			if( matching_route ) redirect_routes = _( redirect_routes ).without( current_route.path );
			if( matching_route ) console.log( current_route.path );
			return matching_route;
		});
	};

	redirects_watcher.on( 'add', function( file_path ){

		fs.readFile( file_path, DEFAULT_ENCODING, function( err, data ){
			if( !data ) return;
			var redirects = JSON.parse( data );
			for( var i in redirects ) createRedirect( redirects[i] );
		});

	});

	redirects_watcher.on( 'change', function( file_path ){

		fs.readFile( file_path, DEFAULT_ENCODING, function( err, data ){
			if( !data ) return;
			var redirects = JSON.parse( data );
			clearRedirects();
			for( var i in redirects ) createRedirect( redirects[i] );
		});

	});

	redirects_watcher.on( 'unlink', function( file_path ){

		clearRedirects();

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
	router.enable('verbose errors');
	router.set( 'view engine', 'hbs' );
	router.set( 'views', views_path );
	var assets_path = path.join( SITE_DIR, 'assets' );
	router.use( express.static( assets_path ) );
	router.use( router.router );
	router.use( function( req, res ){
		res.status( 404 );
		if( req.accepts('html') ){
			res.render('404');
		}
		else if( req.accepts('json') ){
			res.json({ error: 'Not Found'});
		}
	});
	router.listen( options.port );

	console.log( '[SOLIDUS]'.cyan.bold +' Server running on port '+ options.port );

};

module.exports = solidus;