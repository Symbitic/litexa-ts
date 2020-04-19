/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const { Function, FunctionMap } = require('./function').lib;
const { ParserError, formatLocationStart } = require('./errors').lib;
const Utils = require('./utils').lib;

const builtInIntents = [
  'AMAZON.CancelIntent',
  'AMAZON.FallbackIntent',
  'AMAZON.HelpIntent',
  'AMAZON.MoreIntent',
  'AMAZON.NavigateHomeIntent',
  'AMAZON.NavigateSettingsIntent',
  'AMAZON.NextIntent',
  'AMAZON.NoIntent',
  'AMAZON.PageDownIntent',
  'AMAZON.PageUpIntent',
  'AMAZON.PauseIntent',
  'AMAZON.PreviousIntent',
  'AMAZON.RepeatIntent',
  'AMAZON.ResumeIntent',
  'AMAZON.ScrollDownIntent',
  'AMAZON.ScrollLeftIntent',
  'AMAZON.ScrollRightIntent',
  'AMAZON.ScrollUpIntent',
  'AMAZON.StartOverIntent',
  'AMAZON.StopIntent',
  'AMAZON.YesIntent'
];

const builtInSlotTypes = [
  'AMAZON.NUMBER'
];

const builtInReference = builtInIntents
  .map(str => str.split('.'))
  .reduce((acc, [key, val]) => {
    acc[key] = {
      ...acc[key],
      [val]: true
    };
    return acc;
  }, {});

function identifierFromString(location, str) {
  const ret = str
    // no spaces
    .replace(/\s+/g, '_')
    // no casing
    .toUpperCase()
    // replace numbers with a placeholder token
    .replace(/[0-9]/g, 'n')
    // dump everything else
    .replace(/[^A-Za-z_.]/g, '')
    // no consecutive underscores or periods
    .replace(/_+/g, '_')
    .replace(/\.+/g, '_');

  if ((ret.length === 0) || (ret === '_')) {
    throw new ParserError(location, `utterance reduces to unsuitable intent name \`${ret}\`. You may need to use an explicit intent name instead?`);
  }
  // must start with a letter
  return !ret[0].match(/[A-Za-z]/) ? `i${ret}` : ret;
};

class Utterance {
  constructor(parts) {
    this.parts = parts;
    this.isUtterance = true;
  }

  toString() {
    return this.parts.map((p) => p.toString()).join('');
  }

  toUtterance() {
    return this.parts.map((p) => p.toUtterance()).join('');
  }

  toModelV2() {
    return this.toUtterance();
  }

  parse(line) {
    let p;
    if (this.regex == null) {
      this.testScore = 0;
      this.testScore = this.parts.reduce((acc, p) => acc + p.toTestScore(), 0);
      const regexText = this.parts.map(p => p.toRegex()).join('');
      this.regex = new RegExp(`^${regexText}$`, 'i');
    }

    const match = this.regex.exec(line);
    if (match == null) {
      return [null, null];
    }

    const result = {};
    const iterable = match.slice(1);
    for (let idx = 0; idx < iterable.length; idx++) {
      const read = iterable[idx];
      const part = this.parts[idx];
      if (part && part.isSlot) {
        result[part.name] = read;
      }
    }
    return [ this.testScore, result ];
  }

  isEquivalentTo(otherUtterance) {
    return otherUtterance.toUtterance() === this.toUtterance();
  }
};

