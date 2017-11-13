module.exports = [
{
  from: "/redirect1",
  to: "/"
}, {
  from: "/redirect2",
  to: "/",
  "start": "2000-1-1 00:00:00"
}, {
  from: "/redirect3",
  to: "/",
  "start": "3000-1-1 00:00:00"
}, {
  from: "/redirect4",
  to: "/",
  "end": "2000-1-1 00:00:00"
}, {
  from: "/redirect5",
  to: "/",
  "permanent": true
}, {
  from: "/redirect6/{dynamic}/{route}",
  to: "/new/{route}/{dynamic}"
}, {
  from: /\/redirect7\/(\d+)-\d+-(\d+)-(\d+)/,
  to: "/new/{1}/{0}/{2}"
}, {
  from: "/redirect8/{dynamic}/{route}",
  to: function(params) {
    return "/new/{route}/" + params.dynamic.toUpperCase();
  }
}, {
  from: /\/redirect9\/(\d+)-\d+-(\d+)-(\d+)/,
  to: function(params) {
    return "/new/{1}/{0}/" + (1000 + parseInt(params['2']));
  }
}, {
  from: {
    protocol: 'http',
    host: 'solidusjs.com',
    path: '/match-http-root'
  },
  to: '/new/match-http-root'
}, {
  from: {
    protocol: 'https',
    host: 'solidusjs.com',
    path: '/match-https-root'
  },
  to: '/new/match-https-root'
}, {
  from: {
    host: 'no-path.com'
  },
  to: {
    host: 'www.no-path.com'
  }
}, {
  from: '/to-https-www',
  to: {
    protocol: 'https',
    host: 'www.solidusjs.com'
  }
}, {
  from: '/to-https-www-url/{dynamic}',
  to: {
    protocol: 'https',
    host: 'www.solidusjs.com',
    url: '/new/url/{dynamic}'
  }
}];
