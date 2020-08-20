/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { ParserError } from './errors';

const operatorMap = {
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  '==': '===',
  '===': '===',
  '!=': '!==',
  '!==': '!==',
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
  'else': 'else',
  'expr': 'expr',
  'regex': 'regex',
  'and': '&&',
  '&&': '&&',
  'or': '||',
  '||': '||',
  'not': '!'
};

function isStaticValue(v) {
  switch (typeof(v)) {
    case 'string': return true; break;
    case 'number': return true; break;
    case 'boolean': return true; break;
    case 'object': return (typeof v.isStatic === 'function' ? v.isStatic() : undefined); break;
  }
  return false;
};

function evaluateStaticValue(v, context, location) {
  switch (typeof(v)) {
    case 'string':
      if ((v[0] === '"') && (v[v.length-1] === '"')) {
        return v.slice(1, v.length-1);
      } else {
        return v;
      }
    case 'number':
      return v;
    case 'boolean':
      return v;
    case 'object':
      if (v.evaluateStatic == null) {
        throw new ParserError(location, `missing evaluateStatic for ${JSON.stringify(v)}`);
      }
      try {
        return v.evaluateStatic(context);
      } catch (err) {
        throw new ParserError(location, `Error in static evaluation: ${err}`);
      }
  }
  throw `don't know how to static evaluate ${JSON.stringify(v)}`;
};

export class EvaluateExpression {
  constructor(expression) {
    this.expression = expression;
  }

  toLambda(output, indent, options) {
    return output.push(`${indent}${this.expression.toLambda(options)}`);
  }

  toString() {
    return this.expression.toString();
  }
};

export class Expression {
  constructor(location, root) {
    this.location = location;
    this.root = root;
    if (this.root == null) {
      throw new ParserError(this.location, "expression with no root?");
    }
  }

  isStatic() {
    return isStaticValue(this.root);
  }

  evaluateStatic(context) {
    return evaluateStaticValue(this.root, context, this.location);
  }

  toLambda(options, keepRootParentheses) {
    if (this.root.toLambda != null) {
      this.root.skipParentheses = !( keepRootParentheses != null ? keepRootParentheses : false );
      return this.root.toLambda(options);
    }
    return this.root;
  }

  toString() {
    return this.root.toString();
  }
};

export class UnaryExpression {
  constructor(location, op, val) {
    this.location = location;
    this.op = op;
    this.val = val;
    if (!(this.op in operatorMap)) {
      throw new ParserError(this.location, `unrecognized operator ${this.op}`);
    }
  }

  isStatic() {
    return isStaticValue(this.val);
  }

  evaluateStatic(context) {
    const val = evaluateStaticValue(this.val, context, this.location);
    const op = operatorMap[this.op];
    return eval(`${op}${JSON.stringify(val)}`);
  }

  toLambda(options) {
    let {
      val
    } = this;
    if (this.val.toLambda != null) {
      val = this.val.toLambda(options);
    }
    const op = operatorMap[this.op];
    if (this.skipParentheses) {
      return `${op}${val}`;
    } else {
      return `(${op}${val})`;
    }
  }

  toString() {
    return `${this.op}${this.val}`;
  }
};

export class BinaryExpression {
  constructor(location, left, op, right) {
    this.location = location;
    this.left = left;
    this.op = op;
    this.right = right;
    if (!(this.op in operatorMap)) {
      throw new ParserError(this.location, `unrecognized operator ${this.op}`);
    }
  }

  isStatic() {
    return isStaticValue(this.left) && isStaticValue(this.right);
  }

  evaluateStatic(context) {
    const left = evaluateStaticValue(this.left, context, this.location);
    const right = evaluateStaticValue(this.right, context, this.location);
    const op = operatorMap[this.op];
    return eval(`${JSON.stringify(left)} ${op} ${JSON.stringify(right)}`);
  }

