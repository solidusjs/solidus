const DEFAULT_ENCODING = 'UTF8';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('underscore');

var Preprocessor = function( preprocessor_path, options ){

	// properly inherit from EventEmitter part 1
	EventEmitter.call( this );

	var server = options.server;
	var preprocessor = this;
	var data = this.data = '{}';
	this.path = preprocessor_path;

	// run preprocessor on supplied data
	this.process = function( context, callback ){

		var preprocessing_method = require( this.path );

		try {
			context = preprocessing_method( context );
		} catch( err ){
			server.logger.log('Error in preprocessor: '+ preprocessor.path +' '+ err, 0 );
		} finally {
			if( callback ) callback( context );
		}

	};

	// update the source of the preprocessor
	this.updateSource = function( callback ){

		fs.readFile( this.path, {
			encoding: DEFAULT_ENCODING
		}, function( err, data ){
			if( err ) throw err;
			preprocessor.source = data;
			if( callback ) callback();
		});

	};

	this.updateSource( function(){
		preprocessor.emit( 'ready' );
	});

};

// properly inherit from EventEmitter part 2
util.inherits( Preprocessor, EventEmitter );

module.exports = Preprocessor;