var path = require('path');
var SolidusServer = require('./lib/server');
var transformTools = require('browserify-transform-tools');

var solidus_server;

// Browserify transform that inlines requires to Solidus JS views.
// For example, this code:
//   var view = require('solidus/views/some/view'); // The path can end with .js too
// Becomes something like:
//   var view = {template:require("../../views/some/view.hbs"),template_options:{helpers:require("../../helpers.js")}};
module.exports = transformTools.makeRequireTransform(
  'solidus/solidify',
  {excludeExtensions: ['.' + SolidusServer.extensions.template]},
  function(args, opts, callback) {
    var view_name = args[0].match(/^solidus\/views\/(.*?)(\.js)?$/);
    if (!view_name) return callback();
    view_name = view_name[1];

    var waitForSolidus = function() {
      if (!solidus_server) {
        solidus_server = new SolidusServer({start_server: false});
        solidus_server.on('ready', function() {solidus_server.ready = true});
      }

      if (solidus_server.ready) {
        var view = solidus_server.views[solidus_server.pathFromPartialName(view_name)];
        callback(null, view ? view.toObjectString(opts.file) : null);
      } else {
        setImmediate(waitForSolidus);
      }
    };
    waitForSolidus();
  }
);
