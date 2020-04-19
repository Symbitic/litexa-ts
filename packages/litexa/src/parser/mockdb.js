/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const DBInterface = require('./dbInterface');

class MockDB {
  constructor() {
    this.identities = {};
  }

  reset() {
    return this.identities = {};
  }

  getVariables(identity) {
    const DBKEY = `${identity.deviceId}|${identity.requestAppId}`;
    this.identities[DBKEY] = this.identities[DBKEY] != null ? this.identities[DBKEY] : {};
    return JSON.parse(JSON.stringify(this.identities[DBKEY]));
  }

  setVariables(identity, data) {
    const DBKEY = `${identity.deviceId}|${identity.requestAppId}`;
    this.identities[DBKEY] = JSON.parse(JSON.stringify(data));
  }

  fetchDB({ identity, fetchCallback }) {
    const DBKEY = `${identity.deviceId}|${identity.requestAppId}`;
    const database = new DBInterface;
    if (DBKEY in this.identities) {
      database.initialize();
      database.variables = JSON.parse(JSON.stringify(this.identities[DBKEY]));
    }

    database.finalize = finalizeCallback => {
      // enable this to test the concurrency loop in the handler
      //database.repeatHandler = Math.random() > 0.7
      if (!database.repeatHandler) {
        this.identities[DBKEY] = JSON.parse(JSON.stringify(database.variables));
      }
      return setTimeout(finalizeCallback, 1);
    };

    return setTimeout((() => fetchCallback(null, database)), 1);
  }
};

module.exports = MockDB;
