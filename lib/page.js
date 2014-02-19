const DEFAULT_ENCODING = 'UTF8';
const DEFAULT_RESOURCE_TIMEOUT = 3500;
const DEFAULT_PAGE_TIMEOUT = 5000;
const MAX_RESOURCES_CACHE = 50;
const MAX_RESOURCE_AGE = 1000 * 60; // 60 seconds
const MODIFIED_ROUND_TIME = 1000 * 60 * 5; // 5 minutes
const EXPIRY_TIME = 1000 * 60 * 5; // 5 minutes
const SUCCESSFUL_RESPONSE_CODES = [ 200 ]; // 200 OK

var url = require('url');
var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('underscore');
var async = require('async');
var hyperquest = require('hyperquest');
var lru = require('lru-cache');
var zlib = require('zlib');
var cache = lru({
	max: MAX_RESOURCES_CACHE,
	length: function( n ){ return 1 },
	maxAge: MAX_RESOURCE_AGE
});

// escape backslashes in path for use in regex
var escapePathForRegex = function( file_path ){
	return file_path.replace( /(\\)/g, '\\\\' );
};

// rounds datetime to nearest 5 minutes (in the past)
var getRoundedTime = function( datetime, round_by ){
	var remainder = datetime % round_by;
	var rounded_time = new Date( datetime - remainder );
	return rounded_time;
};

// checks if a string is a resource url
var isURL = function( string ){
	return /https?:\/\//.test( string );
};