function compileSlot(context, type) {
  let data, err;
  let k;
  let code = context.skill.getFileContents(type.filename, context.language);

  code = code.js ? code.js : code;
  if (!code) {
    throw new ParserError(null, `Couldn't find contents of file ${type.filename} to build slot type`);
  }

  const exports = {};
  try {
    eval(code);
  } catch (error) {
    err = error;
    throw new ParserError(null, `While compiling ${type.filename}: ${err}`);
  }

  if (!(((() => {
    const result = [];
    for (k in exports) {
      result.push(k);
    }
    return result;
  })()).length > 0)) {
    throw new ParserError(null, `Slot type builder file ${type.filename} does not appear to export \
any slot building functions`
    );
  }
  if (!(type.functionName in exports)) {
    throw new ParserError(null, `Slot type builder ${type.functionName} not found in \
${type.filename}, saw these functions in there [${((() => {
        const result1 = [];
        for (k in exports) {
          result1.push(k);
        }
        return result1;
      })()).join(',')}]`
    );
  }

  try {
    data = exports[type.functionName](context.skill, context.language);
  } catch (error1) {
    err = error1;
    throw new ParserError(null, `While building ${type.functionName} from ${type.filename}: ${err}`);
  }

  if (typeof (data) !== 'object') {
    throw new ParserError(null, `Slot builder ${type.functionName} returned ${JSON.stringify(data)}, \
expected an object in the form { name:``, values:[] }`
    );
  }

  for (let key of ['name', 'values']) {
    if (!(key in data)) {
      throw new ParserError(null, `Missing key \`${key}\` in result of slot builder \
${type.functionName}: ${JSON.stringify(data)}`
      );
    }
  }

  for (let index = 0; index < data.values.length; index++) {
    const value = data.values[index];
    if (typeof (value) === 'string') {
      data.values[index] = {
        id: undefined,
        name: {
          value,
          synonyms: []
        }
      };
    }
  }

  if (data.name in context.types) {
    throw new ParserError(null, `Duplicate slot type definition found for name \`${data.name}\`. \
Please remove one.`
    );
  }

  context.types[data.name] = data;
  return data.name;
};

function createSlotFromArray(context, slotName, values) {
  const typeName = `${slotName}Type`;

  if (typeName in context.types) {
    throw new ParserError(null, `Duplicate slot type definition found for name \`${typeName}\` while \
creating implicit type for slot \`${slotName}\`. Please remove conflicting definitions.`
    );
  }

  const type = {
    name: typeName,
    values: []
  };

  for (let v of Array.from(values)) {
    type.values.push({
      id: undefined,
      name: {
        value: JSON.parse(v),
        synonyms: []
      }
    });
  }

  if (context != null) {
    context.types[typeName] = type;
  }

  return typeName;
};

class Slot {
  constructor(name) {
    this.name = name;
  }

  setType(location, type) {
    if (this.type != null) {
      if ((this.type.filename != null) && (this.type.functionName != null)) {
        throw new ParserError(location, `The slot named \`${this.name}\` already has a defined type from \
the slot builder: \`${this.type.filename}:${this.type.functionName}\``
        );
      } else {
        throw new ParserError(location, `The slot named \`${this.name}\` already has a defined type: \
\`${this.type}\``
        );
      }
    }

    this.type = type;
    this.typeLocation = location;
    if (typeof (this.type) === 'string') {
      return this.builtinType = this.type.indexOf('AMAZON.') === 0;
    }
  }

  collectDefinedSlotTypes(context, customSlotTypes) {
    let typeName;
    if (this.type == null) {
      throw new ParserError(null, `the slot named \`${this.name}\` doesn't have a 'with' statement \
defining its type`
      );
    }

    if (Array.isArray(this.type)) {
      typeName = createSlotFromArray(context, this.name.toString(), this.type);
      return customSlotTypes.push(typeName);
    } else if (this.type.isFileFunctionReference) {
      typeName = compileSlot(context, this.type);
      return customSlotTypes.push(typeName);
    }
  }

  validateSlotTypes(customSlotTypes) {
    // @TODO: Validate built in types? Maybe just a warning?
    if ((typeof (this.type) === 'string') && !this.builtinType) {
      if (!Array.from(customSlotTypes).includes(this.type)) {
        throw new ParserError(this.typeLocation, `the slot type named \`${this.type}\` is not defined \
anywhere`
        );
      }
    }
  }

