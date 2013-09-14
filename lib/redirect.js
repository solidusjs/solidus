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
	var status = redirect_data.permanent ? PERMANENT_STATUS : TEMPORARY_STATUS;
	var expired = ( moment() > moment(redirect_data.end) );
	var premature = ( moment() < moment(redirect_data.start) );

	// don't create redirect route at all if expired
	if( !expired ){

		var route = this.route = path.normalize( redirect_data.from ).replace( /\\/g, '/' );

		router.get( route, function( req, res, next ){
			// if redirect is expired or premature skip it
			if( !expired && !premature ){
				res.redirect( status, redirect_data.to );
			}
			else {
				next();
			}
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