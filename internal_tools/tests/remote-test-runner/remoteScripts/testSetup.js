// This script needs to be pre-installed on each VM that is intended to be used for automated tests. It needs to be automatically run when the VM starts.

var child_process = require("child_process");
var http = require("http");
var path = require("path");
var Q = require("q");
var querystring = require("querystring");

// Constants
var HOST_IP = "HOST-IP-GOES-HERE";  // Modify with the host machine's IP (the machine that is creating the VM)
var HOST_PORT = "53541";            // Modify if this default port cannot be used (whether this is changed or not, the value still needs to be indicated in the remote-test-runner test config)
var REMOTEBUILD_PORT = "3000";      // Modify if this default port cannot be used (no need to do anything else, the port will be communicated to the host machine automatically)

// Main promise chain
Q({})
	.then(function () {
		// Start remotebuild with the test agent on this VM
		// Note: This assumes remotebuild and taco-test-agent are installed in the same folder as this script, under node_modules/
		var deferred = Q.defer();
		var command = path.join(__dirname, "node_modules", ".bin", "remotebuild");
		var args = [
			"--secure=false",
			"--port=" + REMOTEBUILD_PORT,
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
	    var qs = querystring.stringify({ port: REMOTEBUILD_PORT });
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
		host: HOST_IP,
		port: HOST_PORT,
		path: urlPath
	};
	var req = !!callback ? http.request(options, callback) : http.request(options); 
	
	req.end();
}