  toModelV2(context, slots) {
    if (this.type == null) {
      throw new ParserError(null, `missing type for slot \`${this.name}\``);
    }

    if (Array.isArray(this.type)) {
      return slots.push({
        name: this.name.toString(),
        type: createSlotFromArray(context, this.name.toString(), this.type)
      });
    } else if (this.type.isFileFunctionReference) {
      return slots.push({
        name: this.name.toString(),
        type: compileSlot(context, this.type)
      });
    } else {
      return slots.push({
        name: this.name.toString(),
        type: this.type
      });
    }
  }
};

class Intent {
  static registerUtterance(location, utterance, intentName) {
    // Check if this utterance is already being handled by a different intent.
    if (Intent.allUtterances[utterance]) {
      const prevIntentName = Intent.allUtterances[utterance].intentName;
      const prevIntentLocation = Intent.allUtterances[utterance].location;
      if (prevIntentName !== intentName) {
        throw new ParserError(location, `The utterance '${utterance}' in the intent handler for '${intentName}' was already handled by the intent '${prevIntentName}' at ${formatLocationStart(prevIntentLocation)} -> utterances should be uniquely handled by a single intent: Alexa tries to map a user utterance to an intent, so one utterance being associated with multiple intents causes ambiguity (which intent was intended?)`);
      }
      // else, the utterance was already registered for this intent - nothing to do
    } else {
      // Otherwise, add the utterance to our tracking index.
      return Intent.allUtterances[utterance] = { intentName, location };
    }
  }

  static unregisterUtterances() {
    Intent.allUtterances = {};
  }

  static utteranceToName(location, utterance) {
    if (utterance.isUtterance) {
      return identifierFromString(location, utterance.toString());
    } else {
      return utterance;
    }
  }

  constructor(args) {
    this.location = args.location;
    const { utterance } = args;

    this.utterances = [];
    this.allLocations = [this.location];
    this.slots = {};

    if (utterance.isUtterance) {
      try {
        this.name = identifierFromString(this.location, utterance.toString());
      } catch (err) {
        throw new ParserError(this.location, `cannot use the utterance \`${utterance}\` as an intent name: ${err}`);
      }
      this.pushUtterance(utterance);
    } else {
      this.name = utterance;
      this.hasUtterances = false;
      this.validateBuiltIn();
    }

    this.builtin = builtInIntents.includes(this.name);
    this.hasContent = false;
    this.childIntents = [];
  }

  report() {
    return `${this.name} {${(() => {
      const result = [];
      for (let k in this.slots) {
        result.push(k);
      }
      return result;
    })()}}`;
  }

  validateStateTransitions(allStateNames, language) {
    return (this.startFunction != null ? this.startFunction.validateStateTransitions(allStateNames, language) : undefined);
  }

  validateBuiltIn() {
    const parts = this.name.split('.');
    const key = parts.shift();
    if (key in builtInReference) {
      const intents = builtInReference[key];
      if (!(parts in intents)) {
        throw new ParserError(this.location, `Unrecognized built in intent \`${this.name}\``);
      }
      return this.hasUtterances = true; // implied ones, even before extension ones
    }
  }

  // @TODO: plugin types?

  collectDefinedSlotTypes(context, customSlotTypes) {
    if (this.referenceIntent != null) { return; }
    try {
      return (() => {
        const result = [];
        for (let name in this.slots) {
          const slot = this.slots[name];
          result.push(slot.collectDefinedSlotTypes(context, customSlotTypes));
        }
        return result;
      })();
    } catch (err) {
      if (err.isParserError) { throw err; }
      throw new ParserError(this.location, err);
    }
  }

  validateSlotTypes(customSlotTypes) {
    if (this.referenceIntent != null) { return; }
    return (() => {
      const result = [];
      for (let name in this.slots) {
        const slot = this.slots[name];
        result.push(slot.validateSlotTypes(customSlotTypes));
      }
      return result;
    })();
  }

