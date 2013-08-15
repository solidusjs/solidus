var colors = require('colors');

const level_colors = {
	'0': 'red', // errors
	'1': 'yellow', // warnings
	'2': 'cyan', // status
	'3': 'orange' // debug
};

var Logger = function( options ){
	
	this.level = options.level || 1;

	this.log = function( message, level ){
		if( this.level <= level ) console.log( '[SOLIDUS]'[level_colors[level]].bold +' '+ message );
	};

};

module.exports = Logger;