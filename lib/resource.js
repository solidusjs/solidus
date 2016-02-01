const DEFAULT_RESOURCE_FRESHNESS = 60 * 1000; // 60 seconds

var BaseResource = require('solidus-client/lib/resource');
var ResourceResponse = require('./resource_response.js');
var utils = require('./utils.js');

var Resource = function(options, auth, params, logger) {
  this.resource  = new BaseResource(options, auth, params);
  this.options   = this.resource.options;
  this.logger    = logger;
  this.no_cache  = utils.hasNoCacheHeader(this.options.headers);
};

Resource.prototype.get = function(callback) {
  var self = this;

  if (!self.resource.url) return callback(null, {});

  self.resource.get(function(err, res) {
    if (err && !res.response) return callback(err);

    self.logger.log('Requested resource: [' + res.response.status + '] ' + self.resource.url, 3);
    var resource_response = new ResourceResponse(res);

    if (!err) {
      if (!resource_response.has_expiration) {
        // The response has no cache headers, cache for a default duration
        resource_response.expires_at = new Date().getTime() + DEFAULT_RESOURCE_FRESHNESS;
      }
    }

    callback(err, resource_response);
  });
};

module.exports = Resource;
