/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const { ParserError, formatLocationStart } = require('./errors');

// blacklist a set of references we know we don't want shadowed
// anywhere, or rather know we want to allow access to
const protectedNames = ['context'];

class Scope {
  constructor(location, name, parent) {
    this.location = location;
    this.name = name;
    this.parent = parent;
    this.tempCounter = (parent && parent.tempCounter) || 0;
    this.variables = {};
  }

  newTemporary(location) {
    const name = `_tmp${this.tempCounter}`;
    this.tempCounter += 1;
    this.variables[name] = { origin: location };
    return name;
  }

  get(name) {
    if (name in this.variables) {
      return this.variables[name];
    }
    if (this.parent) {
      return this.parent.get(name);
    }
    return null;
  }

  checkAllocate(location, name) {
    if (protectedNames.includes(name)) {
      throw new ParserError(location, `cannot create a new variable named \`${name}\` here, as it is a protected name that already exists. Please choose a different name.`);
    }

    if (name in this.variables) {
      const v = this.variables[name];
      throw new ParserError(location, `cannot create a new variable named \`${name}\` here, as a previous one was already defined at ${formatLocationStart(v.origin)}`);
    }

    if (typeof this.referenceTester === 'function' ? this.referenceTester(name) : undefined) {
      throw new ParserError(location, `cannot create a new variable named \`${name}\` here, as the name already exists in your inline code.`);
    }

    return this.parent && this.parent.checkAllocate(location, name);
  }

  allocate(location, name) {
    this.checkAllocate(location, name);
    this.variables[name] =
      { origin: location };
    return true;
  }

  checkAccessParent(location, name) {
    if (!this.parent) {
      throw new ParserError(location, `cannot access local variable \`${name}\` as it hasn't been declared yet. Did you mean to create a new variable here with the \`local\` statement?`);
    }

    if (name in this.parent.variables) {
      this.parent.variables[name].accesedByDescendant = true;
      return true;
    }

    if (typeof this.parent.referenceTester === 'function' ? this.parent.referenceTester(name) : undefined) {
      return true;
    }

    return this.parent.checkAccessParent(location, name);
  }

  checkAccess(location, name) {
    if (Array.from(protectedNames).includes(name)) {
      return true;
    }

    if (name in this.variables) {
      return true;
    }

    if (typeof this.referenceTester === 'function' ? this.referenceTester(name) : undefined) {
      return true;
    }

    return this.checkAccessParent(location, name);
  }

  hasDescendantAccess() {
    for (let k in this.variables) {
      const v = this.variables[k];
      if (v.accesedByDescendant) {
        return true;
      }
    }

    return false;
  }
};

class VariableScopeManager {
  constructor(location, name) {
    // default root scope
    this.currentScope = new Scope(location, name, null);
    this.scopes = [this.currentScope];
  }

  depth() {
    return this.scopes.length;
  }

  pushScope(location, name) {
    // creates a new scope, new added variables will exist at this level
    // but names can be resolved all the way to the root
    const scope = new Scope(location, name, this.currentScope);
    this.currentScope = scope;
    return this.scopes.push(scope);
  }

  popScope() {
    // lowest scope is discarded, contents are expected to be
    // unreferenced from here on
    if (!(this.scopes.length > 1)) {
      throw new ParserError(this.scopes[0].location, 'cannot popScope on root scope');
    }

    this.scopes.pop();
    return this.currentScope = this.scopes[this.scopes.length - 1];
  }

  newTemporary(location) {
    return this.currentScope.newTemporary(location);
  }

  allocate(location, name) {
    return this.currentScope.allocate(location, name);
  }

  checkAccess(location, name) {
    return this.currentScope.checkAccess(location, name);
  }
};

module.exports = {
  VariableScopeManager
};
