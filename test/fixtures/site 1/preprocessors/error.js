module.exports = function(context) {
  switch (context.parameters.error) {
  case 'exception':
    context.does_not_exist.uhoh = true;
  case 'status_code':
    return 401;
  case 'redirect':
    return '/redirected';
  case 'redirect_permanent':
    return [301, '/redirected'];
  case 'invalid_redirect_array':
    return ['/redirected'];
  case 'no_context':
    return;
  }
  return context;
};
