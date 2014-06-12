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