  toLambda(options) {
    let {
      left
    } = this;
    if (this.left.toLambda != null) {
      left = this.left.toLambda(options);
    }
    let {
      right
    } = this;
    if (this.right.toLambda != null) {
      right = this.right.toLambda(options);
    }
    const op = operatorMap[this.op];
    if (this.skipParentheses) {
      return `${left} ${op} ${right}`;
    } else {
      return `(${left} ${op} ${right})`;
    }
  }

  toString() {
    return `${this.left.toString()} ${this.op} ${this.right.toString()}`;
  }
};

export class LocalExpressionCall {
  constructor(location, name, arguments1) {
    this.location = location;
    this.name = name;
    this.arguments = arguments1;
  }

  toLambda(options) {
    const args = [];
    for (let a of this.arguments) {
      if (a.toLambda != null) {
        args.push(a.toLambda(options));
      } else {
        args.push(a);
      }
    }

    options.scopeManager.checkAccess(this.location, this.name.base);
    return `await ${this.name}(${args.join(', ')})`;
  }

  toString() {
    const args = [];
    for (let a of this.arguments) {
      args.push(a.toString());
    }

    return `${this.name}(${args.join(', ')})`;
  }
};

export class DBExpressionCall {
  constructor(location, name, arguments1) {
    this.location = location;
    this.name = name;
    this.arguments = arguments1;
  }

  toLambda(options) {
    const args = [];
    for (let a of this.arguments) {
      if (a.toLambda != null) {
        args.push(a.toLambda(options));
      } else {
        args.push(a);
      }
    }

    return `await context.db.read('${this.name.base}')${this.name.toLambdaTail(options)}(${args.join(', ')})`;
  }

  toString() {
    const args = [];
    for (let a of this.arguments) {
      args.push(a.toString());
    }

    return `@${this.name}(${args.join(', ')})`;
  }
};

export class IfCondition {
  constructor(expression, negated) {
    this.expression = expression;
    this.negated = negated;
  }

  pushCode(line) {
    this.startFunction = this.startFunction != null ? this.startFunction : new Func;
    return this.startFunction.pushLine(line);
  }

  validateStateTransitions(allStateNames, language) {
    return this.startFunction
      && this.startFunction.validateStateTransitions
      && this.startFunction.validateStateTransitions(allStateNames, language);
  }

  toLambda(output, indent, options) {
    if (!options.language) {
      throw "missing language in if";
    }
    if (this.negated) {
      output.push(`${indent}if (!(${this.expression.toLambda(options)})) {`);
    } else {
      output.push(`${indent}if (${this.expression.toLambda(options)}) {`);
    }
    if (this.startFunction != null) {
      this.startFunction.toLambda(output, indent + "  ", options);
    }
    return output.push(`${indent}}`);
  }

  hasStatementsOfType(types) {
    if (this.startFunction != null) {
      return this.startFunction.hasStatementsOfType(types);
    }
    return false;
  }

  collectRequiredAPIs(apis) {
    return this.startFunction
      && this.startFunction.collectRequiredAPIs
      && this.startFunction.collectRequiredAPIs(apis);
  }

  toLocalization(localization) {
    return (this.startFunction != null ? this.startFunction.toLocalization(localization) : undefined);
  }
};

export class ElseCondition {
  constructor(expression, negated) {
    this.expression = expression;
    this.negated = negated;
  }

  pushCode(line) {
    this.startFunction = this.startFunction != null ? this.startFunction : new Func;
    return this.startFunction.pushLine(line);
  }

  validateStateTransitions(allStateNames, language) {
    return this.startFunction
      && this.startFunction.validateStateTransitions
      && this.startFunction.validateStateTransitions(allStateNames, language);
  }

