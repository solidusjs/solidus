module.exports = function(context, preprocessor_path, callback) {
  try {
    var preprocessor = require(preprocessor_path);
    context = preprocessor(context);
  } catch (err) {
    return callback(err);
  }
  callback(null, context);
};
