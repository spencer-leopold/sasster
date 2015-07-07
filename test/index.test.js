var path = require('path');
var chai = require('chai');
var chaiAsPromised = require("chai-as-promised");
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var expect = chai.expect;
var should = chai.should();
var Sasster = require('../');

chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('init', function() {
  var testConfig = {
    cwd: 'test/',
    src: 'fixtures/**/*.scss',
    dest: 'test/output',
    imagePath: "img",
    outputStyle: "nested"
  };

  it('should accept an object being passed in', function() {
    var s = Sasster(testConfig);

    for (prop in testConfig) {
      s.options[prop].should.deep.equal(testConfig[prop]);
    }
  });

  it('should accept a config file path as a argument', function() {
    var s = Sasster(null, { config: './test/helpers/testConfig.js' });

    for (prop in testConfig) {
      s.options[prop].should.deep.equal(testConfig[prop]);
    }
  });

  it('should throw an error if the first argument is not an object', function() {
    var spy = sinon.spy(Sasster);

    expect(function() {
      var s = Sasster(['test']);
    }).to.throw('Sasster options must be an object');
  });

  it('should throw an error if config path argument cannot be found', function() {
    var spy = sinon.spy(Sasster);

    expect(function() {
      Sasster(null, { config: './helpers/testConfig.js' });
    }).to.throw("Cannot find module './helpers/testConfig.js'");
  });

  it('should throw an error if it cannot find a sasster.config.js or a sasster property in package.json', function() {
    var spy = sinon.spy(Sasster);

    expect(function() {
      Sasster(null);
    }).to.throw("Cannot find sasster.config.js configuration");
  });
});
