'use strict';

var fs = require('fs');
var path = require('path');
var events = require('events');
var Readable = require('stream').Readable;
var File = require('vinyl');
var sass = require('node-sass');
var neat = require('node-neat');
var Promise = require('bluebird');
var chokidar = require('chokidar');
var glob = require('glob');
var assign = require('object-assign');
var importRegex = require('import-regex');
var chalk = require('chalk');
chalk.enabled = true;

function defaultOptions() {
  return {
    imagePath: 'img',
    outputStyle: 'nested',
    sourceMap: false,
    includePaths: [],
    chokidar: false,
    watch: false
  };
}

function Sasster(options) {
  var self = this;
  this.files = [];
  this.main_files = {};
  this.all_files = {};
  this.throttling = {};

  this.verifyRequiredProps(options, function(props) {
    self.options = assign({}, defaultOptions(), props);
    
    // @TODO: make this a config option only
    self.options.includePaths = self.options.includePaths.concat(neat.includePaths);

    self.cwd = props.cwd || false;
    self.src = props.src;
    self.dest = props.dest;
    self.ext = path.extname(props.src);
    self.basePath = (!!props.cwd) ? path.resolve(props.cwd) : process.cwd();
    self.writeToFile = props.writeToFile || false;
    self.streams = props.streams || false;
    self.logger = props.logger || console;
  });
}

Sasster.prototype = new events.EventEmitter;

Sasster.prototype.start = function() {
  var end, self = this;
  var start = new Date().getTime();

  if (this.logger === console) {
    this.logger.log(chalk.bold(
      'Starting Sasster...\n'
    ));
  }

  return this.glob(this.src, this.cwd).then(function(filesArr) {
    return self.buildImportMap(filesArr).then(function(fileMap) {
      return Promise.all(Object.keys(fileMap)
        .filter(function(src) {
          return (fileMap.hasOwnProperty(src));
        })
        .map(function(src) {
          if (self.options.watch) {
            return src;
          }

          return self.compileSass(src).then(function(output) {

            if (!self.streams) {
              self.logger.log(output);
            }

            return output;
          }).catch(self.logger.log);
        })
      ).then(function(output) {

        if (!self.options.watch) {
          end = new Date().getTime();
          self.logger.log('Finished compiling all in %s seconds\n', (end - start) / 1000);
        }
        else {
          self.logger.log('Watching files for changes...\n');

          self.watch();
        }

        return output;
      }).catch(self.logger.log);
    }).catch(self.logger.log);
  }).catch(self.logger.log);
};

/**
 * Verify required properties
 * @param {Object} props
 * @param {Function} callback
 */
Sasster.prototype.verifyRequiredProps = function(props, callback) {
  if (!props.hasOwnProperty('src')) {
    throw new Error('Missing property "src" in Sasster config');
  }
  else if (!props.hasOwnProperty('dest') && !props.streams) {
    throw new Error('Missing property "dest" in Sasster config');
  }
  else {
    callback(props);
  }
};

Sasster.prototype.glob = function(src, cwd) {
  var self = this;

  return new Promise(function(resolve, reject) {
    glob(src, { cwd: cwd || self.cwd || process.cwd() }, function(err, files) {
      if (err) {
        reject(err);
      }
      else {
        resolve(files);
      }
    });
  });
};

Sasster.prototype.recompileSass = function(file) {
  var self = this;

  if (this.throttling[file]) {
    return;
  }

  this.throttling[file] = true;

  if (file.charAt(0) === '/') {
    file = file.replace(this.basePath + '/', '');
  }
  else if (~file.indexOf(this.cwd)) {
    var cwd = this.cwd;

    if (this.cwd.slice(-1) !== '/') {
      cwd += '/';
    }

    file = file.replace(cwd, '');
  }

  this.logger.log(chalk.yellow('modified ') + file);

  // Check if file has any new imports, then compile any
  // files that depend on the current file
  return self.buildImportMap([file]).then(function(fileMaps) {
    return Promise.all(Object.keys(fileMaps)
      .filter(function(src) {
        return (fileMaps.hasOwnProperty(src) && (~fileMaps[src].indexOf(file) || file === src));
      })
      .map(function(src) {
        return self.compileSass(src).then(function(output) {
          if (!self.streams) {
            self.logger.log(output);
          }
          delete self.throttling[file]
          return output;
        }).catch(function(err) {
          delete self.throttling[file]
          self.logger.log(err);
        });
      })
    ).then(function() {
      // need this last throttle removal
      // incase the partial is saved before
      // it's imported
      delete self.throttling[file]
    }).catch(self.logger.log);
  }).catch(self.logger.log);
}

