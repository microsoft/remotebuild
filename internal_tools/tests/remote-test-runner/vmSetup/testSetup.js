var child_process = require("child_process");
var http = require("http");
var path = require("path");
var Q = require("q");
var querystring = require("querystring");
var util = require("util");

// Constants
var SETTINGS_FILE_NAME = "settings.json";
var REMOTEBUILD_DEFAULT_PORT = "3000";

// Global variables
var hostIp;
var hostPort;
var remotebuildPort;

// Main promise chain
Q({})
    .then(function () {
        // Read the settings file
        var settingsFilePath = path.join(__dirname, SETTINGS_FILE_NAME);

        // Read the file
        var settings;

        try {
            settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
        }
        catch (err) {
            throw new Error(util.format("Error: Error reading the settings file:%s%s", os.EOL, err.message));
        }

        // There must at least be a hostIp and a hostPort properties
        if (!settings.hasOwnProperty("hostIp")) {
            throw new Error("Error: The settings file does not contain a 'hostIp' property; please indicate what is the host machine's hostname or IP address");
        }

        if (!settings.hasOwnProperty("hostPort")) {
            throw new Error("Error: The settings file does not contain a 'hostPort' property; please indicate on which port the host machine is listening for VM communications");
        }

        // Save the host info
        hostIp = settings.hostIp;
        hostPort = settings.hostPort;

        // The settings file can specify a port on which to start remotebuild, so look for that
        if (settings.hasOwnProperty("remotebuildPort")) {
            remotebuildPort = settings.remotebuildPort;
        }
    })
	.then(function () {
	    // Start remotebuild with the test agent on this VM
	    // Note: This assumes remotebuild and taco-test-agent are installed in the same folder as this script, under node_modules/
	    var deferred = Q.defer();
	    var command = path.join(__dirname, "node_modules", ".bin", "remotebuild");
	    var args = [
			"--secure=false",
			"--port=" + remotebuildPort,
			"--config",
			path.join(__dirname, "node_modules", "taco-test-agent", "testAgentConfig.conf")
	    ];
	    var options = {
	        stdio: "inherit",
	    };
	    var cp = child_process.spawn(command, args, options);

	    cp.on("error", function (err) {
	        deferred.reject(err);
	    });

	    cp.on("exit", function (code) {
	        if (code) {
	            deferred.reject(new Error("remotebuild exited with code: " + code));
	        }
	    });

	    // Give remotebuild time to fail (in case of port in use, etc)
	    setTimeout(function () { deferred.resolve() }, 3000);

	    return deferred.promise;
	})
	.then(function () {
	    // Contact host test server to let it know we are listening, and give Remotebuild's port
	    var qs = querystring.stringify({ port: remotebuildPort });
	    var urlPath = "/listening?" + qs;

	    sendRequest(urlPath);
	})
	.catch(function (err) {
	    sendError(err);
	})
	.done();

function sendError(err) {
    var qs = querystring.stringify({ error: encodeURIComponent(err.toString()) });
    var urlPath = "/error?" + qs;

    console.log(err.toString());
    sendRequest(urlPath);
}

function sendRequest(urlPath, callback) {
    var options = {
        host: hostIp,
        port: hostPort,
        path: urlPath
    };
    var req = !!callback ? http.request(options, callback) : http.request(options);

    req.end();
}
