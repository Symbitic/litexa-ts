/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import skills from './skill';

if (typeof window !== 'undefined') {
  window.litexa = window.litexa ? window.litexa : {};
  window.litexa.files = window.litexa.files ? window.litexa.files : {};
  for (let k in skills) {
    const v = skills[k];
    window.litexa[k] = v;
  }
} else {
  self.litexa = self.litexa ? self.litexa : {};
  self.litexa.files = self.litexa.files ? self.litexa.files : {};
  for (let k in skills) {
    const v = skills[k];
    self.litexa[k] = v;
  }
}
