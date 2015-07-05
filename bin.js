#!/usr/bin/env node

var Sasster = require('./');
var argv = require('yargs')
    .usage('Usage: sasster <source> <dest> --cwd [str] --imagePath [str] --outputStyle [str] --sourceMap [bool] -c [str] -w [bool]')
    .describe('cwd', 'Current Working Directory, [required]')
    .describe('imagePath', 'Path to image directory')
    .describe('outputStyle', 'Style of output CSS (compress, nested, expanded)')
    .describe('sourceMap', 'Whether to generate source maps')
    .alias('c', 'config')
    .describe('c', 'Path to custom config')
    .alias('w', 'watch')
    .describe('w', 'Whether to watch source directory')
    .help('h')
    .alias('h', 'help')
    .argv;

var e = Sasster(null, argv);
e.start();
