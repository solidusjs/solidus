const PERMANENT_STATUS = 301;
const TEMPORARY_STATUS = 302;

var path = require('path');
var _ = require('underscore');
var moment = require('moment');

var Redirect = function( redirect_data, options ){

	options = options || {};

	var redirect = this;
	var server = options.server;
	var router = server.router;
	var status = ( redirect_data.start || redirect_data.end )? TEMPORARY_STATUS: PERMANENT_STATUS;
	var expired = ( moment() > moment(redirect_data.end) );
	var premature = ( moment() < moment(redirect_data.start) );

	if( !expired && !premature ){

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

	}

};

module.exports = Redirect;