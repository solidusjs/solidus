const PERMANENT_STATUS = 301;
const TEMPORARY_STATUS = 302;

var path = require('path');
var _ = require('underscore');
var moment = require('moment');

var routing = require('./routing.js');

var Redirect = function( redirect_data, options ){

  options = options || {};

  var redirect = this;
  var server = options.server;
  var router = server.router;
  var status = redirect_data.permanent ? PERMANENT_STATUS : TEMPORARY_STATUS;
  var start = redirect_data.start;
  var end = redirect_data.end;
  var from = redirect_data.from;
  var to = redirect_data.to;
  var expired = ( moment() > moment( end ) );

  // don't create redirect route at all if expired
  // don't check prematurity yet since it could become valid later
  if( !expired ){

    if (from instanceof RegExp) {
      this.route = from;
    } else {
      this.route = path.normalize( from ).replace( /\\/g, '/' );
      this.route = routing.formatRouteForExpress(this.route);
    }

    router.get( this.route, function( req, res, next ){
      var expired = ( moment() > moment( end ) );
      var premature = ( moment() < moment( start ) );
      // if redirect is expired or premature skip it
      if( !expired && !premature ){
        var url = typeof(to) == 'function' ? to(req.params) : to;
        res.redirect( status, routing.expandVariables(url, req.params) );
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