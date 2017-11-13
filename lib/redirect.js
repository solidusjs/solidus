const PERMANENT_STATUS = 301;
const TEMPORARY_STATUS = 302;

var path = require('path');
var _ = require('underscore');
var moment = require('moment');

var utils = require('./utils.js');

var Redirect = function(redirect_data, options) {
  options = options || {};

  var redirect = this;
  var router = options.server.router;
  var status = redirect_data.permanent ? PERMANENT_STATUS : TEMPORARY_STATUS;
  var start = redirect_data.start;
  var end = redirect_data.end;
  var from = _.isObject(redirect_data.from) && !_.isRegExp(redirect_data.from) ? redirect_data.from : {path: redirect_data.from};
  var to = _.isObject(redirect_data.to) && !_.isFunction(redirect_data.to) ? redirect_data.to : {url: redirect_data.to};
  var expired = moment() > moment(end);

  // Don't create redirect route at all if expired
  // Don't check prematurity yet since it could become valid later
  if (!expired) {
    redirect.route = from.path || '*';
    if (_.isString(redirect.route)) {
      redirect.route = path.normalize(redirect.route).replace(/\\/g, '/');
      redirect.route = utils.formatRouteForExpress(redirect.route);
    }

    router.get(redirect.route, function(req, res, next) {
      // If redirect is expired or premature skip it
      var expired = moment() > moment(end);
      var premature = moment() < moment(start);
      if (expired || premature) return next();

      // If the protocol or host don't match, skip redirect
      if (from.protocol && from.protocol !== req.protocol) return next();
      if (from.host && from.host !== req.host) return next();

      // Compute to
      var newTo = to;
      if (_.isFunction(newTo.url)) {
        newTo = newTo.url(req.params);
        if (!_.isObject(newTo)) newTo = Object.assign({}, to, {url: newTo});
      }

      // Compute location
      var location = newTo.protocol || newTo.host ? ((newTo.protocol || req.protocol) + '://' + (newTo.host || req.host)) : '';
      location += newTo.url ? utils.expandVariables(newTo.url, req.params) : req.url;

      res.redirect(status, location);
    });

    // Removes the redirect route
    this.destroy = function() {
      router.routes.get = _(router.routes.get).reject(function(current_route) {
        return redirect.route === current_route.path;
      });
    };
  }
};

module.exports = Redirect;