  toLambda(output, indent, options) {
    if (this.expression) {
      if (this.negated) {
        output.push(`${indent}else if (!(${this.expression.toLambda(options)})) {`);
      } else {
        output.push(`${indent}else if (${this.expression.toLambda(options)}) {`);
      }
    } else {
      output.push(`${indent}else {`);
    }
    if (this.startFunction != null) {
      this.startFunction.toLambda(output, indent + "  ", options);
    }
    return output.push(`${indent}}`);
  }

  hasStatementsOfType(types) {
    if (this.startFunction != null) {
      return this.startFunction.hasStatementsOfType(types);
    }
    return false;
  }

  collectRequiredAPIs(apis) {
    return this.startFunction
      && this.startFunction.collectRequiredAPIs
      && this.startFunction.collectRequiredAPIs(apis);
  }

  toLocalization(localization) {
    return (this.startFunction != null ? this.startFunction.toLocalization(localization) : undefined);
  }
};

export class ForStatement {
  constructor(keyName, valueName, sourceName) {
    this.keyName = keyName;
    this.valueName = valueName;
    this.sourceName = sourceName;
  }

  pushCode(line) {
    this.startFunction = this.startFunction != null ? this.startFunction : new Func;
    return this.startFunction.pushLine(line);
  }

  validateStateTransitions(allStateNames, language) {
    return this.startFunction
      && this.startFunction.validateStateTransitions
      && this.startFunction.validateStateTransitions(allStateNames, language);
  }

  toLambda(output, indent, options) {
    const tempKey = options.scopeManager.newTemporary(this.location);

    const code = [];
    const sourceName = this.sourceName.toLambda(options);

    // lexically scope the block
    options.scopeManager.pushScope(this.location, 'for');

    code.push(`for (let ${tempKey} in ${sourceName}){`);
    if (this.valueName != null) {
      options.scopeManager.allocate(this.location, this.valueName);
      code.push(`  let ${this.valueName} = ${sourceName}[${tempKey}];`);
    }
    if (this.keyName != null) {
      options.scopeManager.allocate(this.location, this.keyName);
      code.push(`  let ${this.keyName} = ${tempKey};`);
    }

    if (this.startFunction != null) {
      this.startFunction.toLambda(code, "  ", options);
    }
    code.push("}");

    options.scopeManager.popScope();

    return code.map((l) =>
      output.push(indent + l));
  }

  hasStatementsOfType(types) {
    if (this.startFunction != null) {
      return this.startFunction.hasStatementsOfType(types);
    }
    return false;
  }

  collectRequiredAPIs(apis) {
    return this.startFunction
      && this.startFunction.collectRequiredAPIs
      && this.startFunction.collectRequiredAPIs(apis);
  }

  toLocalization(localization) {
    return (this.startFunction != null ? this.startFunction.toLocalization(localization) : undefined);
  }
};

export class SwitchStatement {
  constructor(assignments) {
    this.assignments = assignments;
    this.cases = [];
  }

  pushCase(switchCase) {
    return this.cases.push(switchCase);
  }

  validateStateTransitions(allStateNames, language) {
    return this.cases.map((c) =>
      (typeof c.validateStateTransitions === 'function' ? c.validateStateTransitions(allStateNames, language) : undefined));
  }

  toLambda(output, indent, options) {
    // switch statements are turned into cascading if/else statements
    // as we allow a variety of switching scenarios, while JavaScript
    // only supports jumping on integers.

    // if we have local assignments, then our scoping promise is
    // they won't be visible after the switch statement, which
    // means we'll need an extra block scope to contain them.
    let childIndent;
    const needWrap = this.assignments[0] != null ? this.assignments[0].needsScope() : undefined;

    // either way, switch blocks are lexical scopes to us
    options.scopeManager.pushScope(this.location, "switch");

    if (needWrap) {
      output.push(`${indent}{`);
      childIndent = indent + "  ";
    } else {
      childIndent = indent;
    }

    // each assignment becomes a local variable
    for (let a of this.assignments) {
      a.toLambda(output, childIndent, options);
    }

    // if we have at least one assignment, then they
    // become the implicit variable in case comparisons.
    // if it's non trivial, then we cache it in a local variable
    const implicit = this.assignments[0] != null ? this.assignments[0].stringName : undefined;

    // let each case generate their chunk
    for (let idx = 0; idx < this.cases.length; idx++) {
      const c = this.cases[idx];
      c.toLambda(output, childIndent, options, idx===0, implicit);
    }

    if (needWrap) {
      output.push(`${indent}}`);
    }

    return options.scopeManager.popScope();
  }

