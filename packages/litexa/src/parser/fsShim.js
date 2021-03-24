/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

export function readFileSync(filename) {
  if (!(filename in litexa.files)) {
    throw `FSSHIM: Missing file ${filename}`;
  }
  return litexa.files[filename];
}
