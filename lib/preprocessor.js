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

		context = this.module( context );
		if( callback ) callback( context );

	};

	// update the source of the preprocessor
	this.updateSource = function( callback ){

		delete require.cache[this.path];
		this.module = require( this.path );
		callback();

	};

	this.updateSource( function(){
		preprocessor.emit( 'ready' );
	});

};

// properly inherit from EventEmitter part 2
util.inherits( Preprocessor, EventEmitter );

module.exports = Preprocessor;