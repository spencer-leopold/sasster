[![travis-ci status](https://api.travis-ci.org/spencer-leopold/sasster.png)](http://travis-ci.org/#!/spencer-leopold/sasster/builds)
[![Dependency Status](https://david-dm.org/spencer-leopold/sasster.png)](https://david-dm.org/spencer-leopold/sasster)
[![Coverage Status](https://coveralls.io/repos/spencer-leopold/sasster/badge.png)](https://coveralls.io/r/spencer-leopold/sasster)

# Sasster

This module compiles SCSS/SASS to CSS using libsass. The main difference between it and others is that there is a watch option that will only re-compile files that need to be, rather than re-compiling everything after every change.

## Setup

Configuration can either be added directly into your package.json, or you can create a sasster.config.js file in order to use some of the additional features.

# Install

With [npm](http://npmjs.org) do:

```
npm install -D sasster
```

# Usage

```
Usage: sasster <source> <dest> --cwd [str] --imagePath [str] --outputStyle [str] --sourceMap [bool] -c [str] -w [bool]

Options:

    --cwd           Path to the Current Working Directory, useful when using
                    globs in the <source> option

    --imagePath     Path to your image directory

    --outputStyle   Change the generated CSS output, default is nested

    --sourceMap     Boolean, whether or not to generate source maps

    --config, -c    Path to a custom configuration file.

    --watch, -w     A bundle name to watch. You can repeat 
                    this option for each bundle you want to
                    watch.
```

# Example
_using standalone_ 

```
  $ sasster -w
```

# Configuration using package.json

```
...
  "sasster": {
    "cwd": "src/scss"
    "src": "**/*.scss",
    "dest": "dist/css"
    "imagePath": "img",
    "outputStyle": "nested",
    "sourceMap": true
  }
...
  "scripts": {
    "clean": "rimraf dist/css/*",
    "watch:styles": "sasster -w",
    "build:styles": "npm run clean && sasster --sourceMaps=false --outputStyle=compressed",
    "dev": "npm run watch:styles",
    "prod": "npm run build:styles"
  }
```

# Example
_using the above package.json_

```
  $ npm run dev
```

# Configuration using sasster.config.js

_(in your project's root)_

```
var bourbon = require('node-bourbon');

module.exports = {
  cwd: 'src/scss'
  src: '**/*.scss',
  dest: 'dist/css'
  imagePath: 'img',
  outputStyle: 'nested',
  sourceMap: true,
  includePaths: bourbon.includePaths
}
```