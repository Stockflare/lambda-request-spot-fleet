exports.handler = function (event, context) {

  console.log("REQUEST RECEIVED:\n", JSON.stringify(event));

  try {
    var properties = event.ResourceProperties;
    var fleet = properties.Fleet;
    var physicalResourceId = event.PhysicalResourceId;

    var aws = require("aws-sdk");
    var cfn = require("./cfn");
    var ec2 = new aws.EC2({ region: properties.Region });

    switch(event.RequestType) {
      case "Delete":
        spot.delete(ec2, physicalResourceId, function(err, data) {
          if(err) console.log(err, err.stack);
          cfn.response(event, context, cfn.SUCCESS, {});
        });
        break;
      case "Update":
        var oldFleet = event.OldResourceProperties.Fleet;
        if(JSON.stringify(oldFleet) != JSON.stringify(fleet)) {
          spot.delete(ec2, physicalResourceId, function(err, data) {
            if(err) {
              console.log(err, err.stack);
              cfn.response(event, context, cfn.FAILED, { Reason: err });
            } else {
              spot.create(ec2, fleet, function(err, data) {
                if(err) {
                  cfn.response(event, context, cfn.FAILED, { Reason: err });
                } else {
                  var id = data.spotFleetRequestId;
                  cfn.response(event, context, cfn.SUCCESS, { PhysicalResourceId: id });
                }
              });
            }
          });
        } else {
          cfn.response(event, context, cfn.SUCCESS, {});
        }
        break;
      case "Create":
        spot.create(ec2, fleet, function(err, data) {
          if(err) {
            console.log(err, err.stack);
            cfn.response(event, context, cfn.FAILED, { Reason: err });
          } else {
            var id = data.SpotFleetRequestId;
            cfn.response(event, context, cfn.SUCCESS, { PhysicalResourceId: id });
          }
        });
        break;
      default:
        throw "received unexpected request type (" + event.RequestType + ")";
    }
  } catch(e) {
    console.log("Caught Error: \n", e);
    cfn.response(event, context, cfn.FAILED, { Reason: e });
  }
};

var spot = {
  create: function(ec2, fleet, fn) {
    console.log("Requesting (CREATE) RequestSpotFleet: \n" + JSON.stringify(fleet));
    return ec2.requestSpotFleet({ SpotFleetRequestConfig: fleet }, fn)
  },

  delete: function(ec2, id, fn) {
    console.log("Requesting (DELETE) RequestSpotFleet: " + id);
    return ec2.cancelSpotFleetRequests({ SpotFleetRequestIds: [id], TerminateInstances: true }, fn);
  }
};
