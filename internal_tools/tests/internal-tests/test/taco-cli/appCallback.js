var http = require("http");
var url = require("url");

var timeout = setTimeout(function () {
    console.error("Timed out waiting for app callback");
    process.exit(1);
}, parseInt(process.argv[2], 10) || 60000);

var server = http.createServer(function (req, res) {
    var parsedUrl = url.parse(req.url);
    console.info(req.url);
    if (req.method === "GET" && parsedUrl.pathname === "/deviceready") {
        res.end();
        process.exit(0);
    }
    if (parsedUrl.pathname === "/failure") {
        console.error(req.url);
        process.exit(1);
    }
});

server.listen(TACO_APP_CALLBACK_PORT);
console.info("Listening on TACO_APP_CALLBACK_PORT");