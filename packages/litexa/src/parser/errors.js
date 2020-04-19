/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

class ParserError extends Error {
  constructor(location, message) {
    super();
    this.location = location;
    this.message = message;
    this.isParserError = true;
  }
};

function formatLocationStart(location) {
  if (location == null) {
    return "unknown location";
  }
  const l = location;
  if(l.source && l.start && l.start.line && l.start.offset) {
    return `${l.source}[${l.start.line}:${l.start.column}]`;
  } else if (l.start && l.start.line && l.start.offset) {
    return `unknownFile[${l.start.line}:${l.start.column}`;
  } else if (l.source) {
    return `${l.source}[?:?]`;
  } else {
    return "unknown location";
  }
}

const lib = {
  ParserError,
  formatLocationStart
};

module.exports = {
  lib
};
