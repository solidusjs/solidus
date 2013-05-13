var fs = require('fs');
var chokidar = require('chokidar');

var watcher = chokidar.watch( 'test/fixtures/site2/views/', {
	persistent: true,
	ignoreInitial: true
});

watcher.on( 'add', function( path ){
	console.log( 'added', path );
});

watcher.on( 'unlink', function( path ){
	console.log( 'removed', path );
});

setTimeout( function(){
	fs.writeFileSync( 'test/fixtures/site2/views/test.hbs', 'test' );
}, 500 );