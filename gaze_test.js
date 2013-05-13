var gaze = require('gaze');
var fs = require('fs');
//gaze( 'test/fixtures/site2/views/**/*', function(){
//	this.on('added',function(path){
//		console.log( path );
//	});
//	this.on('error', function(){
//		console.log( arguments );
//	});
//	this.on('end', function(){
//		console.log('end');
//	})
//});

var Gaze = gaze.Gaze;
var watcher = new Gaze( 'test/fixtures/site2/views/**/*', {}, function( err ){
	if( err ) throw err;
});
watcher.on( 'all', function(){
	console.log( arguments );
});
setTimeout(function(){
fs.writeFileSync( 'test/fixtures/site2/views/test.hbs', 'test' );
},2000);
console.log('test');