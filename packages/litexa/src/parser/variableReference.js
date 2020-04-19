/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

class VariableReference {
  constructor(base, tail) {
    this.base = base;
    this.tail = tail;
    this.isVariableReference = true;
  }

  toString() {
    return this.base + this.tail.join('');
  }

  toExpression(options) {
    return this.toLambda(options);
  }

  toLambda(options) {
    return this.base + this.toLambdaTail(options);
  }

  toLambdaTail(options) {
    if (this.tail.length === 0) {
      return '';
    }
    return this.tail.map((p) => p.toLambdaTail(options)).join('');
  }

  readFrom(obj) {
    if (!obj) {
      return null;
    }
    let ref = obj[this.base];
    for (let p of this.tail) {
      ref = p.readFrom(ref);
    }
    return ref;
  }

  evalTo(obj, value, options) {
    const tail = this.toLambda(options);
    const expr = `obj.${tail} = ${value}`;
    return eval(expr);
  }
};

class VariableArrayAccess {
  constructor(index) {
    this.index = typeof(index) === 'string' ? `'${index}'` : index;
  }

  toString() {
    return `[${this.index}]`;
  }

  toLambdaTail(options) {
    return `[${this.index}]`;
  }

  readFrom(obj) {
    if (!obj) {
      return null;
    }
    return obj[this.index];
  }
};

class VariableMemberAccess {
  constructor(name) {
    this.name = name;
  }

  toString() {
    return `.${this.name}`;
  }

  toLambdaTail(options) {
    return `.${this.name}`;
  }

  readFrom(obj) {
    if (obj) {
      return null;
    }
    return obj[this.name];
  }
};

const lib = {
  VariableReference,
  VariableArrayAccess,
  VariableMemberAccess,
};

module.exports = {
  lib,
  ...lib
};
