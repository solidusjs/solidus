const DEFAULT_ENCODING = 'UTF8';

var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('underscore');
var workerFarm = require('worker-farm');
var workers = workerFarm({
	maxCallsPerWorker: 100,
	maxConcurrentWorkers: 4,
	maxConcurrentCallsPerWorker: -1,
	maxCallTime: 3 * 1000
}, require.resolve('./preprocessor_worker.js'));
console.log('sup');
var Preprocessor = function( preprocessor_path, options ){

	// properly inherit from EventEmitter part 1
	EventEmitter.call( this );

	var server = options.server;
	var preprocessor = this;
	var data = this.data = '{}';
	this.path = preprocessor_path;

	// run preprocessor on supplied data
	this.process = function( context, callback ){

		workers( context, this.path, function( err, preprocessed_context ){
			if( err ){ 
				console.log( 'preprocessor error', err );
				if( callback ) return callback( context );
			}
			if( callback ) return callback( preprocessed_context );
		});

	};

	// update the source of the preprocessor
	this.updateSource = function( callback ){

		delete require.cache[this.path];
		callback();

	};

	this.updateSource( function(){
		preprocessor.emit( 'ready' );
	});

};

// properly inherit from EventEmitter part 2
util.inherits( Preprocessor, EventEmitter );

module.exports = Preprocessor;