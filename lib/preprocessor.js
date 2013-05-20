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

	var preprocessor = this;
	var data = this.data = '{}';
	this.path = preprocessor_path;

	// run preprocessor on supplied data
	this.process = function( context, callback ){

		var sandbox = {
			_: require('underscore'),
			XDate: require('xdate'),
			moment: require('moment'),
			context: context
		};

		// hack to get sugar in there for it's only user (Eric)
		var sugar_string = fs.readFileSync( path.join( __dirname, '../node_modules/sugar/release/sugar-full.development.js' ), DEFAULT_ENCODING );

		vm.runInNewContext( sugar_string + preprocessor.source, sandbox, 'preprocessor.pre' );
		
		if( callback ) callback( context );

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