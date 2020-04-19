/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

module.exports.fetchAll = function(event, stateContext, after) {
  if (stateContext.inSkillProducts.inSkillProducts == null) {
    stateContext.inSkillProducts.inSkillProducts = [];
  }
  after();
};
