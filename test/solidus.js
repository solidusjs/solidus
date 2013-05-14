const DEFAULT_ENCODING = 'UTF8';
const FILESYSTEM_DELAY = 500;

var path = require('path');
var assert = require('assert');
var async = require('async');
var fs = require('fs');
var request = require('supertest');
var solidus = require('../solidus.js');

var original_path = __dirname;
var site1_path = path.join( original_path, 'fixtures', 'site1' );
var site2_path = path.join( original_path, 'fixtures', 'site2' );

describe( 'Solidus', function(){

	describe( 'production', function(){

		var solidus_server;

		beforeEach( function( done ){
			process.chdir( site1_path );
			solidus_server = solidus.start({
				log_level: 0,
				port: 9009
			});
			// hack that will work until .start callback is complete
			setTimeout( done, FILESYSTEM_DELAY );
		});

		afterEach( function(){
			solidus_server.stop();
			process.chdir( original_path );
		});

		it( 'Starts a new http server', function( done ){
			request( solidus_server.router )
				.get('/')
				.end( function( err, res ){
					if( err ) throw err;
					done();
				});
		});

		it( 'Creates routes based on the contents of /views', function( done ){
			var s_request = request( solidus_server.router );
			async.parallel([
				function( callback ){
					s_request.get('/').expect( 200, callback );
				},
				function( callback ){
					s_request.get('/layout').expect( 200, callback );
				}
			], function( err, results ){
				if( err ) throw err;
				done();
			});
		});

		it( 'Creates routes with dynamic segments', function( done ){
			var s_request = request( solidus_server.router );
			async.parallel([
				function( callback ){
					s_request.get('/dynamic/1').expect( 200, callback );
				},
				function( callback ){
					s_request.get('/dynamic/2').expect( 200, callback );
				}
			], function( err, results ){
				if( err ) throw err;
				done();
			});
		});

		it( 'Creates routes for page contexts', function( done ){
			var s_request = request( solidus_server.router );
			async.parallel([
				function( callback ){
					s_request.get('/.json')
						.expect( 'Content-Type', /json/ )
						.expect( 200, callback );
				},
				function( callback ){
					s_request.get('/layout.json')
						.expect( 'Content-Type', /json/ )
						.expect( 200, callback );
				},
				function( callback ){
					s_request.get('/dynamic/1.json')
						.expect( 'Content-Type', /json/ )
						.expect( 200, callback );
				},
				function( callback ){
					s_request.get('/dynamic/2.json')
						.expect( 'Content-Type', /json/ )
						.expect( 200, callback );
				}
			], function( err, results ){
				if( err ) throw err;
				done();
			});
		});

		it( 'Preprocesses the context of pages', function( done ){
			var s_request = request( solidus_server.router );
			async.parallel([
				function( callback ){
					s_request.get('/.json')
						.expect( 'Content-Type', /json/ )
						.expect( 200 )
						.end( function( err, res ){
							assert( res.body.test === true );
							callback( err );
						});
				}
			], function( err, results ){
				if( err ) throw err;
				done();
			});
		});

		it( 'Serves assets in /assets', function( done ){
			var s_request = request( solidus_server.router );
			async.parallel([
				function( callback ){
					s_request.get('/scripts/test.js').expect( 200, callback );
				},
				function( callback ){
					s_request.get('/styles/test.css').expect( 200, callback );
				}
			], function( err, results ){
				if( err ) throw err;
				done();
			});
		});

		it( 'Creates redirects based on the contents of redirects.json', function( done ){
			var s_request = request( solidus_server.router );
			async.parallel([
				function( callback ){
					s_request.get('/redirect1').expect( 302, callback );
				},
				function( callback ){
					s_request.get('/redirect2').expect( 302, callback );
				}
			], function( err, results ){
				if( err ) throw err;
				done();
			});
		});

		it( 'Sets the default layout', function(){
			assert( solidus_server.handlebars.defaultLayout === 'layout' );
		});

	});

	describe( 'development', function(){

		var solidus_server;

		beforeEach( function( done ){
			process.chdir( site2_path );
			solidus_server = solidus.start({
				log_level: 0,
				port: 9009,
				dev: true
			});
			// hack that will work until .start callback is complete
			setTimeout( done, FILESYSTEM_DELAY );
		});

		afterEach( function(){
			solidus_server.stop();
			process.chdir( original_path );
		});

		it( 'Adds a route when a new view is added', function( done ){
			fs.writeFileSync( 'views/watch_test.hbs', 'test', DEFAULT_ENCODING );
			var s_request = request( solidus_server.router );
			setTimeout( function(){
				s_request.get('/watch_test').expect( 200, function( err ){
					if( err ) throw err;
					done();
				});
			}, FILESYSTEM_DELAY );
		});

		it( 'Removes a route when a view is removed', function( done ){
			fs.unlinkSync('views/watch_test.hbs');
			var s_request = request( solidus_server.router );
			setTimeout( function(){
				s_request.get('/watch_test').expect( 404, function( err ){
					if( err ) throw err;
					done();
				});
			}, FILESYSTEM_DELAY );
		});

		var redirects = [{
			"from": "/redirect1",
			"to": "/"
		}];

		it( 'Adds redirects when redirects.json is added', function( done ){
			var s_request = request( solidus_server.router );
			var redirects_json = JSON.stringify( redirects );
			fs.writeFileSync( 'redirects.json', redirects_json, DEFAULT_ENCODING );
			setTimeout( function(){
				s_request.get('/redirect1').expect( 302, function( err ){
					if( err ) throw err;
					done();
				});
			}, FILESYSTEM_DELAY );
		});

		it( 'Updates redirects when redirects.json changes', function( done ){
			var s_request = request( solidus_server.router );
			redirects.push({
				from: '/redirect2',
				to: '/'
			});
			var redirects_json = JSON.stringify( redirects );
			fs.writeFileSync( 'redirects.json', redirects_json, DEFAULT_ENCODING );
			setTimeout( function(){
				s_request.get('/redirect2').expect( 302, function( err ){
					if( err ) throw err;
					done();
				});
			}, FILESYSTEM_DELAY );
		});

		it( 'Removes redirects when redirects.json is deleted', function( done ){
			var s_request = request( solidus_server.router );
			fs.unlinkSync('redirects.json');
			setTimeout( function(){
				s_request.get('/redirect1').expect( 404, function( err ){
					if( err ) throw err;
					done();
				});
			}, FILESYSTEM_DELAY );
		});

	});

});