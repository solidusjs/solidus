var solidus = require('../solidus.js');

describe( 'Solidus', function(){

	beforeEach( function(){
		solidus.start({
			log_level: 0
		});
	});

	afterEach( function(){
		solidus.stop();
	});

	it( 'Starts a new http server', function(){
		
	});

	it( 'Creates routes based on the contents of /views', function(){

	});

	it( 'Creates redirects based on the contents of redirects.json', function(){

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