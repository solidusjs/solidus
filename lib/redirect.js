var path = require('path');
var _ = require('underscore');

var Redirect = function( redirect_data, options ){

	options = options || {};

	var redirect = this;
	var server = options.server;
	var router = server.router;
	var status = 302;
	var route = this.route = path.normalize( redirect_data.from ).replace( /\\/g, '/' );

	router.get( route, function( req, res ){
		res.redirect( status, redirect_data.to );
	});

	// removes the redirect route
	this.destroy = function(){

		router.routes.get = _( router.routes.get ).reject( function( current_route ){
			return redirect.route === current_route.path;
		});
		
	};

};

module.exports = Redirect;