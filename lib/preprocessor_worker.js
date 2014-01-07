const TIMEOUT = 5 * 1000;

module.exports = function( context, preprocessor_path, cb ){

	var preprocess_timeout = setTimeout( function(){
		console.log('process committing suicide');
		process.exit();
	}, TIMEOUT );

	var error;
	try {
		var preprocessor = require( preprocessor_path );
		context = preprocessor( context );
	} catch( err ){
		error = err;
	} finally {
		clearTimeout( preprocess_timeout );
		if( error ) return cb( error, null );
		return cb( null, context );
	}

};