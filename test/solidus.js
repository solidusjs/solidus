const DEFAULT_ENCODING = 'UTF8';
const FILESYSTEM_DELAY = 1100;

var path = require('path');
var assert = require('assert');
var async = require('async');
var fs = require('fs');
var moment = require('moment');
var request = require('supertest');
var nock = require('nock');
var zlib = require('zlib');
var timekeeper = require('timekeeper');
var solidus = require('../solidus.js');
var SolidusServer = require('../lib/server.js');
var Page = require('../lib/page.js');

var original_path = __dirname;
var site1_path = path.join( original_path, 'fixtures', 'site 1' );
var site2_path = path.join( original_path, 'fixtures', 'site2' );

var normalizePath = function( file_path ){
  return file_path.replace( /\//g, path.sep );
};

describe( 'Solidus', function(){

  describe( 'production', function(){

    var solidus_server;
    var original_redirects = [];

    beforeEach( function( done ){
      process.chdir( site1_path );
      // Generate time-based redirects
      // These are used to ensure that temporary redirects are properly checked
      original_redirects = fs.readFileSync( 'redirects.js', DEFAULT_ENCODING );
      delete require.cache[require.resolve(site1_path + '/redirects.js')];
      var original_redirects_arr = require(site1_path + '/redirects.js');
      var redirect_date_format = 'YYYY-MM-DD HH:mm:ss';
      var temporal_redirects = [{
        start: moment().add( 's', 5 ).format( redirect_date_format ),
        from: '/future-redirect',
        to: '/'
      }, {
        start: moment().subtract( 's', 5 ).format( redirect_date_format ),
        end: moment().add( 's', 5 ).format( redirect_date_format ),
        from: '/current-redirect',
        to: '/'
      }, {
        start: moment().subtract( 's', 10 ).format( redirect_date_format ),
        end: moment().subtract( 's', 5 ).format( redirect_date_format ),
        from: '/past-redirect',
        to: '/'
      }];
      var overlapping_redirects = [{
        start: moment().add( 's', 5 ).format( redirect_date_format ),
        from: '/overlapping-redirect',
        to: '/overlapping-redirect-future'
      }, {
        start: moment().subtract( 's', 5 ).format( redirect_date_format ),
        end: moment().add( 's', 5 ).format( redirect_date_format ),
        from: '/overlapping-redirect',
        to: '/overlapping-redirect-current'
      }, {
        start: moment().subtract( 's', 10 ).format( redirect_date_format ),
        end: moment().subtract( 's', 5 ).format( redirect_date_format ),
        from: '/overlapping-redirect',
        to: '/overlapping-redirect-past'
      }];
      var combined_redirects = JSON.stringify( temporal_redirects.concat( overlapping_redirects ) );
      fs.appendFileSync( 'redirects.js', ';module.exports = module.exports.concat(' + combined_redirects + ');', DEFAULT_ENCODING );

      // mock http endpoints for resources
      nock('https://solid.us').get('/basic/1').reply( 200, { test: true } );
      nock('https://solid.us').get('/basic/2').reply( 200, { test: true } );
      nock('https://solid.us').get('/dynamic/segment/3').reply( 200, { test: true } );
      nock('https://solid.us').get('/resource/options/url').reply( 200, { test: true } );
      nock('https://solid.us').get('/resource/options/query?test=true').reply( 200, { test: true } );
      nock('https://solid.us').get('/resource/options/dynamic/query?test=3').reply( 200, { test: true } );
      nock('https://solid.us').get('/resource/options/double/dynamic/query?a=%2C&b=%2C&test2=4&c=%2C&d=%252C&test=3').reply( 200, { test: true } );
      nock('https://solid.us').get('/centralized/auth/query').reply( 200, { test: true } );
      nock('https://solid.us').get('/resource/options/headers').matchHeader( 'key', '12345' ).reply( 200, { test: true } );
      nock('https://a.solid.us').get('/centralized/auth').matchHeader( 'key', '12345' ).reply( 200, { test: true } );
      nock('https://b.solid.us').get('/centralized/auth/query?key=12345').reply( 200, { test: true } );
      // empty dynamic segments
      nock('https://solid.us').get('/dynamic/segment/').reply( 200, { test: false } );
      nock('https://solid.us').get('/resource/options/dynamic/query?test=').reply( 200, { test: false } );
      nock('https://solid.us').get('/resource/options/double/dynamic/query?a=%2C&b=%2C&test2=&c=%2C&d=%252C&test=').reply( 200, { test: false } );

      async.parallel([
        // compressed resources
        function( callback ){
          zlib.gzip( '{"test":true}', function( _, result ){
            nock('https://solid.us').get('/compressed/gzip').reply( 200, result, { 'Content-Encoding': 'gzip' } );
            callback();
          });
        },
        function( callback ){
          zlib.deflate( '{"test":true}', function( _, result ){
            nock('https://solid.us').get('/compressed/deflate').reply( 200, result, { 'Content-Encoding': 'deflate' } );
            callback();
          });
        }
      ],
      function(){
        solidus_server = solidus.start({
          log_level: -1,
          port: 9009
        });
        solidus_server.on( 'ready', done );
      });
    });

    afterEach( function(){
      solidus_server.stop();
      fs.writeFileSync( 'redirects.js', original_redirects, DEFAULT_ENCODING );
      process.chdir( original_path );
    });

    it( 'Starts a new http server', function( done ){
      request( solidus_server.router )
        .get('/')
        .end( function( err, res ){
          if( err ) throw err;
          done();
        });
    });

    it( 'Creates routes based on the contents of /views', function( done ){
      var s_request = request( solidus_server.router );
      async.parallel([
        function( callback ){
          s_request.get('/').expect( 200, callback );
        },
        function( callback ){
          s_request.get('/layout').expect( 200, callback );
        }
      ], function( err, results ){
        if( err ) throw err;
        done();
      });
    });

    it( 'Creates routes with dynamic segments', function( done ){
      var s_request = request( solidus_server.router );
      async.parallel([
        function( callback ){
          s_request.get('/dynamic/1').expect( 200, callback );
        },
        function( callback ){
          s_request.get('/dynamic/2').expect( 200, callback );
        }
      ], function( err, results ){
        if( err ) throw err;
        done();
      });
    });

    it( 'Creates routes for page contexts', function( done ){
      var s_request = request( solidus_server.router );
      async.parallel([
        function( callback ){
          s_request.get('/.json')
            .expect( 'Content-Type', /json/ )
            .expect( 200 )
            .end( function( err, res ){
              assert( res.body.page.title === 'test' );
              assert( res.body.parameters );
              assert( res.body.query );
              callback( err );
            });
        },
        function( callback ){
          s_request.get('/layout.json?test=true')
            .expect( 'Content-Type', /json/ )
            .expect( 200 )
            .end( function( err, res ){
              assert( res.body.page );
              assert( res.body.parameters );
              assert( res.body.query.test );
              callback( err );
            });
        },
        function( callback ){
          s_request.get('/dynamic/1.json')
            .expect( 'Content-Type', /json/ )
            .expect( 200 )
            .end( function( err, res ){
              assert( res.body.page );
              assert( res.body.parameters.segment == '1' );
              assert( res.body.query );
              callback( err );
            });
        },
        function( callback ){
          s_request.get('/dynamic/2.json')
            .expect( 'Content-Type', /json/ )
            .expect( 200 )
            .end( function( err, res ){
              assert( res.body.page );
              assert( res.body.parameters.segment == '2' );
              assert( res.body.query );
              callback( err );
            });
        }
      ], function( err, results ){
        if( err ) throw err;
        done();
      });
    });

    it( 'Returns 404s for unmatched routes', function( done ){
      var s_request = request( solidus_server.router );
      s_request.get('/nonexistent-url')
        .expect( 404 )
        .end( function( err, res ){
          assert(res.text.indexOf('Not here!') > -1);
          if( err ) throw err;
          done();
        });
    });

    it( 'Makes URL information available in page context', function( done ){
      var s_request = request( solidus_server.router );
      s_request.get('/.json')
        .expect( 'Content-Type', /json/ )
        .expect( 200 )
        .end( function( err, res ){
          assert( res.body.url );
          assert( res.body.url.path === '/.json' );
          if( err ) throw err;
          done();
        });
    });

    it( 'Sets noindex header for preview mode', function( done ){
      var s_request = request( solidus_server.router );
      s_request.get('/?is_preview=true')
        .expect( 'x-robots-tag', /noindex/ )
        .end( function( err, res ){
          if (err) throw err;
          done();
        });
    });

    it( 'Finds the list of partials used by each page', function(done) {
      var partials = ['partial1', 'partial2', 'partial3', 'partial/4', 'partial9', "partial'10", 'partial11', 'partial"12'];
      assert.deepEqual(solidus_server.views[solidus_server.pathFromPartialName('multiple_partials')].partials, partials);
      done();
    });

    it( 'Fetches resources and adds them to the page context', function( done ){
      var s_request = request( solidus_server.router );
      async.parallel([
        function( callback ){
          s_request.get('/.json?resource_test=3&resource_test2=4')
            .expect( 'Content-Type', /json/ )
            .expect( 200 )
            .end( function( err, res ){
              assert( res.body.resources.basic.test );
              assert( res.body.resources.basic2.test );
              assert( res.body.resources['dynamic-segment'].test );
              assert( res.body.resources['resource-options-url'].test );
              assert( res.body.resources['resource-options-query'].test );
              assert( res.body.resources['resource-options-headers'].test );
              assert( res.body.resources['resource-options-double-dynamic-query'].test );
              assert( res.body.resources['resource-options-dynamic-query'].test );
              assert( res.body.resources['centralized-auth'].test );
              assert( res.body.resources['centralized-auth-query'].test );
              assert( res.body.resources['compressed-gzip'].test );
              assert( res.body.resources['compressed-deflate'].test );
              callback( err );
            });
        }
      ], function( err, results ){
        if( err ) throw err;
        done();
      });
    });

    it( 'Sets request url as resource referer', function(done) {
      nock('https://solid.us').get('/cache?a=1').matchHeader('Referer', 'http://some.domain.com:123/caching?a=1').reply( 200, { test: 1 } );
      nock('https://solid.us').get('/cache?a=2').matchHeader('Referer', 'http://some.domain.com:123/caching?a=1').reply( 200, { test: 2 } );

      var s_request = request(solidus_server.router);
      s_request.get('/caching?a=1')
        .set('Host', 'some.domain.com:123')
        .expect(200)
        .end(function(err, res) {
          if (err) throw err;
          done();
        });
    });

    it('Renders an error with error.hbs when a mandatory resource has an error', function(done) {
      var s_request = request(solidus_server.router);
      async.parallel([
        function(callback) {
          // Bad fetched data
          nock('https://solid.us').get('/error/mandatory?test=1').reply(200, 'Not JSON');
          nock('https://solid.us').get('/error/optional?test=1').reply(200, {test: 1});
          s_request.get('/with_resource_error?test=1')
            .expect(500)
            .end(function(err, res) {
              assert(res.text.indexOf('Oh no (500)!') > -1);
              callback(err);
            });
        },
        function(callback) {
          // 200 status and error in response message
          nock('https://solid.us').get('/error/mandatory?test=2').reply(200, {status: 'error', error: 'Could not find such a thing'});
          nock('https://solid.us').get('/error/optional?test=2').reply(200, {test: 2});
          s_request.get('/with_resource_error?test=2')
            .expect(404)
            .end(function(err, res) {
              assert(res.text.indexOf('Not here!') > -1);
              callback(err);
            });
        },
        function(callback) {
          // Bad status
          nock('https://solid.us').get('/error/mandatory?test=3').reply(401, {error: 'Nice try'});
          nock('https://solid.us').get('/error/optional?test=3').reply(200, {test: 3});
          s_request.get('/with_resource_error?test=3')
            .expect(401)
            .end(function(err, res) {
              assert(res.text.indexOf('Oh no (401)!') > -1);
              callback(err);
            });
        },
        function(callback) {
          // No error with mandatory resource
          nock('https://solid.us').get('/error/mandatory?test=4').reply(200, {test: 4});
          nock('https://solid.us').get('/error/optional?test=4').reply(401, {error: 'Nice try'});
          s_request.get('/with_resource_error.json?test=4')
            .expect(200)
            .end(function(err, res) {
              assert.equal(res.body.resources.mandatory.test, 4);
              assert.equal(res.body.resources.optional, undefined);
              callback(err);
            });
        },
        function(callback) {
          // Missing static resource
          nock('https://solid.us').get('/cache/1').reply(404, {error: 'Could not find such a thing'});
          nock('https://solid.us').get('/cache/2').reply(404, {error: 'Could not find such a thing'});
          s_request.get('/with_all_features')
            .expect(500)
            .end(function(err, res) {
              assert(res.text.indexOf('Oh no (500)!') > -1);
              callback(err);
            });
        },
        function(callback) {
          // No errors with preview parameter
          nock('https://solid.us').get('/error/mandatory?test=5').reply(401, {error: 'Nice try'});
          nock('https://solid.us').get('/error/optional?test=5').reply(401, {error: 'Nice try'});
          s_request.get('/with_resource_error.json?test=5&is_preview=true')
            .expect(200)
            .end(function(err, res) {
              assert.equal(res.body.resources.mandatory, undefined);
              assert.equal(res.body.resources.optional, undefined);
              callback(err);
            });
        },
      ], function(err, results) {
        if (err) throw err;
        done();
      });
    });

    it( 'Preprocesses the context of pages', function( done ){
      this.timeout(11000); // /infinite.json should timeout after 10s
      var s_request = request( solidus_server.router );
      async.parallel([
        function( callback ){
          s_request.get('/.json')
            .expect( 'Content-Type', /json/ )
            .expect( 200 )
            .end( function( err, res ){
              if( err ) throw err;
              assert( res.body.test === true );
              callback( err );
            });
        },
        function( callback ){
          s_request.get('/infinite.json')
            .expect( 'Content-Type', /json/ )
            .expect( 500 )
            .end( function( err, res ){
              if( err ) throw err;
              assert( !res.body.test );
              s_request.get('/.json')
                .expect( 'Content-Type', /json/ )
                .expect( 200 )
                .end( function( err, res ){
                  if( err ) throw err;
                  assert( res.body.test === true );
                  callback( err );
                });
            });
        }
      ], function( err, results ){
        if( err ) throw err;
        done();
      });
    });

    it('Renders an error when the preprocessor has an error', function(done) {
      var s_request = request(solidus_server.router);
      async.parallel([
        function(callback) {
          s_request.get('/with_preprocessor_error?error=exception')
            .expect(500)
            .end(function(err, res) {
              assert(res.text.indexOf('Oh no (500)!') > -1);
              callback();
            });
        },
        function(callback) {
          s_request.get('/with_preprocessor_error?error=status_code')
            .expect(401)
            .end(function(err, res) {
              assert(res.text.indexOf('Oh no (401)!') > -1);
              callback();
            });
        },
        function(callback) {
          s_request.get('/with_preprocessor_error?error=redirect')
            .expect(302)
            .expect('location', '/redirected', callback);
        },
        function(callback) {
          s_request.get('/with_preprocessor_error?error=redirect_permanent')
            .expect(301)
            .expect('location', '/redirected', callback);
        },
        function(callback) {
          s_request.get('/with_preprocessor_error?error=invalid_redirect_array')
            .expect(200)
            .end(function(err, res) {
              if( err ) throw err;
              assert(res.text.indexOf('No error happened!') > -1);
              callback();
            });
        },
        function(callback) {
          s_request.get('/with_preprocessor_error?error=no_context')
            .expect(500)
            .end(function(err, res) {
              assert(res.text.indexOf('Oh no (500)!') > -1);
              callback();
            });
        }
      ], function(err) {
        if (err) throw err;
        done();
      });
    });

    it('Ignores preprocessor errors in preview mode', function(done) {
      var s_request = request(solidus_server.router);
      async.parallel([
        function(callback) {
          s_request.get('/with_preprocessor_error?error=exception&is_preview=true')
            .expect(200)
            .end(function(err, res) {
              if( err ) throw err;
              assert(res.text.indexOf('No error happened!') > -1);
              callback();
            });
        },
        function(callback) {
          s_request.get('/with_preprocessor_error?error=status_code&is_preview=true')
            .expect(200)
            .end(function(err, res) {
              if( err ) throw err;
              assert(res.text.indexOf('No error happened!') > -1);
              callback();
            });
        },
        function(callback) {
          s_request.get('/with_preprocessor_error?error=redirect&is_preview=true')
            .expect(200)
            .end(function(err, res) {
              if( err ) throw err;
              assert(res.text.indexOf('No error happened!') > -1);
              callback();
            });
        },
        function(callback) {
          s_request.get('/with_preprocessor_error?error=redirect_permanent&is_preview=true')
            .expect(200)
            .end(function(err, res) {
              if( err ) throw err;
              assert(res.text.indexOf('No error happened!') > -1);
              callback();
            });
        },
        function(callback) {
          s_request.get('/with_preprocessor_error?error=invalid_redirect_array&is_preview=true')
            .expect(200)
            .end(function(err, res) {
              if( err ) throw err;
              assert(res.text.indexOf('No error happened!') > -1);
              callback();
            });
        },
        function(callback) {
          s_request.get('/with_preprocessor_error?error=no_context&is_preview=true')
            .expect(200)
            .end(function(err, res) {
              if( err ) throw err;
              assert(res.text.indexOf('No error happened!') > -1);
              callback();
            });
        }
      ], function(err) {
        if (err) throw err;
        done();
      });
    });

    it( 'Serves assets in /assets', function( done ){
      var s_request = request( solidus_server.router );
      async.parallel([
        function( callback ){
          s_request.get('/scripts/test.js')
            .expect( 200, callback )
            .expect( 'cache-control', 'public, max-age=31536000' );
        },
        function( callback ){
          s_request.get('/styles/test.css').expect( 200, callback );
        }
      ], function( err, results ){
        if( err ) throw err;
        done();
      });
    });

    it( 'Creates redirects based on the contents of redirects.js', function( done ){
      var s_request = request( solidus_server.router );
      async.parallel([
        function( callback ){
          s_request.get('/redirect1').expect( 302, callback );
        },
        function( callback ){
          s_request.get('/redirect2').expect( 302, callback );
        },
        function( callback ){
          s_request.get('/redirect3').expect( 404, callback );
        },
        function( callback ){
          s_request.get('/redirect4').expect( 404, callback );
        },
        function( callback ){
          s_request.get('/redirect5').expect( 301, callback );
        },
        function( callback ){
          s_request.get('/redirect6/old/path').expect( 'location', '/new/path/old', callback );
        },
        function( callback ){
          s_request.get('/redirect7/12-34-56-78').expect( 'location', '/new/56/12/78', callback );
        },
        function( callback ){
          s_request.get('/redirect8/old/path').expect( 'location', '/new/path/OLD', callback );
        },
        function( callback ){
          s_request.get('/redirect9/12-34-56-78').expect( 'location', '/new/56/12/1078', callback );
        },
        function( callback ){
          s_request.get('/past-redirect').expect( 404, callback );
        },
        function( callback ){
          s_request.get('/current-redirect').expect( 302, callback );
        },
        function( callback ){
          s_request.get('/future-redirect').expect( 404, callback );
        },
        function( callback ){
          s_request.get('/overlapping-redirect').expect( 'location', '/overlapping-redirect-current', callback );
        }
      ], function( err, results ){
        if( err ) throw err;
        done();
      });
    });

    it( 'Sets the default layout', function(){
      assert( solidus_server.handlebars.defaultLayout === 'layout' );
    });

    it( 'Uses the layout closest to a page view', function( done ){
      var s_request = request( solidus_server.router );
      async.parallel([
        function( callback ){
          s_request
            .get('/deeply/nested/page/using/a_layout.json')
            .expect( 200 )
            .end( function( err, res ){
              assert( res.body.layout === normalizePath('deeply/nested/layout.hbs') );
              callback( err );
            });
        },
        function( callback ){
          s_request
            .get('/deeply/nested/page.json')
            .expect( 200 )
            .end( function( err, res ){
              assert( res.body.layout === normalizePath('deeply/nested/layout.hbs') );
              callback( err );
            });
        }
      ], function( err, results ){
        if( err ) throw err;
        done();
      });
    });

    it( 'Makes partials available even if they have the same name in different directories', function( done ){
      var s_request = request( solidus_server.router );
      async.parallel([
        function( callback ){
          s_request
            .get('/partial_holder/')
            .expect( 200 )
            .end( function( err, res ){
              assert( res.text == 'partial.hbs' );
              callback( err );
            });
        },
        function( callback ){
          s_request
            .get('/partial_holder2/')
            .expect( 200 )
            .end( function( err, res ){
              assert( res.text == 'deeply/partial.hbs' );
              callback( err );
            });
        }
      ], function( err, results ){
        if( err ) throw err;
        done();
      });
    });

    it( 'Makes partials available from node_modules', function( done ){
      request(solidus_server.router)
        .get('/partial_holder3/')
        .expect(200)
        .end(function(err, res) {
          assert.ifError(err);
          assert.equal(res.text, 'partial.hbs\nPartial from external module.\nPartial with same path as external partial (site 1/node_modules/extra/conflict).');
          done();
        });
    });

    it( 'Sends appropriate cache headers with pages', function( done ){
      var s_request = request( solidus_server.router );
      s_request
        .get('/')
        .expect( 'cache-control', 'public, max-age=300, stale-while-revalidate=86400, stale-if-error=86400' )
        .end( function( err, res ){
          if( err ) throw err;
          assert( new Date( res.headers['expires'] ) > new Date );
          done();
        });
    });

    it( 'Runs helpers after preprocessors', function( done ){
      var s_request = request( solidus_server.router );
      s_request
        .get('/helpers')
        .end( function( err, res ){
          assert( res.text.indexOf('SOLIDUS') > -1 ); // Handlebars-helper
          assert( res.text.indexOf('Le Solidus sacrebleu !') > -1 ); // Site helper
          done();
        });
    });

    it('Sets the X-Powered-By header for HTML requests', function(done) {
      var s_request = request(solidus_server.router);
      s_request
        .get('/')
        .expect('X-Powered-By', 'Solidus/' + require('../package.json').version)
        .end(function(err, res) {
          if (err) throw err;
          done();
        });
    });

    it('Sets the X-Powered-By header for JSON requests', function(done) {
      var s_request = request(solidus_server.router);
      s_request
        .get('/.json')
        .expect('X-Powered-By', 'Solidus/' + require('../package.json').version)
        .end(function(err, res) {
          if (err) throw err;
          done();
        });
    });

    it('Sets the X-Powered-By header for 404s', function(done) {
      var s_request = request(solidus_server.router);
      s_request
        .get('/nonexistent-url')
        .expect('X-Powered-By', 'Solidus/' + require('../package.json').version)
        .end(function(err, res) {
          if (err) throw err;
          done();
        });
    });

    describe('/api/resource.json', function() {
      beforeEach(function() {
        var now = new Date(1397524638000); // Test date rounded to the second, to simplify comparisons
        timekeeper.freeze(now);
      });

      afterEach(function() {
        timekeeper.reset();
      });

      it('fetches and renders the url in the query string', function(done) {
        nock('https://solid.us').get('/api-resource').reply(200, {test: 2});

        var s_request = request(solidus_server.router);
        s_request.get('/api/resource.json?url=https://solid.us/api-resource')
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) throw err;
            assert.deepEqual(res.body, {test: 2});
            done();
          });
      });

      it('renders an error when missing url', function(done) {
        var s_request = request(solidus_server.router);
        s_request.get('/api/resource.json')
          .expect(400)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) throw err;
            assert.deepEqual(res.body, {error: "Missing 'url' parameter"});
            done();
          });
      });

      it('renders an error when bad url', function(done) {
        var s_request = request(solidus_server.router);
        s_request.get('/api/resource.json?url=not-a-url')
          .expect(400)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) throw err;
            assert.deepEqual(res.body, {error: "Invalid 'url' parameter"});
            done();
          });
      });

      it('fetches and renders an error when resource is invalid', function(done) {
        nock('https://solid.us').get('/api-resource').reply(200, 'this is not json');

        var s_request = request(solidus_server.router);
        s_request.get('/api/resource.json?url=https://solid.us/api-resource')
          .expect(400)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) throw err;
            assert.deepEqual(res.body, {status: 400, error: 'Invalid JSON', message: {error: 'Unexpected token h'}});
            done();
          });
      });

      it('returns the resource\'s freshness when the resource is valid and has caching headers', function(done) {
        nock('https://solid.us').get('/api-resource').reply(200, {test: 2}, {'Cache-Control': 'max-age=123'});

        var s_request = request(solidus_server.router);
        s_request.get('/api/resource.json?url=https://solid.us/api-resource')
          .expect('Cache-Control', 'public, max-age=123, stale-while-revalidate=86400, stale-if-error=86400')
          .expect('Expires', new Date(new Date().getTime() + 123 * 1000).toUTCString())
          .end(function(err, res) {
            if (err) throw err;
            done();
          });
      });

      it('returns the default freshness when the resource is valid and has no caching headers', function(done) {
        nock('https://solid.us').get('/api-resource').reply(200, {test: 2});

        var s_request = request(solidus_server.router);
        s_request.get('/api/resource.json?url=https://solid.us/api-resource')
          .expect('Cache-Control', 'public, max-age=60, stale-while-revalidate=86400, stale-if-error=86400')
          .expect('Expires', new Date(new Date().getTime() + 60 * 1000).toUTCString())
          .end(function(err, res) {
            if (err) throw err;
            done();
          });
      });

      it('returns the resource\'s freshness when the resource is invalid and has caching headers', function(done) {
        nock('https://solid.us').get('/api-resource').reply(400, {test: 2}, {'Cache-Control': 'max-age=123'});

        var s_request = request(solidus_server.router);
        s_request.get('/api/resource.json?url=https://solid.us/api-resource')
          .expect('Cache-Control', 'public, max-age=123, stale-while-revalidate=86400, stale-if-error=86400')
          .expect('Expires', new Date(new Date().getTime() + 123 * 1000).toUTCString())
          .end(function(err, res) {
            if (err) throw err;
            done();
          });
      });

      it('returns no freshness when the resource is invalid and has no caching headers', function(done) {
        nock('https://solid.us').get('/api-resource').reply(400, {test: 2});

        var s_request = request(solidus_server.router);
        s_request.get('/api/resource.json?url=https://solid.us/api-resource')
          .expect('Cache-Control', 'public, max-age=0, stale-while-revalidate=86400, stale-if-error=86400')
          .expect('Expires', new Date().toUTCString())
          .end(function(err, res) {
            if (err) throw err;
            done();
          });
      });

      it('fetches the url using the appropriate auth', function(done) {
        nock('https://a.solid.us').get('/api-resource').matchHeader('key', '12345').reply(200, {test: 2});

        var s_request = request(solidus_server.router);
        s_request.get('/api/resource.json?url=https://a.solid.us/api-resource')
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) throw err;
            assert.deepEqual(res.body, {test: 2});
            done();
          });
      });
    });

    describe('no-cache request header', function() {
      it('adds no-cache headers to resources', function(done) {
        nock('https://solid.us').get('/cache?a=1').matchHeader('Cache-Control', 'no-cache').matchHeader('Pragma', 'no-cache').reply(200, {test: 1});
        nock('https://solid.us').get('/cache?a=2').matchHeader('Cache-Control', 'no-cache').matchHeader('Pragma', 'no-cache').reply(200, {test: 2});

        var s_request = request(solidus_server.router);
        s_request.get('/caching')
          .set('cache-control', 'no-cache')
          .expect(200)
          .end( function( err, res ){
            if( err ) throw err;
            done();
          });
      });

      it('adds no-cache headers to api resources', function(done) {
        nock('https://solid.us').get('/api-resource').matchHeader('Cache-Control', 'no-cache').matchHeader('Pragma', 'no-cache').reply(200, {test: 2});

        var s_request = request(solidus_server.router);
        s_request.get('/api/resource.json?url=https://solid.us/api-resource')
          .set('PRAGMA', 'no-cache')
          .expect(200)
          .end(function(err, res) {
            if (err) throw err;
            done();
          });
      });
    });
  });

  describe( 'development', function(){

    var solidus_server;

    beforeEach( function( done ){
      process.chdir( site2_path );
      solidus_server = solidus.start({
        log_level: -1,
        port: 9009,
        dev: true,
        livereload_port: 12345
      });
      // hack that will work until .start callback is complete
      solidus_server.on( 'ready', function(){
        setTimeout( done, FILESYSTEM_DELAY );
      });
    });

    afterEach( function(){
      solidus_server.stop();
      process.chdir( original_path );
    });

    it( 'Adds a route when a new view is added', function( done ){
      fs.writeFileSync( 'views/watch_test.hbs', 'test', DEFAULT_ENCODING );
      var s_request = request( solidus_server.router );
      setTimeout( function(){
        s_request.get('/watch_test').expect( 200, function( err ){
          if( err ) throw err;
          done();
        });
      }, FILESYSTEM_DELAY );
    });

    it( 'Removes a route when a view is removed', function( done ){
      fs.unlinkSync('views/watch_test.hbs');
      var s_request = request( solidus_server.router );
      setTimeout( function(){
        s_request.get('/watch_test').expect( 404, function( err ){
          if( err ) throw err;
          done();
        });
      }, FILESYSTEM_DELAY );
    });

    it( 'Adds redirects when redirects.js is added', function( done ){
      var s_request = request( solidus_server.router );
      var redirects_json = JSON.stringify([{"from": "/redirect1", "to": "/"}]);
      fs.writeFileSync( 'redirects.js', 'module.exports = ' + redirects_json, DEFAULT_ENCODING );
      setTimeout(function() {
        async.parallel([
          function(callback) {
            s_request.get('/redirect1').expect(302, callback);
          },
          function(callback) {
            s_request.get('/redirect2').expect(404, callback);
          },
        ], function(err) {
          if (err) throw err;
          done();
        });
      }, FILESYSTEM_DELAY);
    });

    it( 'Updates redirects when redirects.js changes', function( done ){
      var s_request = request( solidus_server.router );
      var redirects_json = JSON.stringify([{"from": "/redirect2", "to": "/"}]);
      fs.writeFileSync( 'redirects.js', 'module.exports = ' + redirects_json, DEFAULT_ENCODING );
      setTimeout(function() {
        async.parallel([
          function(callback) {
            s_request.get('/redirect1').expect(404, callback);
          },
          function(callback) {
            s_request.get('/redirect2').expect(302, callback);
          },
        ], function(err) {
          if (err) throw err;
          done();
        });
      }, FILESYSTEM_DELAY);
    });

    it( 'Removes redirects when redirects.js is deleted', function( done ){
      var s_request = request( solidus_server.router );
      fs.unlinkSync('redirects.js');
      setTimeout(function() {
        async.parallel([
          function(callback) {
            s_request.get('/redirect1').expect(404, callback);
          },
          function(callback) {
            s_request.get('/redirect2').expect(404, callback);
          },
        ], function(err) {
          if (err) throw err;
          done();
        });
      }, FILESYSTEM_DELAY);
    });

    var test_preprocessor_contents = 'module.exports=function(context){context.test = true;return context;};';

    it( 'Adds preprocessors when a preprocessor js file is added', function( done ){
      var s_request = request( solidus_server.router );
      fs.writeFileSync( 'preprocessors/test.js', test_preprocessor_contents, DEFAULT_ENCODING );
      setTimeout( function(){
        s_request.get('/test.json')
          .expect( 200 )
          .end( function( err, res ){
            if( err ) throw err;
            assert( res.body.test );
            fs.unlinkSync('preprocessors/test.js');
            done();
          });
      }, FILESYSTEM_DELAY );
    });

    var test_preprocessor_contents_2 = 'module.exports=function(context){context.test2 = true;return context;};';

    it( 'Updates preprocessors when their files change', function( done ){
      var s_request = request( solidus_server.router );
      fs.writeFileSync( 'preprocessors/test.js', test_preprocessor_contents_2, DEFAULT_ENCODING );
      setTimeout( function(){
        s_request.get('/test.json')
          .expect( 200 )
          .end( function( err, res ){
            if( err ) throw err;
            assert( res.body.test2 );
            done();
          });
      }, FILESYSTEM_DELAY );
    });

    it( 'Removes preprocessors when their file is removed', function( done ){
      fs.unlinkSync('preprocessors/test.js');
      var s_request = request( solidus_server.router );
      setTimeout( function(){
        s_request.get('/test.json')
          .expect( 200 )
          .end( function( err, res ){
            if( err ) throw err;
            assert( !res.body.test );
            done();
          });
      }, FILESYSTEM_DELAY );
    });

    var helpers_js = "module.exports={uppercase:function(string){return string+' is uppercase';}};";
    var helpers2_js = "module.exports={uppercase:function(string){return string+' is uppercase 2';}};";

    it( 'Adds helpers when helpers.js is added', function( done ){
      var s_request = request( solidus_server.router );
      fs.writeFileSync( 'helpers.js', helpers_js, DEFAULT_ENCODING );
      setTimeout( function(){
        s_request
          .get('/helpers')
          .end( function( err, res ){
            if( err ) throw err;
            assert( res.text.indexOf('Site helpers loaded is uppercase') > -1 );
            done();
          });
      }, FILESYSTEM_DELAY );
    });

    it( 'Updates helpers when helpers.js changes', function( done ){
      var s_request = request( solidus_server.router );
      fs.writeFileSync( 'helpers.js', helpers2_js, DEFAULT_ENCODING );
      setTimeout( function(){
        s_request
          .get('/helpers')
          .end( function( err, res ){
            if( err ) throw err;
            assert( res.text.indexOf('Site helpers loaded is uppercase 2') > -1 );
            done();
          });
      }, FILESYSTEM_DELAY );
    });

    it( 'Removes helpers when helpers.js is deleted', function( done ){
      var s_request = request( solidus_server.router );
      fs.unlinkSync('helpers.js');
      setTimeout( function(){
        s_request
          .get('/helpers')
          .end( function( err, res ){
            if( err ) throw err;
            assert( res.text.indexOf('Site helpers loaded is uppercase') == -1 );
            done();
          });
      }, FILESYSTEM_DELAY );
    });

    it( 'Passes dev variables to view context', function( done ){
      var s_request = request( solidus_server.router );
      s_request.get('/dev.json')
        .expect( 200 )
        .end( function( err, res ){
          if( err ) throw err;
          assert( res.body.dev );
          assert( res.body.development );
          assert.equal( 12345, res.body.livereload_port );
          done();
        });
    });

    it( 'Does not send cache headers in development', function( done ){
      var s_request = request( solidus_server.router );
      s_request.get('/dev')
        .expect('cache-control', 'no-cache, no-store, max-age=0, must-revalidate')
        .expect('x-robots-tag', 'noindex, nofollow')
        .end( function( err, res ){
          if( err ) throw err;
          done();
        });
    });

    it( 'Does not cache assets in development', function( done ){
      var s_request = request( solidus_server.router );
      s_request.get('/scripts/test.js')
        .expect( 'cache-control', 'public, max-age=0' )
        .end( function( err, res ){
          if( err ) throw err;
          done();
        });
    });

    it('Renders the default error response when error.hbs is missing', function(done) {
      var s_request = request(solidus_server.router);
      async.parallel([
        function(callback) {
          // 200 status and error in response message
          nock('https://solid.us').get('/error/mandatory?test=2').reply(200, {status: 'error', error: 'Could not find such a thing'});
          nock('https://solid.us').get('/error/optional?test=2').reply(200, {test: 2});
          s_request.get('/with_resource_error?test=2')
            .expect(404)
            .end(function(err, res) {
              assert.equal(res.text, '404 Not Found');
              callback(err);
            });
        },
        function(callback) {
          // Bad status
          nock('https://solid.us').get('/error/mandatory?test=3').reply(401, {error: 'Nice try'});
          nock('https://solid.us').get('/error/optional?test=3').reply(200, {test: 3});
          s_request.get('/with_resource_error?test=3')
            .expect(401)
            .end(function(err, res) {
              assert.equal(res.text, '401 Unauthorized');
              callback(err);
            });
        }
      ], function(err, results) {
        if (err) throw err;
        done();
      });
    });

  });

  describe('log server', function() {
    var solidus_server;

    beforeEach(function(done) {
      process.chdir(site1_path);
      solidus_server = solidus.start({
        dev: true,
        log_level: 0,
        port: 9009,
        log_server_port: 12345,
        log_server_level: 3
      });
      solidus_server.on('ready', done);
    });

    afterEach(function() {
      process.chdir(original_path);
    });

    it('Sends the logs to the web socket', function(done) {
      var socket = require('socket.io-client')('http://localhost:12345');
      socket.on('connect', function() {
        // Our web socket client is connected, make a Solidus request then close the server
        request(solidus_server.router).get('/helpers.json').end(function(err, res) {
          if (err) throw err;
          assert.equal(12345, res.body.log_server_port);
          solidus_server.stop();
        });
      });

      var last_message;
      socket.on('log', function(data) {
        // Solidus emitted a log message, store it
        last_message = data;
      });

      socket.on('disconnect', function() {
        // The log server was closed, we're done
        assert.equal(3, last_message.level);
        assert(/\/helpers \[200\] served in \d+ms/.test(last_message.message));
        done();
      });
    });
  });

  describe('Page.toObjectString', function() {
    var solidus_server;

    before(function(done) {
      process.chdir(site1_path);
      solidus_server = new SolidusServer({start_server: false});
      solidus_server.on('ready', done);
    });

    after(function() {
      process.chdir(original_path);
    });

    it('returns a JS string version of the parsed view', function(done) {
      var parent_file_path = path.join(solidus_server.paths.assets, 'scripts', 'index.js');
      var expected = '{resources:{"cache1":"https://solid.us/cache/1","cache2":"https://solid.us/cache/2"},preprocessor:require("../../preprocessors/index.js"),template:require("../../views/with_all_features.hbs"),template_options:{helpers:require("../../helpers.js"),partials:{"partial":require("../../views/partial.hbs"),"partial_holder":require("../../views/partial_holder.hbs"),"partial_holder2":require("../../views/partial_holder2.hbs"),"deeply/partial":require("../../views/deeply/partial.hbs")}}}';
      assert.equal(solidus_server.views[solidus_server.pathFromPartialName('with_all_features')].toObjectString(parent_file_path), expected);
      done();
    });

    it('with missing features', function(done) {
      var parent_file_path = path.join(solidus_server.paths.assets, 'scripts', 'index.js');
      var expected = '{template:require("../../views/partial.hbs"),template_options:{helpers:require("../../helpers.js")}}';
      assert.equal(solidus_server.views[solidus_server.pathFromPartialName('partial')].toObjectString(parent_file_path), expected);
      done();
    });
  });
});
