var child_process = require("child_process");
var os = require("os");
var path = require("path");
var assert = require("assert");

// var node = process.argv[0]
// var thisFile = process.argv[1]
var tacoPath = process.argv[2] + (os.platform() === "win32" ? ".cmd" : "");
var platform = process.argv[3];
var serverAddress = process.argv[4];
var serverPort = process.argv[5];
var serverPin = process.argv[6] || "";

var proc = child_process.spawn(tacoPath.split("/").join(path.sep), ["remote", "add", platform]);

var step = 0;
proc.stdout.on("data", function (data) {
    data = data.toString();
    console.info(data.toString());
    if (data.indexOf("IP") >= 0) {
        assert(step === 0);
        step++;
        proc.stdin.write(serverAddress + os.EOL);
    } else if (data.indexOf("Port") >= 0) {
        assert(step === 1);
        step++;
        proc.stdin.write(serverPort + os.EOL);
    } else if (data.indexOf("PIN") >= 0) {
        assert(step === 2);
        step++;
        proc.stdin.write(serverPin + os.EOL);
    } else if (data.indexOf("Success!") >= 0) {
        assert(step === 3);
        proc.stdin.end();
    }
});

proc.on("error", function (err) {
    console.error(err);
    process.exit(1);
});
proc.on("exit", function (code) {
    process.exit(code);
});

setTimeout(function () {
    console.error("Timed out configuring remote");
    process.exit(2);
}, 30000);
