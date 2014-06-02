module.exports = function( context ){
  context.preprocessedBy = context.preprocessedBy || []
  context.preprocessedBy.push('partial2_with_resources.js')
  return context;
};