Sasster.prototype.compileSass = function(src) {
  var self = this;
  var css_file = this.dest + '/' + path.basename(src).replace(/.s[a,c]ss/, '.css');

  return new Promise(function(resolve, reject) {
    sass.render({
      file: this.basePath + '/' + src,
      imagePath: this.options.imagePath,
      outputStyle: this.options.outputStyle,
      outFile: css_file,
      sourceMap: this.options.sourceMap,
      sourceMapContents: true,
      includePaths: this.options.includePaths
    }, function(err, results) {
      if (err) {
        if (!err.file) {
          return reject(chalk.red('ERR: ' + err.message));
        }

        return reject(chalk.red('ERR: ' + err.file + ':' + err.line + '\n   ' + err.message));
      }

      self.writeResultsToFileOrStream(css_file, results).then(resolve);
    });
  }.bind(this));
};

Sasster.prototype.compileSassContents = function(src, files) {
  var self = this;
  var filepath, contents;
  var fileObj = files.filter(function(file) {
    return ~file.filepath.indexOf(src);
  });

  if (!fileObj.length) {
    return Promise.resolve();
  }
  else {
    filepath = fileObj[0].filepath;
    contents = fileObj[0].contents;
  }
  var css_file = this.dest + '/' + path.basename(src).replace(/.s[a,c]ss/, '.css');

  var includePaths = this.options.includePaths || [];
  includePaths.unshift(path.dirname(filepath));

  return new Promise(function(resolve, reject) {
    sass.render({
      data: contents,
      imagePath: this.options.imagePath,
      outputStyle: this.options.outputStyle,
      outFile: css_file,
      sourceMap: this.options.sourceMap,
      sourceMapContents: true,
      includePaths: includePaths
    }, function(err, results) {
      if (err) {
        if (!err.file) {
          return reject(chalk.red('ERR: ' + err.message));
        }

        return reject(chalk.red('ERR: ' + err.file + ':' + err.line + '\n   ' + err.message));
      }

      self.writeResultsToFileOrStream(css_file, results).then(resolve);
    });
  }.bind(this));
};

Sasster.prototype.writeResultsToFileOrStream = function(filename, results) {
  var self = this;
  var cssStream, cssStreamFile, sourceMapStream, sourceMapStreamFile, streamObj, seconds;

  return new Promise(function(resolve, reject) {
    seconds = (results.stats.duration/1000) % 60;

    if (self.streams) {
      cssStream = new Readable({ objectMode: true });
      cssStreamFile = new File({
        path: path.basename(filename),
        contents: new Buffer(results.css)
      });
      cssStream.push(cssStreamFile);
      cssStream.push(null);

      streamObj = {
        filename: path.basename(filename),
        css: cssStream,
        time: seconds
      };

      if (!!self.options.sourceMap) {
        sourceMapStream = new Readable({ objectMode: true });
        sourceMapStreamFile = new File({
          path: path.basename(filename) + '.map',
          contents: new Buffer(results.map)
        });
        sourceMapStream.push(sourceMapStreamFile);
        sourceMapStream.push(null);

        streamObj.sourceMapFilename = path.basename(filename) + '.map';
        streamObj.sourceMap = sourceMapStream;
      }

      self.emit('compiled', streamObj);

      return resolve(streamObj);
    }

    if (!self.writeToFile) {
      return resolve(results);
    }

    // write compiled scss file
    fs.writeFile(filename, results.css, function(err) {
      if (err) {
        return reject(err);
      }

      // write source map
      if (!self.options.sourceMap) {
        resolve(chalk.green('created ') + filename + ' time: ' + seconds + ' seconds ');
      }
      else {
        fs.writeFile(filename + '.map', results.map, function(err) {
          if (err) {
            return reject(err);
          }

          resolve(chalk.green('created ') + filename + ' time: ' + seconds + ' seconds ');
        });
      }
    });
  })
};

Sasster.prototype.watch = function() {
  var self = this;
  var opts = this.options.chokidar || {};
  opts.cwd = opts.cwd || this.basePath;

  if (typeof opts.usePolling === 'undefined') {
    opts.usePolling = true;
  }

  if (typeof this.src !== 'string') {
    this.src = this.src.map(function(filepath) {
      if (~filepath.indexOf(self.basePath)) {
        filepath = filepath.replace(self.basePath, '');

        if (filepath.charAt(0) === '/') {
          filepath = filepath.substr(1);
        }
      }

      return filepath;
    });
  }

  chokidar.watch(this.src, opts).on('all', function(event, filepath) {
    if (event === 'change') {
      if (!!self.streams) {
        self.getMainFromChanged(filepath).then(function(src) {
          self.emit('modified', src);
        });
      }
      else {
        self.recompileSass(filepath);
      }
    }
  });
};

