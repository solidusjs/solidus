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
	maxCallTime: 1000
}, require.resolve('./preprocessor_worker.js'));

var Preprocessor = function( preprocessor_path, options ){

	// properly inherit from EventEmitter part 1
	EventEmitter.call( this );

	var server = options.server;
	var logger = server.logger;
	var raven_client = server.raven_client;
	var preprocessor = this;
	var data = this.data = '{}';
	this.path = preprocessor_path;

	// run preprocessor on supplied data
	this.process = function( context, callback ){

		workers( context, this.path, function( err, preprocessed_context ){
			// preprocessor errors don't bubble up
			// so log them here
			if( err ){
				logger.log( 'Preprocessor Error:\n'+ err.stack, 0 );
				raven_client.captureError( err, {
					extra: {
						context: context
					}
				});
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