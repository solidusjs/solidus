const DEFAULT_ENCODING = 'UTF8';

var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('underscore');
var workerFarm = require('worker-farm');

var workers;

var Preprocessor = function( preprocessor_path, options ){

	// properly inherit from EventEmitter part 1
	EventEmitter.call( this );

	var server = options.server;
	var logger = server.logger;
	var preprocessor = this;
	var data = this.data = '{}';
	this.path = preprocessor_path;

	// run preprocessor on supplied data
	this.process = function( context, callback ){

		workers( context, this.path, function( err, preprocessed_context ){
			if( err ){ 
				logger.log( 'Preprocessor Error:\n'+ err.stack, 0 );
				if( callback ) return callback( context );
			}
			if( callback ) return callback( preprocessed_context );
		});

	};

};

// properly inherit from EventEmitter part 2
util.inherits( Preprocessor, EventEmitter );

Preprocessor.setWorkers = function(){
	workers = workerFarm({
		maxCallsPerWorker: 100,
		maxConcurrentWorkers: 4,
		maxConcurrentCallsPerWorker: -1,
		maxCallTime: 1000
	}, require.resolve('./preprocessor_worker.js'));
};

// destroy and re-initialize worker farm
// this is used to update preprocessor modules in development
Preprocessor.resetWorkers = function(){
	workerFarm.end( workers );
	Preprocessor.setWorkers();
};

Preprocessor.setWorkers();

module.exports = Preprocessor;