Sasster.prototype.getMainFromChanged = function(file) {
  var self = this;

  if (this.throttling[file]) {
    return;
  }

  this.throttling[file] = true;

  if (file.charAt(0) === '/') {
    file = file.replace(this.basePath + '/', '');
  }
  else if (~file.indexOf(this.cwd)) {
    var cwd = this.cwd;

    if (this.cwd.slice(-1) !== '/') {
      cwd += '/';
    }

    file = file.replace(cwd, '');
  }

  this.logger.log(chalk.yellow('modified ') + file);

  // Check if file has any new imports, then compile any
  // files that depend on the current file
  return self.buildImportMap([file]).then(function(fileMaps) {
    return Promise.all(Object.keys(fileMaps)
      .filter(function(src) {
        return (fileMaps.hasOwnProperty(src) && (~fileMaps[src].indexOf(file) || file === src));
      })
      .map(function(src) {
        delete self.throttling[file]
        return src;
      })
    ).then(function(src) {
      // need this last throttle removal
      // incase the partial is saved before
      // it's imported
      delete self.throttling[file]
      return src;
    }).catch(self.logger.log);
  }).catch(self.logger.log);
}

Sasster.prototype.readFile = function(file) {
  return new Promise(function(resolve, reject) {
    fs.readFile(file, 'utf8', function(err, data) {
      if (err) {
        return reject(err);
      }

      return resolve(data);
    });
  });
};

Sasster.prototype.buildImportMap = function(filesArr) {
  var self = this;
  var commentsRe = /(\/\*([\s\S]*?)\*\/)|(\/\/(.*)$)/gm;

  return new Promise(function(resolve, reject) {
    Promise.all(filesArr
      .map(function(filepath) {
        if (typeof filepath === 'object') {
          filepath = filepath.filepath;
        }

        var filename = path.basename(filepath);

        if (~filepath.indexOf(self.basePath)) {
          filepath = filepath.replace(self.basePath, '');

          if (filepath.charAt(0) === '/') {
            filepath = filepath.substr(1);
          }
        }

        self.all_files[filepath] = [];

        // if the file isn't a partial, add it to the
        // main files array
        if (filename.charAt(0) !== '_') {
          self.main_files[filepath] = [];
        }

        return self.readFile(self.basePath + '/' + filepath).then(function(data) {
          // strip comments before checking for imports
          data = data.replace(commentsRe, '');

          var imports = data.match(importRegex());

          if (!imports) {
            return false;
          }

          return Promise.all(imports
            .map(function(import_statement) {
              var split = /@import (.*?);$/gi.exec(import_statement);
              var import_filename = split[1];

              // strip quotes from filename
              import_filename = import_filename.replace(/(\'|\")/g, '');

              // format partial to realpath
              var n = import_filename.lastIndexOf('/');
              import_filename = import_filename.substr(0, n + 1) + '_' + import_filename.substr(n + 1) + self.ext;

              // Add base dir to the filename so mapping doesn't break if no CWD used
              var baseDir = path.dirname(filepath);

              if (baseDir !== '.') {
                import_filename = path.dirname(filepath) + '/' + import_filename;
              }

              // Normalize relative path imports
              if (~import_filename.indexOf('..')) {
                import_filename = path.normalize(import_filename);
              }

              // store array of imports
              self.all_files[filepath].push(import_filename);

              if (self.main_files[filepath]) {
                self.main_files[filepath].push(import_filename);
              }

              return import_filename;
            })
          );
        });
      })
    ).then(function() {
      Promise.all(Object.keys(self.all_files)
        .filter(function(file) {
          return (self.all_files.hasOwnProperty(file));
        })
        .map(function(file) {
          return Promise.all(Object.keys(self.main_files)
            .filter(function(main_file) {
              return (self.main_files.hasOwnProperty(main_file) &&
                ~self.main_files[main_file].indexOf(file) &&
                  self.all_files[file].length);
            })
            .map(function(main_file) {
              self.main_files[main_file] = self.main_files[main_file].concat(self.all_files[file]);
              return self.main_files;
            })
          );
        })
      ).then(function(main_files) {
        Promise.all(main_files
          .filter(function(files) {
            return files.length;
          })
          .map(function(files) {
            return files[0];
          })
        ).then(function(files) {
          if (!files.length) {
            resolve(self.main_files);
          }
          else {
            resolve(files[0]);
          }
        }).catch(self.logger.log);
      });
    }).catch(reject);
  });
};

module.exports = Sasster;
