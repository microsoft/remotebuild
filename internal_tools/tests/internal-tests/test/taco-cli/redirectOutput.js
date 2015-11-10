var fs = require("fs");
var child_process = require("child_process");

var cmd = process.argv[2];
var stdout = process.argv[3];
var stderr = process.argv[4];

var proc = child_process.spawn(cmd, []);

proc.stdout.pipe(fs.createWriteStream(stdout));
proc.stderr.pipe(fs.createWriteStream(stderr));

process.on("SIGTERM", function () {
    proc.kill("SIGTERM");
    console.log("Killed by sigterm");
    process.exit(1);
})