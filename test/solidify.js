var assert = require('assert');
var path = require('path');
var solidify = require('../solidify.js');
var transformTools = require('browserify-transform-tools');

var original_path = __dirname;
var site1_path = path.join(original_path, 'fixtures', 'site 1');
var dummyJsFile = path.join(site1_path, 'assets', 'scripts', 'index.js');

describe('Solidify transform', function() {
  before(function(done) {
    process.chdir(site1_path);
    done();
  });

  after(function() {
    process.chdir(original_path);
  });

  it('replaces required views with their JS version', function(done) {
    var content = 'var a = require("solidus/views/dynamic/{segment}");';
    var expected = 'var a = {template:require("../../views/dynamic/{segment}.hbs"),template_options:{helpers:require("../../helpers.js")}};'
    transformTools.runTransform(solidify, dummyJsFile, {content: content}, function(err, transformed) {
      assert.ifError(err);
      assert.equal(transformed, expected);
      done();
    });
  });

  it('with multiple requires', function(done) {
    var content = 'var a = require("solidus/views/dynamic/{segment}");var b = require("solidus/views/dynamic/{segment}.js");var c = require("solidus/views/partial");';
    var expected = 'var a = {template:require("../../views/dynamic/{segment}.hbs"),template_options:{helpers:require("../../helpers.js")}};var b = {template:require("../../views/dynamic/{segment}.hbs"),template_options:{helpers:require("../../helpers.js")}};var c = {template:require("../../views/partial.hbs"),template_options:{helpers:require("../../helpers.js")}};'
    transformTools.runTransform(solidify, dummyJsFile, {content: content}, function(err, transformed) {
      assert.ifError(err);
      assert.equal(transformed, expected);
      done();
    });
  });

  it('with view using partial from extra package', function(done) {
    var content = 'var a = require("solidus/views/partial_holder3");';
    var expected = 'var a = {template:require("../../views/partial_holder3.hbs"),template_options:{helpers:require("../../helpers.js"),partials:{"partial":require("../../views/partial.hbs"),"extra/partial":require("../../node_modules/extra/partial.hbs"),"extra/conflict":require("../../views/extra/conflict.hbs")}}};'
    transformTools.runTransform(solidify, dummyJsFile, {content: content}, function(err, transformed) {
      assert.ifError(err);
      assert.equal(transformed, expected);
      done();
    });
  });

  it('with bad extension', function(done) {
    var content = 'var a = require("solidus/views/partial.hbs");var b = require("solidus/views/partial.html");';
    transformTools.runTransform(solidify, dummyJsFile, {content: content}, function(err, transformed) {
      assert.ifError(err);
      assert.equal(transformed, content);
      done();
    });
  });

  it('with bad name', function(done) {
    var content = 'var a = require("solidus/views/wrong");';
    transformTools.runTransform(solidify, dummyJsFile, {content: content}, function(err, transformed) {
      assert.ifError(err);
      assert.equal(transformed, content);
      done();
    });
  });
});
