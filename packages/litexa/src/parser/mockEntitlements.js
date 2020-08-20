/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

export function fetchAll(event, stateContext, after) {
  if (stateContext.inSkillProducts.inSkillProducts == null) {
    stateContext.inSkillProducts.inSkillProducts = [];
  }
  after();
}
