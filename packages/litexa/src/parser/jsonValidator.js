/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

class ValidationError {
  constructor(parameter, message, value) {
    this.parameter = parameter;
    this.message = message;
    this.value = value;
  }

  toString() {
    if (typeof(this.value) === 'string') {
      return `${this.parameter}: '${this.value}'; ${this.message}`;
    } else if (typeof(this.value) === 'object') {
      return `${this.parameter}: ${JSON.stringify(this.value)}; ${this.message}`;
    } else {
      return `${this.parameter}: ${this.value}; ${this.message}`;
    }
  }
}


const formatParameter = function(p) {
  if (p === '') {
    return '';
  }
  if (typeof(p) === 'number') {
    return `[${p}]`;
  }
  p = '' + p;
  if (p.match(/[\.\s]/g)) {
    return `[\"${p}\"]`;
  }
  return `.${p}`;
};

class JSONValidator {
  // This class is  designed to discover and record problems with a JSON object
  constructor(jsonObject) {
    this.jsonObject = jsonObject;
    this.reset();
  }

  reset() {
    this.prefix = '';
    this.prefixStack = [];
    return this.errors = [];
  }

  push(prefix, subRoutine) {
    let p;
    this.prefixStack.push(prefix);
    this.prefix = ((() => {
      const result = [];
       for (p of Array.from(this.prefixStack)) {         result.push(formatParameter(p));
      }
      return result;
    })()).join('');
    const newValue = this.getValue('')[1];
    if (newValue) {
      subRoutine();
    } else {
      this.fail(prefix, "missing required object");
    }
    this.prefixStack.pop();
    return this.prefix = ((() => {
      const result1 = [];
       for (p of Array.from(this.prefixStack)) {         result1.push(formatParameter(p));
      }
      return result1;
    })()).join('');
  }

  fail(parameter, message) {
    let value;
    const loc = `${this.prefix}${formatParameter(parameter)}`;
    try {
      value = eval(`this.jsonObject${loc}`);
    } catch (error) {
      value = undefined;
    }
    return this.errors.push(new ValidationError(loc, message, value));
  }

  failNoValue(parameter, message) {
    const loc = `${this.prefix}${formatParameter(parameter)}`;
    return this.errors.push(new ValidationError(loc, message, null));
  }

  badKey(parameter, key, message) {
    const loc = `this.jsonObject${this.prefix}${formatParameter(parameter)}]`;
    return this.errors.push(new ValidationError(loc, message, `'${key}'`));
  }

  strictlyOnly(parameters) {
    this.require(parameters);
    return this.whiteList(parameters);
  }

  require(parameters) {
    const [loc, value] = Array.from(this.getValue(''));
    if (!value) {
      this.errors.push(new ValidationError(loc, `expected an object with parameters [${parameters.join(', ')}]`));
      return;
    }
    if (typeof(parameters) === 'string') {
      if (!(parameters in value)) {
        return this.fail(parameters, "missing required parameter");
      }
    } else {
      return (() => {
        const result = [];
        for (let p of Array.from(parameters)) {
          if (!(p in value)) {
            result.push(this.fail(p, "missing required parameter"));
          } else {
            result.push(undefined);
          }
        }
        return result;
      })();
    }
  }

  whiteList(parameters) {
    const [loc, value] = Array.from(this.getValue(''));
    return (() => {
      const result = [];
      for (let k in value) {
        const v = value[k];
        if (!Array.from(parameters).includes(k)) {
          result.push(this.errors.push(new ValidationError(`${loc}.${k}`, 'unsupported parameter')));
        } else {
          result.push(undefined);
        }
      }
      return result;
    })();
  }

  integerBounds(parameter, min, max) {
    const [loc, value] = Array.from(this.getValue(parameter));
    if ((value == null) || (typeof(value) !== 'number') || (Math.floor(value) !== value)) {
      this.errors.push(new ValidationError(loc, `should be an integer between ${min} and ${max}, inclusive`, value));
      return;
    }
    if (!(min <= value && value <= max)) {
      this.errors.push(new ValidationError(loc, `should be between ${min} and ${max}, inclusive`, value));
      return;
    }
  }

  oneOf(parameter, choices) {
    const [loc, value] = Array.from(this.getValue(parameter));
    if (value == null) {
      this.errors.push(new ValidationError(loc, 'missing parameter'));
      return;
    }
    if (!Array.from(choices).includes(value)) {
      return this.errors.push(new ValidationError(loc, `should only be one of ${JSON.stringify(choices)}`, value));
    }
  }

  boolean(parameter) {
    const [loc, value] = Array.from(this.getValue(parameter));
    if (typeof(value) !== 'boolean') {
      return this.errors.push(new ValidationError(loc, "should be true or false", value));
    }
  }

  getValue(parameter) {
    let value;
    const loc = `${this.prefix}${formatParameter(parameter)}`;
    if (loc === '') {
      return ['', this.jsonObject];
    }
    try {
      value = eval("this.jsonObject" + loc);
    } catch (error) {
      value = undefined;
    }
    return [loc, value];
  }

  length() {
    return this.errors.length;
  }

  toString() {
    return this.errors.join('\n');
  }
};

const lib = {
  JSONValidator
};

module.exports = {
  lib,
  ...lib
};