  supportsLanguage(language) {
    if (this.startFunction == null) {
      return true;
    }
    return language in this.startFunction.languages;
  }

  resetCode() {
    this.hasContent = false;
    return this.startFunction = null;
  }

  pushCode(line) {
    this.startFunction = this.startFunction != null ? this.startFunction : new Function;
    this.startFunction.pushLine(line);
    return this.hasContent = true;
  }

  pushUtterance(utterance) {
    let part;
    if (this.referenceIntent != null) {
      return this.referenceIntent.pushUtterance(utterance);
    }

    // normalize the utterance text to lower case: capitalization is irrelevant
    for (part of Array.from(utterance.parts)) {
      if (!part.isSlot) {
        part.text = part.text.toLowerCase();
      }
    }

    for (let u of Array.from(this.utterances)) {
      if (u.isEquivalentTo(utterance)) { return; }
    }

    this.utterances.push(utterance);
    this.hasUtterances = true;
    for (part of Array.from(utterance.parts)) {
      if (part.isSlot) {
        if (!this.slots[part.name]) {
          this.slots[part.name] = new lib.Slot(part.name);
        }
      }
    }

    return Intent.registerUtterance(this.location, utterance, this.name);
  }

  pushAlternate(parts) {
    this.hasAlternateUtterance = true;
    return this.pushUtterance(new lib.Utterance(parts));
  }

  pushChildIntent(intent) {
    return this.childIntents.push(intent.name);
  }

  hasChildIntents() {
    return this.childIntents.length > 0;
  }

  pushSlotType(location, name, type) {
    if (this.referenceIntent != null) {
      return this.referenceIntent.pushSlotType(location, name, type);
    }

    if (!(name in this.slots)) {
      throw new ParserError(location, `There is no slot named ${name} here`);
    }

    return this.slots[name].setType(location, type);
  }

  toLambda(output, options) {
    const indent = "    ";
    return (this.startFunction != null ? this.startFunction.toLambda(output, indent, options) : undefined);
  }

  hasStatementsOfType(types) {
    if (this.startFunction != null) {
      if (this.startFunction.hasStatementsOfType(types)) { return true; }
    }
    return false;
  }

  collectRequiredAPIs(apis) {
    return (this.startFunction != null ? this.startFunction.collectRequiredAPIs(apis) : undefined);
  }

  toUtterances(output) {
    if (this.referenceIntent != null) { return; }
    if (!this.hasUtterances) { return; }

    return Array.from(this.utterances).map((u) =>
      output.push(`${this.name} ${u.toUtterance()}`));
  }

  toModelV2(context) {
    if (this.referenceIntent != null) { return; }

    if (this.qualifier != null) {
      if (this.qualifier.isStatic()) {
        let condition = this.qualifier.evaluateStatic(context);
        if (this.qualifierIsInverted) {
          condition = !condition;
        }
        if (!condition) { return null; }
      } else {
        throw new ParserError(this.qualifier.location, "intent conditionals must be static expressions");
      }
    }

    const result =
      { name: this.name };

    // Check if we have a localization map, and if so whether we have translated utterances.
    /*
    const localizedIntent = __guard__(__guard__(__guard__(context.skill != null ? context.skill.projectInfo : undefined, x2 => x2.localization), x1 => x1.intents), x => x[this.name]);
    if ((context.language !== 'default') && (localizedIntent != null ? localizedIntent[context.language] : undefined)) {
      result.samples = localizedIntent[context.language];
    } else {
      result.samples = ( Array.from(this.utterances).map((u) => u.toModelV2(context)) );
    }
    */
    /*
    localizedIntent = context.skill?.projectInfo?.localization?.intents?[@name]
    if context.language != 'default' && (localizedIntent?[context.language])
      result.samples = localizedIntent[context.language]
    else
      result.samples = ( u.toModelV2(context) for u in @utterances )
    */
    const localizedIntent = context.skill
      && context.skill.projectInfo
      && context.skill.projectInfo.localization
      && context.skill.projectInfo.localization.intents
      && context.skill.projectInfo.localization.intents[this.name]
      ;
    const hasLocalizedIntent = localizedIntent && localizedIntent[context.language];
    if (context.language !== 'default' && hasLocalizedIntent) {
      result.samples = localizedIntent[context.language];
    } else {
      result.samples = this.utterances.map(u => u.toModelV2(context));
    }

    if (this.slots) {
      const slots = [];
      for (let name in this.slots) {
        const slot = this.slots[name];
        try {
          slot.toModelV2(context, slots);
        } catch (err) {
          throw new ParserError(this.location, `error writing intent \`${this.name}\`: ${err}`);
        }
      }
      if (slots.length > 0) {
        result.slots = slots;
      }
    }

    return result;
  }

