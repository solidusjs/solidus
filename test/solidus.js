var path = require('path');
var async = require('async');
var request = require('supertest');
var solidus = require('../solidus.js');

var site1_path = path.join( __dirname, 'fixtures', 'site1' );

describe( 'Solidus', function(){

	beforeEach( function( done ){
		process.chdir( site1_path );
		solidus.start({
			log_level: 0
		});
		// hack that will work until .start callback is complete
		setTimeout( done, 500 );
	});

	afterEach( function(){
		solidus.stop();
		process.chdir( __dirname );
	});

	it( 'Starts a new http server', function( done ){
		request( solidus.router )
			.get('/')
			.end( function( err, res ){
				if( err ) throw err;
				done();
			});
	});

	it( 'Creates routes based on the contents of /views', function( done ){
		var s_request = request( solidus.router );
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

	it( 'Serves assets in /assets', function( done ){
		var s_request = request( solidus.router );
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
		var s_request = request( solidus.router );
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

	});

	describe( 'development mode', function(){

		it( 'Updates routes when views change', function(){

		});

		it( 'Updates redirects when redirects.json changes', function(){

		});

	});

});