var Page = function( page_path, options ){

	// properly inherit from EventEmitter part 1
	EventEmitter.call( this );

	var page = this;

	options = options || {};
	this.options = options;
	var server = this.options.server;
	var router = server.router;
	this.path = page_path;
	this.relative_path = path.relative( server.paths.views, page_path );

	// adds a route based on the page's path
	this.createRoute = function(){

		page.is_index = /index\.hbs$/i.test( this.relative_path );
		var route = this.relative_path.replace( /\.[a-z0-9]+$/i, '' ).replace( /\\/g, '/' );
		var route = '/'+ route;
		route = route.replace( '/index', '' ); // replace indexes with base routes
		route = route.replace( /{([a-z_-]*)}/ig, ':$1' ); // replace dynamic bits
		if( route === '' ) route = '/';
		page.route = route;

		// only overwrite existing routes if we're an index page
		var existing_route = _( router.routes.get ).find( function( route_data ){
			return route_data.path === route;
		});
		if( existing_route ){
			server.logger.log( 'Warning. You have a conflicting route at "'+ existing_route.path +'"', 0 );
			if( !page.is_index ) return route; // return out if this isn't an index
			router.routes.get = _( router.routes.get ).without( existing_route ); // ensure the old route is removed if this is an index
		}

		router.get( route +'.json', function( req, res ){
			page.render( req, res, {
				json: true
			});
		});

		router.get( route, function( req, res ){
			page.render( req, res );
		});

		return route;

	};

	// reads the json configuration inside the view
	this.parseConfig = function( callback ){

		var auth_options = server.auth;

		fs.readFile( this.path, DEFAULT_ENCODING, function( err, data ){

			var params = {};
			var params_exec = /^{{!\s([\S\s]+?)\s}}/.exec( data );
			try {
				params = ( params_exec )? JSON.parse( params_exec[1] ): {};
			}
			catch( err ){
				server.logger.log( 'Error preprocessing "'+ page.path +'" '+ err, 0 );
			}
			finally {
				// insert global resource data by name
				if( params.resources ){
					for( var name in params.resources ){
						// reassign string contents to url property
						if( _.isString( params.resources[name] ) ){
							params.resources[name] = {
								url: params.resources[name]
							}
						}
						// mixin global resource options
						if( auth_options ){
							_.each( auth_options, function( options, match ){
								var matcher = new RegExp( match, 'ig' );
								if( matcher.test( params.resources[name].url ) ){
									params.resources[name] = _.extend( params.resources[name], options );
								}
							});
						}
					}
				}
				page.params = params;
				_( page ).extend({
					title: params.title,
					description: params.description,
					name: params.name,
					layout: params.layout
				});
				if( callback ) callback( params );
			}

		});

	};

	// fetches remote resources
	this.fetchResources = function( resources, params, callback ){

		var page = this;
		var resources_data = {};

		if( resources ){
			// convert resources object into array
			var resources_array = _( resources ).map( function( data, name ){
				var resource = {
					name: name,
					data: data
				};
				return resource;
			});
			// loop through array to create new resources object
			async.each( resources_array, function( resource, cb ){
				page.fetchResource( resource.data, params, function( err, response ){
					if( err ){
						server.logger.log( 'Error retrieving resource "'+ resource.name +'": '+ err, 3 );
						return cb( err, null );
					}
					resources_data[resource.name] = response;
					return cb( null, response );
				});
			}, function( err ){
				if( callback ) callback( err, resources_data );
			});
		}
		else {
			if( callback ) callback( null, {} );
		}

	};

	// fetches a single resource and returns its contents
	this.fetchResource = function( resource_data, params, callback ){
		var resource_url = resource_data.url;
		if( !isURL( resource_url ) ) return callback( null, {} );
		// replace variable strings like {this} in the resource url with url or query parameters
		resource_url = resource_url.replace( /\{([^\}]*)\}/ig, function( match, capture, index, str ){
			var replacement = params[capture] || '';
			return replacement;
		});
		// mixin query params defined in resource config
		var url_bits = url.parse( resource_url, true );
		// loop through query params looking for dynamic bits
		var key;
		for( key in resource_data.query ){
			if( typeof resource_data.query[key] === 'string' ){
				resource_data.query[key] = resource_data.query[key].replace( /\{([^\}]*)\}/ig, function( match, capture, index, str ){
					var replacement = params[capture] || '';
					return replacement;
				});
			}
		}
		url_bits.query = _.defaults( url_bits.query, resource_data.query );
		delete url_bits.search; // this will confuse url.format if we leave it in
		var resource_url = url.format( url_bits );
		// attempt to get resource from cache
		var cached_resource = cache.get( resource_url );
		if( cached_resource ){
			server.logger.log( 'Resource recovered from cache: '+ resource_url, 3 );
			return callback( null, cached_resource );
		}

		// retrieve compressed resources if possible
		if ( !resource_data.headers ) resource_data.headers = {};
		if ( !resource_data.headers['Accept-Encoding'] ) resource_data.headers['Accept-Encoding'] = 'gzip,deflate';

		// fetch resource remotely
		hyperquest( resource_url, resource_data, function( err, res ){
			if( err ) return callback( err, null );

			var data = '';
			var response_stream = res;
			// log all resource requests
			server.logger.log( 'Requested resource: ['+ res.statusCode +'] '+ resource_url, 3 );

			if( res.headers['content-encoding'] == 'gzip' || res.headers['content-encoding'] == 'deflate' ) {
				response_stream = res.pipe( new zlib.Unzip() );
			}
			
			response_stream.on( 'data', function onData( chunk ){
				data += chunk;
			});
			response_stream.on( 'end', function onEnd(){
				var response;
				try {
					response = data.toString( DEFAULT_ENCODING );
					response = JSON.parse( response );
				} catch( err ){
					return callback( err, null );
				}
				// cache resource if it came back successful
				if( SUCCESSFUL_RESPONSE_CODES.indexOf( res.statusCode ) > -1 ){
					cache.set( resource_url, response );
				}
				return callback( null, response );
			});
		});
	};

	// preprocesses the page's context
	this.preprocess = function( context, callback ){

		var preprocessor = server.preprocessors[page.params.preprocessor];

		if( preprocessor ){
			preprocessor.process( context, function( processed_context ){
				if( callback ) callback( processed_context );
			});
		}
		else {
			if( callback ) callback( context );
		}

	};

	// generates the page's markup
	this.render = function( req, res, options ){

		if( server.options.log_level >= 2 ) var start_serve = new Date;
		options = options || {};
		// generate url data to be served in context
		var href = req.protocol +'://'+ req.get('host') + req.url;
		var url_data = url.parse( href );
		url_data = _.omit( url_data, 'auth', 'protocol', 'slashes' );
		url_data.origin = req.protocol +'//'+ url_data.host;

		var context = {
			url: url_data,
			page: {
				path: this.path,
				title: this.title,
				description: this.description,
				name: this.name
			},
			parameters: {},
			query: req.query,
			resources: {},
			assets: {
				scripts: '<script src="/compiled/scripts.js"></script>',
				styles: '<link rel="stylesheet" href="/compiled/styles.css" />'
			},
			layout: this.getLayout()
		};
		context = _( context ).defaults( router.locals );

		// req.params is actually an array with crap stuck to it
		// so we have to parse that stuff out into a real object
		var parameters = {};
		for( var key in req.params ) parameters[key] = req.params[key];
		context.parameters = _( parameters ).extend( req.query );

		// actually render the page
		// uses once so we can have a custom timeout for .render
		var renderPage = _.once( function( context ){
			context = context || {};
			if( !server.options.dev ){
				res.set({
					'Cache-Control': 'public, max-age='+ ( 60 * 5 ),
					'Expires': new Date( Date.now() + EXPIRY_TIME ).toUTCString(),
					'Last-Modified': getRoundedTime( Date.now(), MODIFIED_ROUND_TIME ).toUTCString()
				});
			}
			if( options.json ) return res.json( context );
			res.expose( context, 'solidus.context', 'context' );
			server.logger.log( page.route +' served in '+ ( new Date - start_serve ) +'ms', 3 );
			res.render( page.relative_path, context );
		});

		// render the page manually if our context isn't fast enough
		setTimeout( function(){
			renderPage( context )
		}, DEFAULT_PAGE_TIMEOUT );

		if( server.options.log_level >= 2 ) var start_resources = new Date;
		this.fetchResources( page.params.resources, context.parameters, function( err, resources ){
			server.logger.log( page.route +' resources fetched in '+ ( new Date - start_resources ) +'ms', 3 );
			context.resources = resources;
			if( server.options.log_level >= 2 ) var start_preprocess = new Date;
			page.preprocess( context, function( context ){
				server.logger.log( page.route +' preprocessed in '+ ( new Date - start_preprocess ) +'ms', 3 );
				renderPage( context );
			});
		});

	};

	// get the view's layout
	this.getLayout = function(){

		if( this.layout || this.layout === false ) return this.layout;
		var layouts = _( server.layouts ).sortBy( function( layout_path ){
			return -layout_path.length;
		});
		var local_layout = _( layouts ).find( function( layout_path ){
			var layout_dir = layout_path.replace( /layout\..+$/i, '' );
			return page.path.indexOf( layout_dir ) > -1;
		});
		if( !local_layout ) return null;
		local_layout = path.relative( server.paths.views, local_layout );
		return local_layout;

	};

	// removes the page's route
	this.destroy = function(){

		router.routes.get = _( router.routes.get ).reject( function( current_route ){
			return current_route.path === page.route;
		});
		
	};

	this.createRoute();
	this.parseConfig( function(){
		page.emit( 'ready' );
	});

};

// properly inherit from EventEmitter part 2
util.inherits( Page, EventEmitter );

Page.layouts = {};

module.exports = Page;