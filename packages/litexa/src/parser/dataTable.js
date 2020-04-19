/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const whiteSpaceRegex = /(^\s*)|(\s*$)/g;

function stripWhiteSpace(str) {
 return str ? str.replace(whiteSpaceRegex, '').replace(/\s/g, '\u00A0') : '';
};

class DataTable {
  constructor(name, schema) {
    this.name = name;
    this.schema = schema;
    this.rows = [];
    this.isDataTable = true;
  }

  pushRow(values) {
    const item = {};
    for (let idx = 0; idx < values.length; idx++) {
      const value = values[idx];
      item[this.schema[idx]] = stripWhiteSpace(value);
    }
    return this.rows.push(item);
  }

  toLambda(output, options) {
    let name;
    let lines = [];

    for (let idx = 0; idx < this.rows.length; idx++) {
      const row = this.rows[idx];
      const line = [];
      for (name of Array.from(this.schema)) {
        line.push("'" + row[name] + "'");
      }
      lines.push("  [" + line.join(', ') + "]");
    }

    lines = lines.join(",\n  ");
    output.push(`dataTables['${this.name}'] = [\n  ${lines}\n];`);
    return output.push(`Object.setPrototypeOf( dataTables['${this.name}'], DataTablePrototype );`);
  }
};

const lib = {
  DataTable
};

module.exports = {
  lib,
  ...lib
};
