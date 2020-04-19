/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const { Function } = require('./function').lib;
const { Intent, FilteredIntent } = require('./intent').lib;
const { ParserError } = require('./errors');
const { VariableScopeManager } = require('./variableScope');

class Transition {
  constructor(name, stop) {
    this.name = name;
    this.stop = stop;
  }

  toLambda(output, indent, options) {
    output.push(`${indent}context.nextState = '${this.name}';`);
    if (this.stop) {
      output.push(`${indent}context.handoffState = '${this.name}';`);
      output.push(`${indent}context.handoffIntent = true;`);
      return output.push(`${indent}return;`);
    }
  }

  validateStateTransitions(allStateNames) {
    if (!Array.from(allStateNames).includes(this.name)) {
      throw new ParserError(this.location, `Transition to non existant state: ${this.name}`);
    }
  }
};

class HandoffIntent {
  constructor(name) {
    this.name = name;
  }

  toLambda(output, indent, options) {
    output.push(`${indent}context.handoffState = '${this.name}';`);
    return output.push(`${indent}context.handoffIntent = true;`);
  }

  validateStateTransitions(allStateNames) {
    if (!Array.from(allStateNames).includes(this.name)) {
      throw new ParserError(this.location, `Handoff to non existant state: ${this.name}`);
    }
  }
};

class SetSkillEnd {
  constructor() {}

  toLambda(output, indent, options) {
    return output.push(`${indent}context.shouldEndSession = true;`);
  }
};

class SetSkillListen {
  constructor(kinds) {
    this.kinds = kinds;
  }

  toLambda(output, indent, options) {
    output.push(`${indent}context.shouldEndSession = false;`);
    if (!this.kinds.includes('microphone')) {
      return output.push(`${indent}context.shouldDropSession = true;`);
    }
  }
};

class LogMessage {
  constructor(contents) {
    this.contents = contents;
  }

  toLambda(output, indent, options) {
    return output.push(`${indent}exports.Logging.log(JSON.stringify(${this.contents.toLambda(options)}));`);
  }
};

class State {
  constructor(name) {
    this.name = name;
    this.intents = {};
    this.languages = {};
    this.parsePhase = 'start';
    this.pushOrGetIntent(null, '--default--', null);
    this.parsePhase = 'start';
    this.locations = { default: null };
    this.isState = true;
  }

  prepareForLanguage(location) {
    if (!(location != null ? location.language : undefined)) {
      return;
    }
    if (location.language === 'default') {
      return;
    }
    if (!(location.language in this.languages)) {
      return this.languages[location.language] = {};
    }
  }

  resetParsePhase() {
    // used by the default constructors, pre parser
    this.parsePhase = 'start';
  }

  collectDefinedSlotTypes(context, customSlotTypes) {
    const workingIntents = this.collectIntentsForLanguage(context.language);
    return (() => {
      const result = [];
      for (let name in workingIntents) {
        const intent = workingIntents[name];
        result.push(intent.collectDefinedSlotTypes(context, customSlotTypes));
      }
      return result;
    })();
  }

  validateSlotTypes(context, customSlotTypes) {
    const workingIntents = this.collectIntentsForLanguage(context.language);
    return (() => {
      const result = [];
      for (let name in workingIntents) {
        const intent = workingIntents[name];
        result.push(intent.validateSlotTypes(customSlotTypes));
      }
      return result;
    })();
  }

  validateTransitions(allStateNames, language) {
    let intent, name;
    if (this.startFunction != null) {
      this.startFunction.validateStateTransitions(allStateNames, language);
    }
    for (name in this.intents) {
      intent = this.intents[name];
      intent.validateStateTransitions(allStateNames, language);
    }
    return (() => {
      const result = [];
      for (name in this.languages[language]) {
        intent = this.languages[language][name];
        result.push(intent.validateStateTransitions(allStateNames, language));
      }
      return result;
    })();
  }

  hasIntent(name, language) {
    const workingIntents = this.collectIntentsForLanguage(language);
    for (let intentName in workingIntents) {
      const intent = workingIntents[intentName];
      if (name === intentName) { return true; }
    }

    return false;
  }

  reportIntents(language, output) {
    const workingIntents = this.collectIntentsForLanguage(language);
    return (() => {
      const result = [];
      for (let name in workingIntents) {
        const intent = workingIntents[name];
        if (name === '--default--') { continue; }
        const report = intent.report();
        result.push(output[report] = true);
      }
      return result;
    })();
  }

  getIntentInLanguage(language, intentName) {
    if (language === 'default') {
      return this.intents[intentName];
    }
    return (this.languages[language] != null ? this.languages[language][intentName] : undefined);
  }

