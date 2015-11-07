var fs = require("fs");
var tar = require("tar");
var zlib = require("zlib");

var from = process.argv[2];
var to = process.argv[3];

fs.createReadStream(from).pipe(zlib.createGunzip()).pipe(tar.Extract({ path: to, strip: 1, filter: function (who) { who.props.mode = 511; return true; }}));