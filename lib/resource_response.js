const LOCK_TIMEOUT = 20 * 1000; // 20 seconds

var ResourceResponse = function(spec) {
  this.status = spec.response.status;
  this.data = spec.data;
  this.expires_at = expiresAt(spec.response, spec.request_time, spec.response_time);
  this.locked_at = 0;

  if (this.expires_at) {
    this.has_expiration = true;
  } else {
    this.has_expiration = false;
    this.expires_at = new Date().getTime();
  }

  this.maxAge = function() {
    return Math.max(0, Math.ceil((this.expires_at - new Date().getTime()) / 1000));
  };

  this.expired = function() {
    return new Date().getTime() >= this.expires_at;
  };

  this.lock = function(timeout) {
    if (new Date().getTime() >= this.locked_at + (timeout || LOCK_TIMEOUT) + 2000) {
      this.locked_at = new Date().getTime();
      return true;
    } else {
      return false;
    }
  };

  this.unlock = function() {
    this.locked_at = 0;
  };
};

// https://developer.mozilla.org/en/docs/HTTP_Caching_FAQ
var expiresAt = function(response, request_time, response_time) {
  var freshness_lifetime = freshnessLifetime(response, request_time);
  if (freshness_lifetime === null) return null;

  return new Date().getTime() + freshness_lifetime - currentAge(response, request_time, response_time);
};

// http://tools.ietf.org/html/rfc2616#section-13.2.4
var freshnessLifetime = function(response, request_time) {
  var cache_control = parseCacheControl(response.headers['cache-control'] || '');

  if (cache_control.hasOwnProperty('s-maxage') && cache_control['s-maxage'] !== true) {
    return cache_control['s-maxage'] * 1000;
  }

  if (cache_control.hasOwnProperty('max-age') && cache_control['max-age'] !== true) {
    return cache_control['max-age'] * 1000;
  }

  if (response.headers['expires']) {
    var expires = parseDate(response.headers['expires']);
    var date = parseDate(response.headers['date']) || request_time;
    return expires - date;
  }

  return null;
};

// http://tools.ietf.org/html/rfc2616#section-13.2.3
// http://greenbytes.de/tech/webdav/draft-ietf-httpbis-p6-cache-22.html#age.calculations
var currentAge = function(response, request_time, response_time) {
  var apparent_age = Math.max(0, response_time - (parseDate(response.headers['date']) || request_time));
  var response_delay = response_time - request_time;
  var corrected_age_value = response.headers['age'] ? response.headers['age'] * 1000 + response_delay : 0;
  var corrected_initial_age = Math.max(apparent_age, corrected_age_value);
  var resident_time = new Date().getTime() - response_time;
  var current_age = corrected_initial_age + resident_time;

  return current_age;
};

var parseCacheControl = function(header) {
  var directives = header.split(',');
  var obj = {};

  for (var i = 0, len = directives.length; i < len; i++) {
    var parts = directives[i].split('=');
    var key = parts.shift().trim();
    var val = parseInt(parts.shift(), 10);

    obj[key] = isNaN(val) ? true : val;
  }

  return obj;
};

var parseDate = function(header) {
  return header ? Date.parse(header) : null;
};

module.exports = ResourceResponse;