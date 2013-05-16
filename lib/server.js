const DEFAULT_ENCODING = 'UTF8';
const DEFAULT_VIEW_EXTENSION = 'hbs';
const DEFAULT_PORT = 8080;

// native
var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

// third party
var _ = require('underscore');
var async = require('async');
var http = require('http');
var express = require('express');
var expose = require('express-expose');
var express_handlebars = require('express3-handlebars');
var chokidar = require('chokidar');
var request = require('request');
var colors = require('colors');
var fileset = require('fileset');

// our party! \o/
var Page = require('./page.js');
var Layout = require('./layout.js');
var Redirect = require('./redirect.js');

var SolidusServer = function( options ){

	// properly inherit from EventEmitter part 1
	EventEmitter.call( this );

	var solidus_server = this;

	// mix options and defaults
	var defaults = {
		port: DEFAULT_PORT,
		log_level: 1,
		site_path: process.cwd()
	};
	this.options = options = _( options || {} ).defaults( defaults );

	// file paths
	var paths = this.paths = {
		site: options.site_path,
		views: path.join( options.site_path, 'views' ),
		redirects: path.join( options.site_path, 'redirects.json' ),
		preprocessors: path.join( options.site_path, 'preprocessors' ),
		assets: path.join( options.site_path, 'assets' )
	};

	// set up express server
	var router = this.router = express();
	var server = this.server = http.createServer( router );
	var hbs_config = {
		extname: '.hbs',
		partialsDir: paths.views,
		layoutsDir: paths.views
	};
	if( fs.existsSync( path.join( paths.views, 'layout.hbs' ) ) ) hbs_config.defaultLayout = 'layout';
	var handlebars = this.handlebars = express_handlebars.create( hbs_config );
	router.engine( DEFAULT_VIEW_EXTENSION, handlebars.engine );
	router.set( 'view engine', DEFAULT_VIEW_EXTENSION );
	router.set( 'views', paths.views );
	router.use( express.static( paths.assets ) );

	// set up collections
	var redirects = this.redirects = [];
	var views = this.views = {};

	// creates pages for every view
	this.setupViews = function(){

		fileset( paths.views +'/**/*.'+ DEFAULT_VIEW_EXTENSION, '', function( err, view_paths ){
			async.each( view_paths, solidus_server.addView, function( err ){
				solidus_server.emit('ready');
			});
		});

	};

	// creates redirect routes
	this.setupRedirects = function(){

		var redirects = this.redirects;

		fs.readFile( paths.redirects, DEFAULT_ENCODING, function( err, data ){
			if( !data ) return;
			if( err ) throw err;
			solidus_server.clearRedirects();
			var redirects_json = JSON.parse( data );
			for( var i in redirects_json ){
				var redirect = new Redirect( redirects_json[i], {
					server: solidus_server
				});
				redirects.push( redirect );
			}
		});

	};

	// removes all redirects
	this.clearRedirects = function(){

		var redirects = this.redirects;
		for( var i in redirects ) redirects[i].destroy();
		redirects = [];

	};

	this.setupPreprocessors = function(){

	};

	// watches views for chagnes
	this.watchViews = function(){

		var watcher = chokidar.watch( paths.views, {
			ignored: /[^\.hbs|\/]$/i,
			ignoreInitial: true
		});

		watcher.on( 'add', function( view_path ){
			solidus_server.addView( view_path );
		});
		watcher.on( 'unlink', this.removeView );
		watcher.on( 'change', this.updateView );

	};

	// watches redirects file for changes
	this.watchRedirects = function(){

		var watcher = chokidar.watch( paths.site, {
			ignored: /^[^redirects\.json]$/i,
			ignoreInitial: true
		});

		watcher.on( 'add', this.setupRedirects );
		watcher.on( 'unlink', this.clearRedirects );
		watcher.on( 'change', this.setupRedirects );

	};

	// adds a new page
	// adds a new layout if the view is a layout
	this.addView = function( view_path, callback ){

		var path_to = path.relative( paths.views, view_path );
		var dir_to = path.dirname( path_to );
		var name = path.basename( view_path, '.'+ DEFAULT_VIEW_EXTENSION );
		if( name === 'layout' ) new Layout( view_path );
		views[view_path] = new Page( view_path, {
			server: solidus_server
		});
		if( callback ) views[view_path].on( 'ready', callback );

	};

	// updates a view's configuration
	this.updateView = function( view_path ){

		views[view_path].parsePage();

	};

	// removes a view and its route
	this.removeView = function( view_path ){

		views[view_path].destroy();
		delete views[view_path];

	};

	// starts the http server
	this.start = function( params ){

		var defaults = {
			port: DEFAULT_PORT
		};
		params = _( params || {} ).defaults( defaults );
		server.listen( params.port, function(){
			solidus_server.emit( 'listen', params.port );
			if( options.log_level >= 1 ) console.log( '[SOLIDUS]'.cyan.bold +' Server running on port '+ params.port );
		});

	};

	// ends the http listener and stops the server
	this.stop = function(){

		server.close();
		
	};

	// use "this" as "this" for all methods attached to "this"
	_( this ).bindAll( 'addView', 'updateView', 'removeView', 'setupRedirects', 'clearRedirects' );

	this.setupViews();
	this.setupRedirects();

	if( options.dev ){
		this.watchViews();
		this.watchRedirects();
	}

	this.start({
		port: options.port
	});

};

// properly inherit from EventEmitter part 2
util.inherits( SolidusServer, EventEmitter );

// export our module
module.exports = SolidusServer;