  toLocalization(localization) {
    return this.cases.forEach(c => c.startFunction != null ? c.startFunction.toLocalization(localization) : undefined);
  }
};

export class SwitchAssignment {
  constructor(location, name, value) {
    this.location = location;
    this.name = name;
    this.value = value;
  }

  needsScope() {
    return (this.value != null) || ((this.name != null ? this.name.toLambda : undefined) != null);
  }

  toLambda(output, indent, options) {
    this.stringName = this.name;
    if ((this.name != null ? this.name.toLambda : undefined) != null) {
      this.stringName = this.name.toLambda(options);
    }

    if ((this.stringName != null) && (this.value != null)) {
      // if we're assigning a value, this needs to be a new var
      options.scopeManager.allocate(this.location, this.stringName);
    }

    if (!this.stringName) {
      // if no name, then it's the implicit, and we'll make this a temporary
      this.stringName = options.scopeManager.newTemporary(this.location);
    }

    if (this.value != null) {
      // if there isn't a value, then this is just importing the implicit
      return output.push(`${indent}let ${this.stringName} = ${this.value.toLambda(options)};`);
    }
  }
};

export class SwitchCase {
  constructor(location, operator, value) {
    this.location = location;
    this.operator = operator;
    this.value = value;
    if (!(this.operator in operatorMap)) {
      throw new ParserError(this.location, `Unrecognized operator ${this.operator}`);
    }
  }

  pushCode(line) {
    this.startFunction = this.startFunction != null ? this.startFunction : new Func;
    return this.startFunction.pushLine(line);
  }

  validateStateTransitions(allStateNames, language) {
    return this.startFunction
      && this.startFunction.validateStateTransitions
      && this.startFunction.validateStateTransitions(allStateNames, language);
  }

  toLambda(output, indent, options, first, implicit) {
    if (this.operator === 'else') {
      output.push(`${indent}else {`);
    } else {
      let val;
      const cmd = first ? 'if' : 'else if';
      if (this.operator === 'expr') {
        const val = this.value && this.value.toLambda && this.value.toLambda(options, false);
        output.push(`${indent}${cmd} (${val}) {`);
      } else if (this.operator === 'regex') {
        output.push(`${indent}${cmd} (/${this.value.expression}/${this.value.flags}.test(${implicit})) {`);
      } else {
        const val = this.value && this.value.toLambda && this.value.toLambda(options, true);
        const op = operatorMap[this.operator];
        output.push(`${indent}${cmd} (${implicit} ${op} ${val}) {`);
      }
    }
    if (this.startFunction != null) {
      this.startFunction.toLambda(output, indent + "  ", options);
    }
    return output.push(`${indent}}`);
  }

  toLocalization(localization) {
    return (this.startFunction != null ? this.startFunction.toLocalization(localization) : undefined);
  }
};

export class SetSetting {
  constructor(variable, value) {
    this.variable = variable;
    this.value = value;
  }

  toLambda(output, indent, options) {
    return output.push(`${indent}context.settings['${this.variable}'] = ${this.value};`);
  }
};

export class DBAssignment {
  constructor(name, expression) {
    this.name = name;
    this.expression = expression;
  }

  toLambda(output, indent, options) {
    const tail = this.name.toLambdaTail();
    if (tail === "") {
      return output.push(`${indent}context.db.write('${this.name.base}', ${this.expression.toLambda(options)});`);
    } else {
      return output.push(`${indent}context.db.read('${this.name.base}')${tail} = ${this.expression.toLambda(options)};`);
    }
  }
};

