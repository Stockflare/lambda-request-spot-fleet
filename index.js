exports.handler = function (event, context) {

  console.log("REQUEST RECEIVED:\n", JSON.stringify(event));

  try {
    var oldProperties = event.OldResourceProperties;
    var properties = event.ResourceProperties;

    var aws = require("aws-sdk");
    var ec2 = new aws.EC2({ region: properties.Region });
    var s3 = new aws.S3({ region: properties.Region });

    switch(event.RequestType) {
      case "Delete":
        // Ω Delete the keyname listed in the property KeyName
        key.delete(ec2, properties, function(err, data) {
          if(err) console.log(err, err.stack);
          store.delete(s3, properties, function(err, data) {
            if(err) console.log(err, err.stack);
            sendResponse(event, context, "SUCCESS", {});
          })
        });
        break;
      case "Update":
        // Ω Has the KeyName changed?
        if(oldProperties.KeyName != properties.KeyName) {
          // Ω delete old key, create new key!
          key.create(ec2, properties, function(err, data) {
            if(err) {
              sendResponse(event, context, "ERROR", { reason: err.stack });
            } else {
              store.put(s3, data, properties, function(err, data) {
                var onFail = function() {
                  key.delete(ec2, properties, function(err, data) {
                    store.delete(s3, properties, function(){});
                  });
                };
                key.delete(ec2, oldProperties, function(err, data) {
                  if(err) {
                    onFail();
                    sendResponse(event, context, "ERROR", { reason: err.stack });
                  } else {
                    store.delete(s3, oldProperties, function(err, data) {
                      if(err) {
                        onFail();
                        sendResponse(event, context, "ERROR", { reason: err.stack });
                      } else {
                        sendResponse(event, context, "SUCCESS", {
                          Name: properties.KeyName
                        });
                      }
                    });
                  }
                });
              });
            }
          });
        } else {
          sendResponse(event, context, "SUCCESS", {
            Name: properties.KeyName
          });
        }
        break;
      case "Create":
        // Ω Create a keypair with name in KeyName
        key.create(ec2, properties, function(err, data) {
          if(err) {
            sendResponse(event, context, "ERROR", { reason: err.stack });
          } else {
            var key = keyName(properties);
            store.put(s3, data, properties, function(err, data) {
              if(err) {
                sendResponse(event, context, "ERROR", { reason: err.stack });
              } else {
                sendResponse(event, context, "SUCCESS", {
                  Name: properties.KeyName
                });
              }
            });
          }
        });
        break;
      default:
        throw "received unexpected request type (" + event.RequestType + ")";
    }
  } catch(e) {
    sendResponse(event, context, "ERROR", { reason: e });
  }
};

var key = {
  create: function(ec2, properties, fn) {
    console.log("Creating EC2 Keypair: " + properties.KeyName);
    ec2.createKeyPair({ KeyName: properties.KeyName }, fn);
  },

  delete: function(ec2, properties, fn) {
    console.log("Deleting EC2 Keypair: " + properties.KeyName);
    ec2.deleteKeyPair({ KeyName: properties.KeyName }, fn);
  }
};

var store = {
  put: function(s3, data, properties, fn) {
    var key = keyName(properties);
    console.log("Uploading Key to bucket: " + key);
    s3.putObject({
      Bucket: properties.Bucket,
      Key: key,
      Body: data.KeyMaterial
    }, fn);
  },

  delete: function(s3, properties, fn) {
    var key = keyName(properties);
    s3.deleteObject({
      Bucket: properties.Bucket,
      Key: key
    }, fn);
  }
}

var keyName = function(properties) {
  return 'ec2/' + properties.KeyName.toLowerCase() + '.pem'
};

//Sends response to the pre-signed S3 URL
var sendResponse = function(event, context, responseStatus, responseData) {
   var responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: responseData.reason || "See the details in CloudWatch Log Stream: " + context.logStreamName,
        PhysicalResourceId: context.logStreamName,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: responseData
    });

    console.log("RESPONSE BODY:\n", responseBody);

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
            "content-length": responseBody.length
        }
    };

    var request = https.request(options, function(response) {
        console.log("STATUS: " + response.statusCode);
        console.log("HEADERS: " + JSON.stringify(response.headers));
        context.done();
    });

    request.on("error", function(error) {
        console.log("sendResponse Error:\n", error);
        context.done();
    });

    // write data to request body
    request.write(responseBody);
    request.end();
};
