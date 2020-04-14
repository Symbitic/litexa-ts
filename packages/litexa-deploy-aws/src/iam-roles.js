/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import AWS from 'aws-sdk';

let logger = null;
let iam = null;

export function ensureIAMRole(context, roleInfo) {
  iam = new AWS.IAM;

  roleInfo.missingPolicies = [];
  roleInfo.extraneousPolicies = [];
  roleInfo.arn = null;
  roleInfo.roleNeededCreation = false;

  roleInfo.timestampName = `ensureIAMRole-${roleInfo.name}`;
  roleInfo.artifactName = `iamRole-${roleInfo.name}`;

  // rarely need to do this
  if (context.localCache.lessThanSince(roleInfo.timestampName, 240)) {
    logger.log(`skipping IAM role ${roleInfo.name}`);
    return Promise.resolve(context.artifacts.get(roleInfo.artifactName));
  }

  logger.log(`ensuring IAM role ${roleInfo.name}`);

  return getRoleStep(roleInfo)
  .catch(function(err) {
    if ((err != null ? err.code : undefined) !== 'NoSuchEntity') {
      throw err;
    }

    // no worries, create it first then
    return createRoleStep(roleInfo).then(() => getRoleStep(roleInfo));}).then(function(data) {
    roleInfo.arn = data.Role.Arn;
    const policy = decodeURIComponent(data.Role != null ? data.Role.AssumeRolePolicyDocument : undefined);
    if (policy !== JSON.stringify(roleInfo.trust)) {
      // oh, trust policy not right? No worries, right it first
      return updateAssumeRolePolicyStep(roleInfo).then(() => getPoliciesStep(roleInfo));
    } else {
      return getPoliciesStep(roleInfo);
    }}).then(() => reconcilePoliciesStep(roleInfo)).then(() => waitForRoleReadyStep(roleInfo)).then(function() {
    logger.log(`IAM Role ${roleInfo.name} ready`);
    context.artifacts.save(roleInfo.artifactName, roleInfo.arn);
    context.localCache.saveTimestamp(roleInfo.timestampName);
    return Promise.resolve(roleInfo.arn);}).catch(function(err) {
    logger.error(err);
    throw `Failed to fetch info for IAM role ${roleInfo.name}`;
  });
};

export function getRoleStep(roleInfo) {
  const params = { RoleName: roleInfo.name };
  return iam.getRole(params).promise();
};

export function createRoleStep(roleInfo) {
  logger.log(`creating IAM role ${roleInfo.name}`);
  roleInfo.roleNeededCreation = true;

  const params = {
    AssumeRolePolicyDocument: JSON.stringify(roleInfo.trust),
    RoleName: roleInfo.name,
    Description: roleInfo.description
  };
  return iam.createRole(params).promise();
};

export function updateAssumeRolePolicyStep(roleInfo) {
  logger.log(`updating IAM role ${roleInfo.name} assume role policy document`);

  const params = {
    PolicyDocument: JSON.stringify(roleInfo.trust),
    RoleName: roleInfo.name
  };
  return iam.updateAssumeRolePolicy(params).promise();
};

export function getPoliciesStep(roleInfo) {
  logger.log(`pulling attached policies for IAM role ${roleInfo.name}`);

  const params = { RoleName: roleInfo.name };

  return iam.listAttachedRolePolicies(params).promise()
  .then(data => {
    // enforce the required policies
    const policyInList = (list, arn) => {
      for (let p of list) { if (p.PolicyArn === arn) { return true; } }
      return false;
    };

    for (let required of roleInfo.policies) {
      if (!policyInList(data.AttachedPolicies, required.PolicyArn)) {
        roleInfo.missingPolicies.push(required);
      }
    }

    for (let policy of data.AttachedPolicies) {
      if (!policyInList(roleInfo.policies, policy.PolicyArn)) {
        roleInfo.extraneousPolicies.push(policy);
      }
    }

    return Promise.resolve();
  });
};

export function reconcilePoliciesStep(roleInfo) {
  let params, policy;
  const promises = [];

  const {
    missingPolicies
  } = roleInfo;
  const {
    extraneousPolicies
  } = roleInfo;

  for (policy of Array.from(missingPolicies)) {
    policy = missingPolicies.shift();
    logger.log(`adding policy ${policy.PolicyName}`);

    params = {
      PolicyArn: policy.PolicyArn,
      RoleName: roleInfo.name
    };
    promises.push(iam.attachRolePolicy(params).promise());
  }

  for (policy of Array.from(extraneousPolicies)) {
    policy = extraneousPolicies.shift();
    logger.log(`removing policy ${policy.PolicyName}`);

    params = {
      PolicyArn: policy.PolicyArn,
      RoleName: roleInfo.name
    };
    promises.push(iam.detachRolePolicy(params).promise());
  }

  if (promises.length > 0) {
    logger.log("reconciling IAM role policy differences");
  }

  return Promise.all(promises);
};

export function waitForRoleReadyStep(roleInfo) {
  if (!roleInfo.roleNeededCreation) {
    return Promise.resolve();
  }

  // using the arn immediately appears to fail, so
  // wait a bit, maybe accessing it successfully from
  // here means other services can see it?
  return new Promise(function(resolve, reject) {
    const params =
      {RoleName: roleInfo.name};

    var waitForReady = function() {
      logger.log("waiting for IAM role to be ready");
      return iam.getRole(params, function(err, data) {
        if (err != null) {
          return setTimeout(waitForReady, 1000);
        } else {
          return resolve();
        }
      });
    };

    return setTimeout(waitForReady, 10000);
  });
};

export function ensureLambdaIAMRole(context, overrideLogger) {
  logger = overrideLogger;
  context.lambdaIAMRoleName = "litexa_handler_lambda";

  const roleInfo = {
    name: context.lambdaIAMRoleName,
    trust: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            Service: "lambda.amazonaws.com"
          },
          Action: "sts:AssumeRole"
        }
      ]
    },

    policies: [
      { PolicyName: 'AWSLambdaBasicExecutionRole', PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'},
      { PolicyName: 'AmazonDynamoDBFullAccess', PolicyArn: 'arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess' },
      { PolicyName: 'CloudWatchFullAccess', PolicyArn: 'arn:aws:iam::aws:policy/CloudWatchFullAccess' }
    ],

    description: `A role for Litexa input handlers, generated by \
the package @litexa/deploy-aws`
  };

  return ensureIAMRole(context, roleInfo)
    .then(arn => {
      context.lambdaIAMRoleARN = arn;
      return Promise.resolve();
    });
};

export default {
  ensureLambdaIAMRole
};