  pushOrGetIntent(location, utterance, intentInfo) {
    let key;
    switch (this.parsePhase) {
      case 'start':
        this.parsePhase = 'intents';
        break;
      case 'intents':
        break;
        // fine
      default:
        throw new ParserError(location, `cannot add a new intent handler to the state \`${this.name}\` at \
this location. Have you already added state exit code before here? Check your indentation.`
        );
    }
    try {
      key = Intent.utteranceToName(location, utterance);
    } catch (err) {
      throw new ParserError(location, `Cannot create intent name from \`${utterance}\`: ${err}`);
    }
    const language = (location != null ? location.language : undefined) != null ? (location != null ? location.language : undefined) : 'default';
    let collection = this.intents;

    if (language !== 'default') {
      this.languages[language] = this.languages[language] != null ? this.languages[language] : {};
      collection = this.languages[language];
    }
    if (!(key in collection)) {
      if ((intentInfo != null ? intentInfo.class : undefined) != null) {
        collection[key] = new intentInfo.class({ location, utterance });
      } else {
        collection[key] = new Intent({ location, utterance });
      }
    } else if (!collection[key].defaultedResetOnGet && (key !== '--default--')) {
      // only allow repeat intents if they are events that can be filtered
      if (!(collection[key] instanceof FilteredIntent)) {
        throw new ParserError(location, `Not allowed to redefine intent \`${key}\` in state \`${this.name}\``);
      }
    }

    const intent = collection[key];

    if (intent.defaultedResetOnGet) {
      intent.resetCode();
      intent.defaultedResetOnGet = undefined;
    }

    intent.allLocations.push(location);
    return intent;
  }

  pushCode(line) {
    switch (this.parsePhase) {
      case 'start':
        this.startFunction = this.startFunction != null ? this.startFunction : new Function;
        return this.startFunction.pushLine(line);
      case 'end': case 'intents':
        this.endFunction = this.endFunction != null ? this.endFunction : new Function;
        this.endFunction.pushLine(line);
        return this.parsePhase = 'end';
      default:
        throw new ParserError(line.location, `cannot add code to the state \`${this.name}\` here, you've already begun defining intents`);
    }
  }

  collectIntentsForLanguage(language) {
    let intent, name;
    const workingIntents = {};
    // for a given state, you will get the intents in that locale's
    // version of that state only (intents are not inherited from the parent state)
    if (language in this.languages) {
      for (name in this.languages[language]) {
        intent = this.languages[language][name];
        workingIntents[name] = intent;
      }
      if (this.name === 'global') {
        if (!('--default--' in workingIntents)) {
          workingIntents['--default--'] = this.intents['--default--'];
        }
      }
    } else if (this.intents != null) {
      for (name in this.intents) {
        intent = this.intents[name];
        workingIntents[name] = intent;
      }
    }
    return workingIntents;
  }

  toLambda(output, options) {
    let e, name;
    const workingIntents = this.collectIntentsForLanguage(options.language);

    options.scopeManager = new VariableScopeManager(this.locations[options.language], this.name);
    options.scopeManager.currentScope.referenceTester = options.referenceTester;

    const enterFunc = [];
    if (this.startFunction != null) {
      this.startFunction.toLambda(enterFunc, "", options);
    }

    const exitFunc = [];
    if (this.endFunction != null) {
      this.endFunction.toLambda(exitFunc, "", options);
    }

    const childIntentsEncountered = [];
    const intentsFunc = [];
    intentsFunc.push("switch( context.intent ) {");
    for (name in workingIntents) {
      const intent = workingIntents[name];
      options.scopeManager.pushScope(intent.location, `intent:${name}`);
      if (name === '--default--') {
        intentsFunc.push("  default: {");

        if (this.name === 'global') {
          intentsFunc.push("    if (!runOtherwise) { return false; }");
        }

        if (this.name !== 'global') {
          intentsFunc.push(`    if ( await processIntents.global(context, ${!intent.hasContent}) ) { return true; }`);
          if (intent.hasContent) {
            intent.toLambda(intentsFunc, options);
          }
        } else if (intent.hasContent) {
            intent.toLambda(intentsFunc, options);
        } else {
          if (options.strictMode) {
            intentsFunc.push("    throw new Error('unhandled intent ' + context.intent + ' in state ' + context.handoffState);");
          } else {
            intentsFunc.push("    console.error('unhandled intent ' + context.intent + ' in state ' + context.handoffState);");
          }
        }
      } else {
        // Child intents are registered to the state as handlers, but it is parent handlers that perform the logic
        // of adding them to the same switch case. Therefore, keep track of the ones already added to transformed code and
        // ignore them if they are encountered again.
        if (childIntentsEncountered.includes(intent.name)) {
          options.scopeManager.popScope();
          continue;
        }

        for (let intentName of Array.from(intent.childIntents)) {
          intentsFunc.push(`  case '${intentName}':`);
          childIntentsEncountered.push(intentName);
        }

        intentsFunc.push(`  case '${intent.name}': {`);

        if (intent.code != null) {
          for (let line of Array.from(intent.code.split('\n'))) {
            intentsFunc.push("    " + line);
          }
        } else {
          intent.toLambda(intentsFunc, options);
        }
      }
      intentsFunc.push("    break;\n    }");
      options.scopeManager.popScope();
    }
    intentsFunc.push("}");

    if (options.scopeManager.depth() !== 1) {
      throw new ParserError(this.locations[options.language], `scope imbalance: returned to state but \
scope has ${options.scopeManager.depth()} depth`
      );
    }

    // if we have local variables in the root scope that are accessed
    // after the enter function, then we need to persist those to the
    // database in a special state scope
    const rootScope = options.scopeManager.currentScope;
    if (rootScope.hasDescendantAccess()) {
      const names = [];

      // collect names
      for (let k in rootScope.variables) {
        const v = rootScope.variables[k];
        if (v.accesedByDescendant) {
          names.push(k);
        }
      }

      // unpack into local variables at the start of handlers, except
      // for the entry handler where they're initialized
      const unpacker = `let {${names.join(', ')}} = context.db.read('__stateLocals') || {};`;
      intentsFunc.unshift(unpacker);
      exitFunc.unshift(unpacker);

      // pack into database object and the end of handlers, except
      // for the exit state, where they're forgotten
      const packer = `context.db.write('__stateLocals', {${names.join(', ')}} );`;
      enterFunc.push(packer);
      intentsFunc.push(packer);
    }


    output.push(`enterState.${this.name} = async function(context) {`);
    for (e of Array.from(enterFunc)) { output.push("  " + e); }
    output.push("};");

    intentsFunc.push("return true;");
    output.push(`processIntents.${this.name} = async function(context, runOtherwise) {`);
    for (e of Array.from(intentsFunc)) { output.push("  " + e); }
    output.push("};");

    output.push(`exitState.${this.name} = async function(context) {`);
    for (e of Array.from(exitFunc)) { output.push("  " + e); }
    output.push("};");

    return output.push("");
  }

