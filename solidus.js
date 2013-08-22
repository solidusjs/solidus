var solidus = {
	Server: require('./lib/server.js')
};

// Start the solidus server
solidus.start = function( options, callback ){

	var solidus_server = new solidus.Server( options );

	if( callback ) solidus_server.once( 'ready', callback );

	return solidus_server;

};

module.exports = solidus;

process.on( 'uncaughtException', function( err ){
	console.log( arguments );
});