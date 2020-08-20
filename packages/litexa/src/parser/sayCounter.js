/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

// keeps a total counter while expressing randomized
// statements to give each a unique ID

let counter = 1;

export function reset() {
  return counter = 1;
}

export function get() {
  const val = counter;
  counter += 1;
  return val;
}

export default {
  reset,
  get
};
