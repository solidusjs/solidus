var colors = require('colors');

const level_colors = {
	'0': 'red', // errors
	'1': 'yellow', // warnings
	'2': 'cyan', // status
	'3': 'magenta' // debug
};

var Logger = function( options ){
	
	this.level = options.level || 1;

	this.log = function( message, level ){
		level = level || 2;
		if( this.level >= level ) console.log( '[SOLIDUS]'[level_colors[level]].bold +' '+ message );
	};

};

module.exports = Logger;