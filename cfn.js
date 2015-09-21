exports.SUCCESS = "SUCCESS";

exports.FAILED = "FAILED";

exports.response = function(event, context, status, obj) {
  obj = obj || {};

  obj.Reason = obj.Reason || "See the details in CloudWatch Log Stream: " + context.logStreamName;

  var body = {
    Status: status,
    PhysicalResourceId: event.PhysicalResourceId || context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: {}
  };

  for (var attrname in obj) { body[attrname] = obj[attrname]; }

  body = JSON.stringify(body);

  if(event.ResponseURL != "DEVELOPMENT") {
    var https = require("https");
    var url = require("url");

    var parsedUrl = url.parse(event.ResponseURL);
    var options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path,
      method: "PUT",
      headers: {
        "content-type": "",
        "content-length": body.length
      }
    };

    var request = https.request(options, function(response) {
      console.log("Status code: " + response.statusCode);
      console.log("Status message: " + response.statusMessage);
      context.done();
    });

    request.on("error", function(error) {
      console.log("send(..) failed executing https.request(..): " + error);
      context.done();
    });

    request.write(body);
    request.end();
  } else {
    context.done(body);
  }
};
