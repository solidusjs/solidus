module.exports = function( context ){
  context.preprocessedBy = context.preprocessedBy || []
  context.preprocessedBy.push('partial1_with_resources.js')
  return context;
};