export class WrapClass {
  constructor(className, variableName, source) {
    this.className = className;
    this.variableName = variableName;
    this.source = source;
  }

  toLambda(output, indent, options) {
    options.scopeManager.allocate(this.location, this.variableName);
    return output.push(`${indent}var ${this.variableName} = new ${this.className}(context.db.read('${this.source}', true), context);`);
  }
};

export class DBTypeDefinition {
  constructor(location, name, type) {
    this.location = location;
    this.name = name;
    this.type = type;
  }
};

export class LocalDeclaration {
  constructor(name, expression) {
    this.name = name;
    this.expression = expression;
  }

  toLambda(output, indent, options) {
    options.scopeManager.allocate(this.location, this.name);
    return output.push(`${indent}let ${this.name} = ${this.expression.toLambda(options)};`);
  }
};

export class LocalVariableAssignment {
  constructor(name, expression) {
    this.name = name;
    this.expression = expression;
  }

  toLambda(output, indent, options) {
    options.scopeManager.checkAccess(this.location, this.name);
    return output.push(`${indent}${this.name} = ${this.expression.toLambda(options)};`);
  }
};

export class LocalVariableReference {
  constructor(location, name) {
    this.location = location;
    this.name = name;
  }

  toLambda(options) {
    options.scopeManager.checkAccess(this.location, this.name.base);
    return this.name.toLambda(options);
  }

  toString(options) {
    return this.name;
  }
};

export class SlotVariableAssignment {
  constructor(location, name, expression) {
    this.location = location;
    this.name = name;
    this.expression = expression;
    if (['request', 'event'].includes(this.name.base)) {
      throw new ParserError(this.location, `cannot assign to the reserved variable name \`$${this.name}\``);
    }
  }

  toLambda(output, indent, options) {
    return output.push(`${indent}context.slots.${this.name} = ${this.expression.toLambda(options)};`);
  }
};

export class Directive {
  constructor(expression) {
    this.expression = expression;
  }

  toLambda(output, indent, options) {
    const expression = this.expression.toLambda(options);
    const line = this.location && this.location.start && this.location.start.line;
    const code = `\
var __directives = ${expression};
if (!__directives) { throw new Error('directive expression at line ${line} did not return an array of directives'); }
if (!Array.isArray(__directives)) {
  __directives = [__directives];
}
for(var i=0; i<__directives.length; ++i) {
  if (typeof(__directives[i]) == 'object') {
    context.directives.push(__directives[i]);
  } else {
    throw new Error('directive expression at line ${line} produced item ' + i + ' that was not an object');
  }
} `;
    for (let line of code.split('\n')) {
      output.push(indent + line);
    }
  }
};

export class RecordMetric {
  constructor(name) {
    this.name = name;
  }

  toLambda(output, indent, options) {
    return output.push(`${indent}reportValueMetric('${this.name}', 1);`);
  }
};

export class SetResponseSpacing {
  constructor(milliseconds) {
    this.milliseconds = milliseconds;
  }

  toLambda(output, indent, options) {
    return output.push(`${indent}context.db.responseMinimumDelay = ${this.milliseconds};`);
  }
};

export class Func {
  constructor() {
    this.languages = {};
  }

  pushLine(line) {
    if (!(line.location != null ? line.location.language : undefined)) {
      throw `Missing language in line ${(line.constructor != null ? line.constructor.name : undefined)}`;
    }
    const {
      language
    } = line.location;
    if (!(language in this.languages)) {
      this.languages[language] = [];
    }
    return this.languages[language].push(line);
  }

  validateStateTransitions(allStateNames, language) {
    if (this.languages[language] == null) { return; }
    return this.languages[language].map((line) =>
      (typeof line.validateStateTransitions === 'function' ? line.validateStateTransitions(allStateNames, language) : undefined));
  }

