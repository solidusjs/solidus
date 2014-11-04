const DEFAULT_ENCODING = 'UTF8';

var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var workerFarm = require('worker-farm');

var workers;

var Preprocessor = function( preprocessor_path, options ){

  // properly inherit from EventEmitter part 1
  EventEmitter.call( this );

  var server = options.server;
  var preprocessor = this;
  var data = this.data = '{}';
  this.path = preprocessor_path;
  this.relative_path = path.relative(server.paths.preprocessors, preprocessor_path);

  // run preprocessor on supplied data
  this.process = function( context, callback ){

    workers( context, this.path, server.session.bind(function( err, preprocessed_context ){
      if( err ){
        if (callback) return callback(err, context);
      }
      if (callback) return callback(null, preprocessed_context);
    }));

  };

};

// properly inherit from EventEmitter part 2
util.inherits( Preprocessor, EventEmitter );

Preprocessor.setWorkers = function(){
  workers = workerFarm({
    maxCallsPerWorker: 100,
    maxConcurrentWorkers: 4,
    maxConcurrentCallsPerWorker: Infinity,
    maxCallTime: 10000,
    forcedKillTime: 0 // Preprocessors don't listen to system messages, just kill them
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