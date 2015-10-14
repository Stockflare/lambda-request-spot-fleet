# EC2 RequestSpotFleet

| Staging | Production |
|:-:|:-:|
|[![Build Status](http://drone.stocktio.com/api/badge/github.com/Stockflare/lambda-request-spot-fleet/status.svg?branch=master)](http://drone.stocktio.com/github.com/Stockflare/lambda-request-spot-fleet)| --- |

This Lambda function integrates into AWS Cloudformation in-order to provide a CustomResource for requesting, updating and cancelling spot fleet requests.

At Stockflare, we use hundreds of configurations to maintain the state of our ECS Clusters, using the lowest possible EC2 Instance prices. This function, via AWS's brilliant RequestSpotFleet EC2 function, provides that functionality.

The following example describes this functions usage within a Cloudformation. Here, we're using it to launch an ECS Cluster running on Spot Instances.

```

"IamFleetRole" : {
  "Type": "AWS::IAM::Role",
  "Properties": {
    "AssumeRolePolicyDocument": {
      "Version" : "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {
          "Service": [ "spotfleet.amazonaws.com" ]
        },
        "Action": [ "sts:AssumeRole" ]
      }]
    },
    "Path": "/",
    "Policies": [
      {
        "PolicyName": "EC2SpotPermissionAndPassRole",
        "PolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Action": [
                 "ec2:DescribeImages",
                 "ec2:DescribeSubnets",
                 "ec2:RequestSpotInstances",
                 "ec2:TerminateInstances"
              ],
              "Resource": ["*"]
            },
            {
              "Effect": "Allow",
              "Action": [
                 "iam:PassRole"
              ],
              "Resource": ["*"]
            }
          ]
        }
      }
    ]
  }
},

"SpotFleet": {
  "Type": "Custom::SpotFleet",
  "Properties": {
    "ServiceToken": { "Ref" : "SpotFleetArn" },
    "Region" : { "Ref" : "AWS::Region" },
    "Shared" : {
      "ImageId": { "Ref" : "ImageId" },
      "InstanceType": "m4.large",
      "SecurityGroups": [{ "GroupId": "sg-223b284e" }],
      "IamInstanceProfile": { "Arn" : { "Fn::GetAtt" : ["InstanceProfile", "Arn"] } },
      "UserData" : { "Fn::Base64" : { "Fn::Join" : ["", [
        "#!/bin/bash\n",
        "echo ECS_CLUSTER=", { "Ref" : "ECSCluster" }, " >> /etc/ecs/ecs.config\n",
        "start ecs"
      ]]}}
    },
    "Variants" : [
      {
        "SubnetId": { "Fn::GetAtt" : ["Network", "PrivateSubnetA" ] }
      },
      {
        "SubnetId": { "Fn::GetAtt" : ["Network", "PrivateSubnetB" ] }
      },
      {
        "SubnetId": { "Fn::GetAtt" : ["Network", "PrivateSubnetC" ] }
      }
    ],
    "Fleet": {
      "SpotPrice": "0.02",
      "TargetCapacity": "5",
      "IamFleetRole": {"Fn::GetAtt" : ["IamFleetRole", "Arn"] }
    }
  }
},
```

**Note:** In-order to reduce the size of the example, some of the properties are being referenced from elsewhere...

### Reference

The `Fleet` object key is passed directly into the RequestSpotFleet call. The structure of this call can be found here:

http://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_RequestSpotFleet.html

### Troubleshooting

If the resource builds successfully, but you're not seeing any "Spot Requests" on the EC2 Console, grab the `PhysicalResourceId` that the resource has created and run the following command:

```
$ aws ec2 describe-spot-fleet-request-history --spot-fleet-request-id <PhysicalResourceId>
```
