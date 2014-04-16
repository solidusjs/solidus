var assert = require('assert');
var timekeeper = require('timekeeper');
var CachedResource = require('../lib/cached_resource.js');

describe( 'CachedResource', function(){
	var request_time; // When the request was sent
	var response_time; // When the response was received
	var response;

	beforeEach(function() {
		var now = new Date(1397524638000); // Test date rounded to the second, to simplify comparisons
		timekeeper.freeze(now);

		request_time = now.getTime();
		response_time = now.getTime();
		response = {headers: {date: now.toUTCString()}};
	});

	afterEach(function() {
		timekeeper.reset();
	});

	describe( '.constructor()', function(){
		it('sets expires_at to 60 seconds when no caching headers', function() {
			expires_at = new CachedResource({response: response, data: null, request_time: request_time, response_time: response_time}).expires_at;

			assert.equal(60 * 1000, expires_at - new Date().getTime());
		});

		it('sets expires_at to s-maxage when present', function() {
			response.headers['cache-control'] = 's-maxage=100';
			expires_at = new CachedResource({response: response, data: null, request_time: request_time, response_time: response_time}).expires_at;

			assert.equal(100 * 1000, expires_at - new Date().getTime());
		});

		it('sets expires_at to max-age when present', function() {
			response.headers['cache-control'] = 'max-age=100';
			expires_at = new CachedResource({response: response, data: null, request_time: request_time, response_time: response_time}).expires_at;

			assert.equal(100 * 1000, expires_at - new Date().getTime());
		});

		it('sets expires_at to expires when present', function() {
			response.headers['expires'] = new Date(request_time + 100 * 1000).toUTCString();
			expires_at = new CachedResource({response: response, data: null, request_time: request_time, response_time: response_time}).expires_at;

			assert.equal(100 * 1000, expires_at - new Date().getTime());
		});

		it('sets expires_at to s-maxage when s-maxage, max-age and expires present', function() {
			response.headers['cache-control'] = 'max-age=100,s-maxage=200';
			response.headers['expires'] = new Date(request_time + 300 * 1000).toUTCString();
			expires_at = new CachedResource({response: response, data: null, request_time: request_time, response_time: response_time}).expires_at;

			assert.equal(200 * 1000, expires_at - new Date().getTime());
		});

		it('sets expires_at to max-age when max-age and expires present', function() {
			response.headers['cache-control'] = 'max-age=200';
			response.headers['expires'] = new Date(request_time + 300 * 1000).toUTCString();
			expires_at = new CachedResource({response: response, data: null, request_time: request_time, response_time: response_time}).expires_at;

			assert.equal(200 * 1000, expires_at - new Date().getTime());
		});

		it('deducts time since Date from expires_at when Age not present', function() {
			var now = new Date().getTime();
			request_time = now;

			// +3 second delay until request is processed
			timekeeper.freeze(now += 3 * 1000);
			response = {headers: {date: new Date(now).toUTCString(), 'cache-control': 'max-age=100'}};

			// +5 second delay until response is received
			timekeeper.freeze(now += 5 * 1000);
			response_time = now;

			// +7 second delay until response is processed
			timekeeper.freeze(now += 7 * 1000);
			expires_at = new CachedResource({response: response, data: null, request_time: request_time, response_time: response_time}).expires_at;

			assert.equal((100 - (5 + 7)) * 1000, expires_at - new Date().getTime());
		});

		it('deducts Age and response delay from expires_at when Age present', function() {
			var now = new Date().getTime();
			request_time = now;

			// +3 second delay until request is processed
			// Response is already 30 seconds old
			timekeeper.freeze(now += 3 * 1000);
			response = {headers: {date: new Date(now - 30 * 1000).toUTCString(), 'cache-control': 'max-age=100', age: '30'}};

			// +5 second delay until response is received
			timekeeper.freeze(now += 5 * 1000);
			response_time = now;

			// +7 second delay until response is processed
			timekeeper.freeze(now += 7 * 1000);
			expires_at = new CachedResource({response: response, data: null, request_time: request_time, response_time: response_time}).expires_at;

			assert.equal((100 - (30 + 3 + 5 + 7)) * 1000, expires_at - new Date().getTime());
		});
	});

	describe( '.expired()', function(){
		it('returns whether expires_at is in the past', function() {
			response.headers['cache-control'] = 'max-age=0';
			var cached_resource = new CachedResource({response: response, data: null, request_time: request_time, response_time: response_time});

			assert(cached_resource.expired());
		});
	});

	describe( '.lock()', function(){
		it('prevents locking before .unlock()', function() {
			var cached_resource = new CachedResource({response: response, data: null, request_time: request_time, response_time: response_time});

			assert(cached_resource.lock());
			assert(!cached_resource.lock());
			cached_resource.unlock();
			assert(cached_resource.lock());
		});

		it('prevents locking before 30 seconds', function() {
			var cached_resource = new CachedResource({response: response, data: null, request_time: request_time, response_time: response_time});

			assert(cached_resource.lock());
			assert(!cached_resource.lock());
			timekeeper.freeze(new Date().getTime() + 40 * 1000);
			assert(cached_resource.lock());
		});
	});
});