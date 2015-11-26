// Format a Solidus route so it can be used by the router
module.exports.formatRouteForExpress = function(route) {
  return route.replace(/{([a-z_-]*)}/ig, ':$1'); // replace dynamic bits
};

// Expand variables like {this} in the string with the params values
module.exports.expandVariables = function(string, params) {
  return string.replace(/\{([^\}]*)\}/ig, function(match, capture) {
    return params[capture] || '';
  });
};

// Checks if the headers contain a "no-cache" directive
module.exports.hasNoCacheHeader = function(headers) {
  var header = headers && (headers['cache-control'] || headers['Cache-Control'] || headers['CACHE-CONTROL'] || headers['pragma'] || headers['Pragma'] || headers['PRAGMA']);
  return /no-cache($|[^=])/.test(header);
};
