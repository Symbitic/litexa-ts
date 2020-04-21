/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

function searchReplace(stringTemplate, templateValues) {
  let data = stringTemplate;
  for (let key in templateValues) {
    const value = templateValues[key];
    const match = new RegExp(`\\{${key}\\}`, 'g');
    data = data.replace(match, value);
  }

  return data;
};

module.exports = searchReplace;
