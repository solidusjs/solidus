const DEFAULT_ENCODING = 'UTF8';
const FILESYSTEM_DELAY = 1100;

var path = require('path');
var assert = require('assert');
var async = require('async');
var fs = require('fs');
var request = require('supertest');
var nock = require('nock');
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
			nock('https://hipster.sparkart.net')
				.get('/api/v1/resources/abcdefg/my-resource')
				.reply( 200, { test: true });
			nock('https://hipster.sparkart.net')
				.get('/api/v1/resources/zyxwvu/my-resource-2')
				.reply( 200, { test: true });
			nock('https://hipster.sparkart.net')
				.get('/api/v1/resources/qwerty/my-resource-3')
				.reply( 200, { test: true });
			nock('https://hipster.sparkart.net')
				.get('/api/v1/resources/qwerty/my-resource-')
				.reply( 200, { test: false });
			// hack that will work until .start callback is complete
			solidus_server.on( 'ready', done );
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
						.expect( 200 )
						.end( function( err, res ){
							assert( res.body.page.title === 'test' );
							assert( res.body.parameters );
							assert( res.body.query );
							callback( err );
						});
				},
				function( callback ){
					s_request.get('/layout.json?test=true')
						.expect( 'Content-Type', /json/ )
						.expect( 200 )
						.end( function( err, res ){
							assert( res.body.page );
							assert( res.body.parameters );
							assert( res.body.query.test );
							callback( err );
						});
				},
				function( callback ){
					s_request.get('/dynamic/1.json')
						.expect( 'Content-Type', /json/ )
						.expect( 200 )
						.end( function( err, res ){
							assert( res.body.page );
							assert( res.body.parameters.segment == '1' );
							assert( res.body.query );
							callback( err );
						});
				},
				function( callback ){
					s_request.get('/dynamic/2.json')
						.expect( 'Content-Type', /json/ )
						.expect( 200 )
						.end( function( err, res ){
							assert( res.body.page );
							assert( res.body.parameters.segment == '2' );
							assert( res.body.query );
							callback( err );
						});
				}
			], function( err, results ){
				if( err ) throw err;
				done();
			});
		});

		it( 'Fetches resources and adds them to the page context', function( done ){
			var s_request = request( solidus_server.router );
			async.parallel([
				function( callback ){
					s_request.get('/.json?resource_test=3')
						.expect( 'Content-Type', /json/ )
						.expect( 200 )
						.end( function( err, res ){
							assert( res.body.resources.test.test );
							assert( res.body.resources.test2.test );
							assert( res.body.resources.test3.test );
							callback( err );
						});
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
							assert( res.body.moment_test === '1995-12-25T00:00:00-08:00' );
							assert( res.body.xdate_test === 'Mon Dec 25 1995 00:00:00 GMT-0800 (PST)' );
							assert( res.body.underscore_test[0] === 'test' );
							assert( res.body.sugar_test === 'test' )
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
					s_request.get('/redirect1').expect( 301, callback );
				},
				function( callback ){
					s_request.get('/redirect2').expect( 302, callback );
				},
				function( callback ){
					s_request.get('/redirect3').expect( 404, callback );
				},
				function( callback ){
					s_request.get('/redirect4').expect( 404, callback );
				}
			], function( err, results ){
				if( err ) throw err;
				done();
			});
		});

		it( 'Sets the default layout', function(){
			assert( solidus_server.handlebars.defaultLayout === 'layout' );
		});

		it( 'Uses the layout closest to a page view', function( done ){	
			var s_request = request( solidus_server.router );
			async.parallel([
				function( callback ){
					s_request
						.get('/deeply/nested/page/using/a_layout.json')
						.expect( 200 )
						.end( function( err, res ){
							assert( res.body.layout === 'deeply/nested/layout.hbs' );
							callback( err );
						});
				},
				function( callback ){
					s_request
						.get('/deeply/nested/page.json')
						.expect( 200 )
						.end( function( err, res ){
							assert( res.body.layout === 'deeply/nested/layout.hbs' );
							callback( err );
						});
				}
			], function( err, results ){
				if( err ) throw err;
				done();
			});
		});

		it( 'Makes partials available even if they have the same name in different directories', function( done ){
			var s_request = request( solidus_server.router );
			async.parallel([
				function( callback ){
					s_request
						.get('/partial_holder/')
						.expect( 200 )
						.end( function( err, res ){
							assert( res.text == 'partial.hbs' );
							callback( err );
						});
				},
				function( callback ){
					s_request
						.get('/partial_holder2/')
						.expect( 200 )
						.end( function( err, res ){
							assert( res.text == 'deeply/partial.hbs' );
							callback( err );
						});
				}
			], function( err, results ){
				if( err ) throw err;
				done();
			});
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
			solidus_server.on( 'ready', function(){
				setTimeout( done, FILESYSTEM_DELAY );
			});
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
				s_request.get('/redirect1').expect( 301, function( err ){
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
				s_request.get('/redirect2').expect( 301, function( err ){
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

		var test_preprocessor_contents = 'context.test = true';

		it( 'Adds preprocessors when a preprocessor js file is added', function( done ){
			var s_request = request( solidus_server.router );
			fs.writeFileSync( 'preprocessors/test.js', test_preprocessor_contents, DEFAULT_ENCODING );
			setTimeout( function(){
				s_request.get('/test.json')
					.expect( 200 )
					.end( function( err, res ){
						if( err ) throw err;
						assert( res.body.test );
						done();
					});
			}, FILESYSTEM_DELAY );
		});

		var test_preprocessor_contents_2 = 'context.test2 = true';

		it( 'Updates preprocessors when their files change', function( done ){
			var s_request = request( solidus_server.router );
			fs.writeFileSync( 'preprocessors/test.js', test_preprocessor_contents_2, DEFAULT_ENCODING );
			setTimeout( function(){
				s_request.get('/test.json')
					.expect( 200 )
					.end( function( err, res ){
						if( err ) throw err;
						assert( res.body.test2 );
						done();
					});
			}, FILESYSTEM_DELAY );
		});

		it( 'Removes preprocessors when their file is removed', function( done ){
			fs.unlinkSync('preprocessors/test.js');
			var s_request = request( solidus_server.router );
			setTimeout( function(){
				s_request.get('/test.json')
					.expect( 200 )
					.end( function( err, res ){
						if( err ) throw err;
						assert( !res.body.test );
						done();
					});
			}, FILESYSTEM_DELAY );
		});

		it( 'Passes a "dev" and "development" variables to view context', function( done ){
			var s_request = request( solidus_server.router );
			s_request.get('/dev.json')
				.expect( 200 )
				.end( function( err, res ){
					if( err ) throw err;
					assert( res.body.dev );
					assert( res.body.development );
					done();
				});
		});

	});

});