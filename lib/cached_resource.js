const MAX_RESOURCES_CACHE = 50;
const MAX_RESOURCE_AGE = 1000 * 60 * 60 * 24; // 24 hours
const DEFAULT_RESOURCE_FRESHNESS = 60 * 1000; // 60 seconds

var _ = require('underscore');
var lru = require('lru-cache');
var Resource = require('solidus-client/lib/resource');
var ResourceResponse = require('./resource_response.js');

var cache = lru({
  max: MAX_RESOURCES_CACHE,
  length: function() {return 1},
  maxAge: MAX_RESOURCE_AGE
});

var CachedResource = function(options, auth, params, logger) {
  this.resource = new Resource(options, auth, params);
  this.options  = this.resource.options;
  this.logger   = logger;
};

CachedResource.prototype.get = function(callback) {
  if (!this.resource.url) return callback(null, {});

  // TODO: include the auth in the cache key
  var resource_response = cache.get(this.resource.url);
  if (resource_response) {
    this.logger.log('Resource recovered from cache: ' + this.resource.url, 3);
    refreshCache.call(this, resource_response);
    callback(null, resource_response);
  } else {
    getAndCache.call(this, callback);
  }
};

// PRIVATE

var refreshCache = function(resource_response) {
  if (!resource_response.expired() || !resource_response.lock(this.options.timeout)) return;

  // The cache is expired, refresh it in the next event loop cycle
  var self = this;
  process.nextTick(function() {
    self.logger.log('Refreshing expired cached resource: ' + self.resource.url, 3);
    getAndCache.call(self, function() {
      resource_response.unlock();
    });
  });
};

var getAndCache = function(callback) {
  var self = this;

  self.resource.get(function(err, res) {
    if (err && !res.response) return callback(err);

    self.logger.log('Requested resource: [' + res.response.status + '] ' + self.resource.url, 3);
    var resource_response = new ResourceResponse(res);

    if (!err) {
      if (!resource_response.has_expiration) {
        // The response has no cache headers, cache for a default duration
        resource_response.expires_at = new Date().getTime() + DEFAULT_RESOURCE_FRESHNESS;
      }
      // TODO: include the auth in the cache key
      cache.set(self.resource.url, resource_response);
    }

    callback(err, resource_response);
  });
};

CachedResource.cache = cache;

module.exports = CachedResource;
