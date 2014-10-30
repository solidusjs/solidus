var _ = require('underscore');
var colors = require('colors');

const level_colors = {
  '0': 'red', // errors
  '1': 'yellow', // warnings
  '2': 'cyan', // status
  '3': 'magenta' // debug
};

var Logger = function( options ){

  options = _.defaults( options, {
    level: 2,
    log_server_level: 2
  });
  this.level = options.level;
  this.log_server = options.log_server;
  this.log_server_level = options.log_server_level;
  this.session = options.session;
  this.dev = options.dev;

  this.log = function(message, level) {
    var time = new Date().toISOString();
    if (this.dev) time = time[level_colors[level]].bold;
    var line = ['[' + time + ']', this.session.get('request_id') || '-', message].join(' ');

    level = level || 2;
    if (level <= this.level) {
      console.log(line);
    }
    if (level <= this.log_server_level && this.log_server) {
      this.log_server.emit('log', {level: level, message: line});
    }
  };

};

module.exports = Logger;