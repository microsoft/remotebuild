var fs = require("fs");
var path = require("path");

// Find all the packages
var packages = fs.readdirSync(__dirname).map(function (entry) {
    return path.join(__dirname, entry);
}).filter(function (fullPath) {
    return fs.statSync(fullPath).isDirectory();
});

var pathRegex = /"file:.*[\\\/]([-a-zA-Z]*)(\.tgz|)"/g;

// Update the local file path dependencies to point to the current location
packages.forEach(function (fullPath) {
    var dynamicDepPath = path.join(fullPath, "dynamicDependencies.json");
    var packageJsonPath = path.join(fullPath, "package.json");
    if (fs.existsSync(dynamicDepPath)) {
	var dynamicDepContents = fs.readFileSync(dynamicDepPath).toString();
	fs.writeFileSync(
	    dynamicDepPath,
	    dynamicDepContents.replace(pathRegex, function (string, name) {
		return JSON.stringify("file://" + path.join(__dirname, name));
	    })
	);
    }

    if (fs.existsSync(packageJsonPath)) {
	var packageJsonContents = fs.readFileSync(packageJsonPath).toString();
	fs.writeFileSync(
	    packageJsonPath,
	    packageJsonContents.replace(pathRegex, function (string, name) {
		return JSON.stringify("file://" + path.join(__dirname, name));
	    })
	);
    }
});
