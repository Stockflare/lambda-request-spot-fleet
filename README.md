# EC2 RequestSpotFleet

| Staging | Production |
|:-:|:-:|
|[![Build Status](http://drone.stocktio.com/api/badge/github.com/Stockflare/lambda-request-spot-fleet/status.svg?branch=master)](http://drone.stocktio.com/github.com/Stockflare/lambda-request-spot-fleet)| --- |

This Lambda function integrates into AWS Cloudformation in-order to provide a CustomResource for requesting, updating and cancelling spot fleet requests.

At Stockflare, we use hundreds of configurations to maintain the state of our ECS Clusters, using the lowest possible EC2 Instance prices. This function, via AWS's brilliant RequestSpotFleet EC2 function, provides that functionality.

The following example describes this functions usage within a Cloudformation. Here, we're using it to launch an ECS Cluster running on Spot Instances.

```
"SpotFleet": {
  "Type": "Custom::SpotFleet",
  "Properties": {
    "ServiceToken": { "Ref" : "SpotFleetArn" },
    "Fleet": {
      "SpotPrice": "2.80",
      "TargetCapacity": "5",
      "IamFleetRole": {"Fn::GetAtt" : ["IamFleetRole", "Arn"] },
      "LaunchSpecifications" : [
        {
          "ImageId": { "Ref" : "ImageId" },
          "SecurityGroups": [{ "GroupId": "sg-223b284e" }],
          "InstanceType": "m3.medium",
          "SubnetId": { "Fn::GetAtt" : ["Network", "PrivateSubnetA" ] },
          "IamInstanceProfile": { "Fn::GetAtt" : ["InstanceProfile", "Arn"] },
          "UserData" : { "Fn::Base64" : { "Fn::Join" : ["", [
            "#!/bin/bash\n",
            "echo ECS_CLUSTER=", { "Ref" : "ECSCluster" }, " >> /etc/ecs/ecs.config\n",
            "start ecs"
          ]]}}
        }
      ]
    }
  }
},
```

**Note:** In-order to reduce the size of the example, some of the properties are being referenced from elsewhere...