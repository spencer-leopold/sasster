var path = require('path');
var chai = require('chai');
var chaiAsPromised = require("chai-as-promised");
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var expect = chai.expect;
var should = chai.should();
var Sasster = require('../../index');

chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('lib/mundler', function() {

  var testConfig = {
    cwd: 'test/',
    src: 'fixtures/**/*.scss',
    dest: 'test/output',
    imagePath: "img",
    outputStyle: "nested"
  };

  var testConfigNoCwd = {
    src: 'fixtures/**/*.scss',
    dest: 'test/output',
    imagePath: "img",
    outputStyle: "nested"
  };

  var testConfigMissingSrc = {
    dest: 'test/output',
    imagePath: "img",
    outputStyle: "nested"
  };

  var testConfigMissingDest = {
    src: 'fixtures/**/*.scss',
    imagePath: "img",
    outputStyle: "nested"
  };

  describe('Sasster', function() {
    var s;

    beforeEach(function() {
      s = Sasster(testConfig);
    });

    afterEach(function() {
      s = null;
    });

    describe('#glob()', function() {

      it('should return a promise with an array of files', function() {
        return s.glob(path.resolve('test') + '/**/*.js').should.eventually.have.length(3);
      });

      it('should reject with an error if not found', function() {
        return s.glob(path.resolve('nonExistentTest') + '/**/*.js').should.reject;
      });

    });

    describe('#readFile()', function() {

      it('should return a promise with the value of the contents of a file if found', function() {
        return s.readFile(path.resolve('test/helpers/testConfig.js')).should.eventually.deep.equal("module.exports = {\n  cwd: \'test/\',\n  src: \'fixtures/**/*.scss\',\n  dest: \'test/output\',\n  imagePath: \'img\',\n  outputStyle: \'nested\'\n};\n");
      });

      it('should reject with an error if not found', function() {
        return s.readFile(path.resolve('test/helpers/nonExistent.js')).should.be.rejectedWith("ENOENT");
      });

    });

    describe('#verifyRequiredProps()', function() {
      it('should reject if no "src" is configured', function() {
        expect(function() {
          return s.verifyRequiredProps(testConfigMissingSrc);
        }).to.throw('Missing property "src" in Sasster config');
      });

      it('should reject if no "dest" is configured', function() {
        expect(function() {
          return s.verifyRequiredProps(testConfigMissingDest)
        }).to.throw('Missing property "dest" in Sasster config');
      });
    });

    describe('#start()', function() {
    });

    describe('#compileSass()', function() {
      it('should reject with an error if it fails to compile', function() {
        return s.compileSass('fixtures/fail_to_compile.scss').should.be.rejected;
      });

      it('should compile cleanly', function() {
        return s.compileSass('fixtures/test_main.scss').should.not.be.rejected;
      });
    });

    describe('#watch()', function() {
    });

    describe('#buildImportMap()', function() {
      it('should return an import map object', function(done) {
        s.glob('fixtures/**/*.scss').then(function(files) {
          s.buildImportMap(files).then(function(map) {
            map.should.deep.equal({
              'fixtures/fail_to_compile.scss': [],
              'fixtures/test_main.scss': [ 'fixtures/_test_partial.scss', 'fixtures/_test_partial2.scss' ]
            });
            done();
          }).catch(done);
        }).catch(done);
      });
    });
  });
});
