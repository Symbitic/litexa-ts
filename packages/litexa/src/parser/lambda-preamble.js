/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import AWS from 'aws-sdk';

AWS.config.update({
  region: "us-east-1"
});

const dynamoDocClient = new AWS.DynamoDB.DocumentClient({
  convertEmptyValues: true,
  service: new AWS.DynamoDB({
      maxRetries: 5,
      retryDelayOptions: {
        base: 150
      },
      paramValidation: false,
      httpOptions: {
        agent: new (require('https').Agent)({ keepAlive: true })
      }
    })
});

const cloudWatch = new AWS.CloudWatch({
  httpOptions: {
    agent: new (require('https').Agent)({ keepAlive: true })
  }
});

const db = {
  fetchDB({ identity, dbKey, ttlConfiguration, fetchCallback }) {

    if (true) {
      const tableName = process.env.dynamoTableName;
      if (!tableName) {
        throw new Error(`Missing dynamoTableName in the lambda environment. Please set it to the \
DynamoDB table you'd like to use, in the same AWS account.`
        );
      }

      // we're using per application tables, already partitioned by deployment
      // so all we need here is the device identifier
      const DBKEY = dbKey != null ? dbKey : `${identity.deviceId}`;

      let params = {
        Key: {
          userId: DBKEY
        },
        TableName: tableName,
        ConsistentRead: true
      };

      //console.log 'fetching from DynamoDB : ' + JSON.stringify(params)
      return dynamoDocClient.get(params, function(err, data) {
        if (err) {
          console.error(`Unable to read from dynamo \
Request was: ${JSON.stringify(params, null, 2)} \
Error was: ${JSON.stringify(err, null, 2)}`
          );
          return fetchCallback(err, null);
        } else {
          //console.log "fetched from DB", JSON.stringify(data.Item)
          let clock, lastResponseTime;
          let wasInitialized = ((data.Item != null ? data.Item.data : undefined) != null);
          const backing = (data.Item != null ? data.Item.data : undefined) != null ? (data.Item != null ? data.Item.data : undefined) : {};
          if (data.Item != null) {
            clock = data.Item.clock != null ? data.Item.clock : 0;
            ({
              lastResponseTime
            } = data.Item);
          } else {
            clock = null;
            lastResponseTime = 0;
          }
          let dirty = false;
          var databaseObject = {
            isInitialized() { return wasInitialized; },
            initialize() { return wasInitialized = true; },
            read(key, markDirty) {
              if (markDirty) {
                dirty = true;
              }
              return backing[key];
            },
            write(key, value) {
              backing[key] = value;
              dirty = true;
            },
            finalize(finalizeCallback) {
              if (!dirty) {
                return setTimeout((() => finalizeCallback()), 1);
              }

              params = {
                TableName : tableName,
                Item: {
                  userId: DBKEY,
                  data: backing
                }
              };

              if (true) {
                if (clock != null) {
                  // item existed, conditionally replace it
                  if (clock > 0) {
                    params.ConditionExpression = "clock = :expectedClock";
                    params.ExpressionAttributeValues =
                      {":expectedClock": clock};
                  }
                  params.Item.clock = clock + 1;
                } else {
                  // item didn't exist, conditionally create it
                  params.ConditionExpression = "attribute_not_exists(userId)";
                  params.Item.clock = 0;
                }
              }

              const dispatchSave = function() {
                //console.log "sending #{JSON.stringify(params)} to dynamo"
                params.Item.lastResponseTime = (new Date()).getTime();

                if (((ttlConfiguration != null ? ttlConfiguration.AttributeName : undefined) != null) && ((ttlConfiguration != null ? ttlConfiguration.secondsToLive : undefined) != null)) {
                  params.Item[ttlConfiguration.AttributeName] = Math.round((params.Item.lastResponseTime/1000) + ttlConfiguration.secondsToLive);
                }

                return dynamoDocClient.put(params, function(err, data) {
                  if ((err != null ? err.code : undefined) === 'ConditionalCheckFailedException') {
                    console.log(`DBCONDITION: ${err}`);
                    databaseObject.repeatHandler = true;
                    err = null;
                  } else if (err != null) {
                    console.error(`DBWRITEFAIL: ${err}`);
                  }

                  return finalizeCallback(err, params);
                });
              };

              const space = (new Date()).getTime() - lastResponseTime;
              const requiredSpacing = databaseObject.responseMinimumDelay != null ? databaseObject.responseMinimumDelay : 500;
              if (space >= requiredSpacing) {
                return dispatchSave();
              } else {
                const wait = requiredSpacing - space;
                console.log(`DELAYINGRESPONSE Spacing out ${wait}, ${(new Date()).getTime()} ${lastResponseTime}`);
                return setTimeout(dispatchSave, wait);
              }
            }
          };

          return fetchCallback(null, databaseObject);
        }
      });

    } else {
      const mock = {};
      const databaseObject = {
        isInitialized() { return true; },
        read(key) { return mock[key]; },
        write(key, value) { return mock[key] = value; },
        finalize(cb) {
          return setTimeout(cb, 1);
        }
      };

      return setTimeout((() => fetchCallback(null, databaseObject)), 1);
    }
  }
};

const Entitlements = {
  fetchAll(event, stateContext, after) {
    let https;
    try {
      https = require('https');
    } catch (error) {
      // no https means no access to internet, can't do this
      console.log("skipping fetchEntitlements, no interface present");
      after();
      return;
    }

    const apiEndpoint = "api.amazonalexa.com";
    const apiPath     = "/v1/users/~current/skills/~current/inSkillProducts";
    const token = "bearer " + event.context.System.apiAccessToken;
    const language = "en-US";

    const options = {
      host: apiEndpoint,
      path: apiPath,
      method: 'GET',
      headers: {
        "Content-Type"      : 'application/json',
        "Accept-Language"   : language,
        "Authorization"     : token
      }
    };

    const req = https.get(options, res => {
      res.setEncoding("utf8");

      if (res.statusCode !== 200) {
        after(`failed to fetch entitlements, status code was ${res.statusCode}`);
        return;
      }

      let returnData = "";
      res.on('data', chunk => {
        return returnData += chunk;
      });

      return res.on('end', () => {
        stateContext.inSkillProducts = JSON.parse(returnData);
        stateContext.db.write("__inSkillProducts", stateContext.inSkillProducts);
        return after();
      });
    });

    return req.on('error', e => after('Error calling InSkillProducts API: '));
  }
};
