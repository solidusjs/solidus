var DEFAULT_PORT = 8080;

timesbound = 0;

var solidus = {
	Server: require('./lib/server.js')
};

var site_path, views_path, redirects_path, preprocessors_path, assets_path;

// Start the solidus server
solidus.start = function( options, callback ){

	var solidus_server = new solidus.Server( options );

	if( callback ) solidus_server.once( 'ready', callback );

	return solidus_server;

};

module.exports = solidus;