var path = require('path');

var Preprocessor = function(preprocessor_path, options) {
  this.path = preprocessor_path;
  this.relative_path = path.relative(options.server.paths.preprocessors, preprocessor_path);

  this.process = function(context, callback) {
    try {
      context = require(this.path)(context);
    } catch (err) {
      return callback(err, context);
    }
    callback(null, context);
  };
};

module.exports = Preprocessor;