  toLocalization(localization) {
    if (this.startFunction != null) {
      this.startFunction.toLocalization(localization);
    }

    const name = this.name;
    return this.utterances.map(utterance => {
      // replace any $slot with {slot}
      const finalUtterance = utterance.toModelV2();
      if (!localization.intents[name].default.includes(finalUtterance)) {
        return localization.intents[name].default.push(finalUtterance);
      }
    });
  }
};

// Use a static index to track instances of { utterance: { intentName, location } },
// so we can check for identical utterances being ambiguously handled by different intents.
Intent.allUtterances = {};

// Class that supports intent filtering.
class FilteredIntent extends Intent {
  constructor(args) {
    super(args);
    this.startFunction = new FunctionMap;
    this.intentFilters = {};
  }

  // Method to filter intents via a passed filter function; can trigger optional callbacks.
  // @param name ... name used for scoping
  // @param data ... this is filter data that can be used to persist pegjs pattern data
  // @param filter ... function(request, data) that returns true/false for the incoming request
  // @param callback ... lambda code that can be run if a filtered intent is found
  setCurrentIntentFilter({ name, data, filter, callback }) {
    this.startFunction.setCurrentName(name);

    return this.intentFilters[name] = {
      data,
      filter,
      callback
    };
  }

  toLambda(output, options) {
    const indent = '    ';

    // '__' is our catch-all default -> do not apply any filter
    if (this.intentFilters['__']) {
      options.scopeManager.pushScope(this.location, this.name);
      output.push(`${indent}// Unfiltered intent handling logic.`);
      this.startFunction.toLambda(output, indent, options, '__');
      options.scopeManager.popScope(this.location);
      delete this.intentFilters['__']; // remove default, so we can easily check if any filters remain
    }

    if (Object.keys(this.intentFilters).length > 0) {
      output.push(`${indent}// Filtered intent handling logic.`);
      output.push(`${indent}let __intentFilter;`);

      return (() => {
        const result = [];
        for (let intentFilterName in this.intentFilters) {
          const intentFilter = this.intentFilters[intentFilterName];
          if (!intentFilter) { continue; }
          options.scopeManager.pushScope(this.location, `${this.name}:${intentFilterName}`);
          const filterFuncString = Utils.stringifyFunction(intentFilter.filter, `${indent}  `);
          output.push(`${indent}__intentFilter = ${filterFuncString}`);
          output.push(`${indent}if (__intentFilter(context.event.request, ${JSON.stringify(intentFilter.data)})) {`);

          // If the filter specified a callback, run it before proceeding to the intent handler.
          if (intentFilter.callback != null) {
            const callbackString = Utils.stringifyFunction(intentFilter.callback, `${indent}    `);
            output.push(`${indent}  await (${callbackString})();`);
          }

          // Inject the filtered intent handler.
          this.startFunction.toLambda(output, `${indent}  `, options, intentFilterName);
          output.push(`${indent}}`);
          result.push(options.scopeManager.popScope(this.location));
        }
        return result;
      })();
    }
  }
};

const lib = {
  Utterance,
  Slot,
  Intent,
  FilteredIntent,
};

module.exports = {
  lib
};
