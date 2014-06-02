module.exports = function( context ){
  context.preprocessedBy = context.preprocessedBy || []
  context.preprocessedBy.push('page_with_resources_and_partials.js')
  return context;
};