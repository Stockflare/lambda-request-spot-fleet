exports.handler = function (event, context) {

  console.log("REQUEST RECEIVED:\n", JSON.stringify(event));

  try {
    // retrieve all request properties
    var properties = event.ResourceProperties;
    // grab properties
    var fleet = properties.Fleet;
    var shared = properties.Shared;
    var variants = properties.Variants;
    // retrieve ID of existing RequestSpotFleet (if one exists..)
    var physicalResourceId = event.PhysicalResourceId;

    // init libraries
    var aws = require("aws-sdk");
    var cfn = require("./cfn");
    // create EC2 object using Region defined in Properties
    // TODO: Can region be obtained elsewhere?
    var ec2 = new aws.EC2({ region: properties.Region });

    // inject shared properties into variants (where missing)
    for(var i in variants) for(var attrname in shared) {
      var obj = variants[i][attrname];
      if( ! obj) variants[i][attrname] = shared[attrname];
    }

    // set launch specifications
    fleet.LaunchSpecifications = variants;

    // switch statement for request type
    switch(event.RequestType) {
      case "Delete":
        // delete existing spot fleet request (if one exists)
        spot.delete(ec2, physicalResourceId, function(err, data) {
          if(err) console.log(err, err.stack);
          // always return SUCCESS regardless of error
          cfn.response(event, context, cfn.SUCCESS, {});
        });
        break;
      case "Update":
      // delete existing spot fleet request
      spot.delete(ec2, physicalResourceId, function(err, data) {
        if(err) {
          // error occurred, log and FAIL
          console.log(err, err.stack);
          cfn.response(event, context, cfn.FAILED, { Reason: err.stack });
        } else {
          // no error, old RequestSpotFleet cancelled, create new one
          spot.create(ec2, fleet, function(err, data) {
            if(err) {
              // error occurred, log and fail
              cfn.response(event, context, cfn.FAILED, { Reason: err.stack });
            } else {
              // retrieve ID for RequestSpotFleet request.
              var id = data.SpotFleetRequestId;
              // set PhysicalResourceId to the ID of the Spot Fleet request
              cfn.response(event, context, cfn.SUCCESS, { PhysicalResourceId: id });
            }
          });
        }
      });
        break;
      case "Create":
        // create RequestSpotFleet using Fleet definition
        spot.create(ec2, fleet, function(err, data) {
          if(err) {
            // error occurred, log and FAIL with stack.
            console.log(err, err.stack);
            cfn.response(event, context, cfn.FAILED, { Reason: err.stack });
          } else {
            // retrieve ID, send SUCCESS and commit ID to PhysicalResourceId
            var id = data.SpotFleetRequestId;
            cfn.response(event, context, cfn.SUCCESS, { PhysicalResourceId: id });
          }
        });
        break;
      default:
        // unknown request type... (should never happen)
        throw "received unexpected request type (" + event.RequestType + ")";
    }
  } catch(e) {
    // an exception was caught, FAIL and log reason
    console.log("Caught Error: \n", e);
    cfn.response(event, context, cfn.FAILED, { Reason: e });
  }
};

var spot = {
  create: function(ec2, fleet, fn) {
    // log create request and execute. pass function into callback
    console.log("Requesting (CREATE) RequestSpotFleet: \n" + JSON.stringify(fleet));
    return ec2.requestSpotFleet({ SpotFleetRequestConfig: fleet }, fn)
  },

  delete: function(ec2, id, fn) {
    // log delete request and execute, pass function into callback
    console.log("Requesting (DELETE) RequestSpotFleet: " + id);
    return ec2.cancelSpotFleetRequests({ SpotFleetRequestIds: [id], TerminateInstances: true }, fn);
  }
};