  toLambda(output, indent, options) {
    if (!options.language) {
      console.error(options);
      throw "no language in toLambda";
    }
    let lines = this.languages['default'];
    if (options.language in this.languages) {
      lines = this.languages[options.language];
    }
    if (lines != null) {
      for (let line of lines) {
        if ((line != null ? line.toLambda : undefined) == null) {
          console.error(line);
          throw `missing toLambda for ${line.constructor.name}`;
        }
        line.toLambda(output, indent, options);
      }
    }
    if (this.shouldEndSession) {
      return output.push("context.shouldEndSession = true;");
    }
  }

  toLocalization(localization) {
    if (!('default' in this.languages)) {
      return;
    }
    const result = [];
    for (let idx = 0; idx < this.languages.default.length; idx++) {
      const line = this.languages.default[idx];
      if (line.toLocalization != null) {
        result.push(line.toLocalization(localization));
      } else {
        result.push(undefined);
      }
    }
    return result;
  }

  forEachPart(language, cb) {
    if (!this.languages[language]) { return; }
    return this.languages[language].map((line) =>
      cb(line));
  }

  hasStatementsOfType(types) {
    for (let lang in this.languages) {
      const lines = this.languages[lang];
      for (let line of lines) {
        if (line.hasStatementsOfType) {
          if (line.hasStatementsOfType(types)) { return true; }
        }
      }
    }
    return false;
  }

  collectRequiredAPIs(apis) {
    const result = [];
    for (let lang in this.languages) {
      const lines = this.languages[lang];
      result.push(lines.map((line) =>
        (typeof line.collectRequiredAPIs === 'function' ? line.collectRequiredAPIs(apis) : undefined)));
    }
    return result;
  }
};

export class FunctionMap {
  /*
    Interface compatible with Function, this is a
    convenience object for collecting named blocks of
    alternative functions.
  */

  constructor() {
    this.currentName = '__';
    this.functions = {};
    this.functions[this.currentName] = new Func;
  }

  setCurrentName(name) {
    if (!(name in this.functions)) {
      this.functions[name] = new Func;
    }
    return this.currentName = name;
  }

  pushLine(line) {
    return this.functions[this.currentName].pushLine(line);
  }

  validateStateTransitions(allStateNames, language) {}

  toLambda(output, indent, options, name) {
    if (name == null) { return; }
    if (!(name in this.functions)) { return; }
    return this.functions[name].toLambda(output, indent, options);
  }

  toLocalization(localization) {}

  forEachPart(language, cb) {
    const result = [];
    for (let n in this.functions) {
      const f = this.functions[n];
      result.push(f.forEachPart(language, cb));
    }
    return result;
  }

  hasStatementsOfType(types) {
    for (let n in this.functions) {
      const f = this.functions[n];
      if (f.hasStatementsOfType(types)) { return true; }
    }
    return false;
  }

  collectRequiredAPIs(apis) {
    const result = [];
    for (let n in this.functions) {
      const f = this.functions[n];
      result.push((typeof f.collectRequiredAPIs === 'function' ? f.collectRequiredAPIs(apis) : undefined));
    }
    return result;
  }
};

export const lib = {
  EvaluateExpression,
  Expression,
  UnaryExpression,
  BinaryExpression,
  LocalExpressionCall,
  DBExpressionCall,
  IfCondition,
  ElseCondition,
  ForStatement,
  SwitchStatement,
  SwitchAssignment,
  SwitchCase,
  SetSetting,
  DBAssignment,
  WrapClass,
  DBTypeDefinition,
  LocalDeclaration,
  LocalVariableAssignment,
  LocalVariableReference,
  SlotVariableAssignment,
  Directive,
  RecordMetric,
  SetResponseSpacing,
  Function: Func,
  FunctionMap
};

export default {
  lib,
  ...lib
};