  hasStatementsOfType(types) {
    if (this.startFunction != null) {
      if (this.startFunction.hasStatementsOfType(types)) { return true; }
    }
    if (this.intents != null) {
      for (let name in this.intents) {
        const intent = this.intents[name];
        if (intent.hasStatementsOfType(types)) { return true; }
      }
    }
    return false;
  }

  collectRequiredAPIs(apis) {
    if (this.startFunction != null) {
      this.startFunction.collectRequiredAPIs(apis);
    }
    if (this.intents != null) {
      return (() => {
        const result = [];
        for (let name in this.intents) {
          const intent = this.intents[name];
          result.push(intent.collectRequiredAPIs(apis));
        }
        return result;
      })();
    }
  }

  toUtterances(output) {
    const workingIntents = this.collectIntentsForLanguage(output.language);
    return (() => {
      const result = [];
      for (let name in workingIntents) {
        const intent = workingIntents[name];
        if (intent.referenceIntent != null) { continue; }
        result.push(intent.toUtterances(output));
      }
      return result;
    })();
  }

  toModelV2(output, context, extendedEventNames) {
    const workingIntents = this.collectIntentsForLanguage(context.language);
    return (() => {
      const result = [];
      for (let name in workingIntents) {
        var model;
        const intent = workingIntents[name];
        if (name === '--default--') { continue; }
        if (intent.referenceIntent != null) { continue; }
        if (!intent.hasUtterances) {
          if ((context.skill.testDevice == null) || (!Array.from(extendedEventNames).includes(name) && !name.includes('.'))) { // supported events have '.' in their names
            console.warn(`\`${name}\` does not have utterances; not adding to language model.`);
          }
          continue;
        }
        try {
          model = intent.toModelV2(context);
        } catch (err) {
          if (err.location) {
            throw err; // ParserErrors have location properties; propagate the error
          } else {
            throw new Error(`failed to write language model for state \`${this.name}\`: ${err}`);
          }
        }

        if (model == null) { continue; }

        if (model.name in context.intents) {
          result.push(console.error(`duplicate \`${model.name}\` intent found while writing model`));
        } else {
          context.intents[model.name] = model;
          result.push(output.languageModel.intents.push(model));
        }
      }
      return result;
    })();
  }

  toLocalization(localization) {
    if (this.startFunction != null) {
      this.startFunction.toLocalization(localization);
    }

    return (() => {
      const result = [];
      for (let name in this.intents) {
        const intent = this.intents[name];
        if ((localization.intents[name] == null) && (name !== '--default--')) { // 'otherwise' handler -> no utterances
          // if this is a new intent, add it to the localization map
          localization.intents[name] = { default: [] };
        }

        // add utterances mapped to the intent, and speech lines in the intent handler
        result.push(intent.toLocalization(localization));
      }
      return result;
    })();
  }
};

const lib = {
  Transition,
  HandoffIntent,
  SetSkillEnd,
  SetSkillListen,
  LogMessage,
  State
};

module.exports = {
  lib,
  ...lib
};
