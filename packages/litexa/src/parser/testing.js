/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS202: Simplify dynamic range loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const lib = {};
const uuid = require('uuid');
const fs = require('fs');
const path = require('path');

const directiveValidators = {};

const { JSONValidator } = require('./jsonValidator').lib;

directiveValidators['AudioPlayer.Play'] = () => [];
directiveValidators['AudioPlayer.Stop'] = () => [];
directiveValidators['Hint'] = () => [];

const validateSSML = function(skill, line) {
  const errors = [];
  let audioCount = 0;
  const audioFinder = /\<\s*audio/gi;
  let match = audioFinder.exec(line);
  while (match) {
    audioCount += 1;
    match = audioFinder.exec(line);
  }
  if (audioCount > 5) {
    errors.push("more than 5 <audio/> tags in one response");
  }
  return errors;
};

class ParserError extends Error {
  constructor(location, message) {
    super();
    this.location = location;
    this.message = message;
  }
}

class TrapLog {
  constructor(passLog, passError) {
    let errors, logs, oldError, oldLog;
    this.logs = (logs = []);
    this.errors = (errors = []);
    this.oldLog = (oldLog = console.log);
    this.oldError = (oldError = console.error);
    console.log = function() {
      return (() => {
        const result = [];
        for (let a of Array.from(arguments)) {
          if (typeof(a) === 'string') {
            logs.push(a);
            if (passLog != null) {
              result.push(passLog(a));
            } else {
              result.push(undefined);
            }
          } else {
            const text = JSON.stringify(a);
            logs.push(text);
            if (passLog != null) {
              result.push(passLog(text));
            } else {
              result.push(undefined);
            }
          }
        }
        return result;
      })();
    };

    console.error = function() {
      return (() => {
        const result = [];
        for (let a of Array.from(arguments)) {
          logs.push("ERROR: " + a);
          errors.push(a);
          if (passError != null) {
            result.push(passError(a));
          } else {
            result.push(undefined);
          }
        }
        return result;
      })();
    };
  }

  stop(flush) {
    console.log = this.oldLog;
    console.error = this.oldError;
    if (flush) {
      return console.log(this.logs.join('\n'));
    }
  }
}


const makeBaseRequest = function(skill) {
  // all requests start out looking like this
  const req = {
    session: {
      sessionId: "SessionId.uuid",
      application: {
        applicationId: "amzn1.ask.skill.uuid"
      },
      attributes: {},
      user: {
        userId: "amzn1.ask.account.stuff"
      },
      new: false
    },
    context: {
      System: {
        device: {
          deviceId: "someDeviceId"
        },
        user: {
          userId: "amzn1.ask.account.stuff"
        },
        application: {
          applicationId: "amzn1.ask.skill.uuid"
        }
      }
    },
    request : null,
    version: "1.0"
  };
  const device = skill.testDevice != null ? skill.testDevice : 'dot';

  switch (device) {
    case 'dot': case 'echo':
      var dev = req.context.System.device;
      break;
    case 'show':
      dev = req.context.System.device;
      dev.supportedInterfaces = {
        'Alexa.Presentation.APL': {},
        'Alexa.Presentation.HTML': {},
        Display: {}
      };
      break;
    default:
      throw new Error(`Unknown test device type ${device}`);
  }

  req.__logStateTraces = skill.testLoggingTraceStates;
  req.__reportStateTrace = true;
  return req;
};

const makeHandlerIdentity = function(skill) {
  const event = makeBaseRequest(skill);
  const identity = {};
  if ((event.context != null ? event.context.System : undefined) != null) {
    identity.requestAppId = event.context.System.application != null ? event.context.System.application.applicationId : undefined;
    identity.userId = event.context.System.user != null ? event.context.System.user.userId : undefined;
    identity.deviceId = event.context.System.device != null ? event.context.System.device.deviceId : undefined;
  } else if (event.session != null) {
    identity.requestAppId = event.session.application != null ? event.session.application.applicationId : undefined;
    identity.userId = event.session.user != null ? event.session.user.userId : undefined;
    identity.deviceId = 'no-device';
  }
  return identity;
};

const makeRequestId = () => `litexaRequestId.${uuid.v4()}`;

const makeLaunchRequest = function(skill, time, locale) {
  // launch requests are uniform, they just have this tacked onto the base
  const req = makeBaseRequest(skill);
  req.session.new = true;
  req.request = {
    type: "LaunchRequest",
    requestId: makeRequestId(),
    timestamp: new Date(time).toISOString(),
    locale
  };
  return req;
};

const makeIntentRequest = function(skill, name, slots, time, locale) {
  // intent requests need the name and slots interpolated in
  if (!skill.hasIntent(name, locale)) {
    throw `Skill does not have intent ${name}`;
  }

  const req = makeBaseRequest(skill);
  req.request = {
    type: "IntentRequest",
    requestId: makeRequestId(),
    timestamp: new Date(time).toISOString(),
    locale,
    intent: {
      name,
      slots: {}
    }
  };

  if (slots != null) {
    for (name in slots) {
      const value = slots[name];
      req.request.intent.slots[name] = {name, value};
    }
  }
  return req;
};

const makeSessionEndedRequest = function(skill, reason, time, locale) {
  const req = makeBaseRequest(skill);
  req.request = {
    type: "SessionEndedRequest",
    requestId: makeRequestId(),
    timestamp: new Date(time).toISOString(),
    reason,
    locale,
    error: {
      type: "string",
      message: "string"
    }
  };
  return req;
};


const findIntent = function(skill, line) {
  // given an expressed utterance, figure out which intent
  // it could match, and what its slots would be
  const candidates = [];
  for (let stateName in skill.states) {
    const state = skill.states[stateName];
    if (state.intents == null) { continue; }
    for (let intentName in state.intents) {
      const intent = state.intents[intentName];
      for (let utterance of Array.from(intent.utterances)) {
        const [score, slots] = Array.from(utterance.parse(line));
        if (slots != null) {
          candidates.push([score, [intent, slots]]);
        }
      }
    }
  }
  if (!(candidates.length > 0)) {
    return [null, null];
  }
  candidates.sort(function(a,b) {
    if (a[0] > b[0]) { return -1; }
    if (a[0] < b[0]) { return 1; }
    return 0;
  });
  return candidates[0][1];
};


// Function that evenly left/right pads a String with a paddingChar, until targetLength is reached.
const padStringWithChars = function({ str, targetLength, paddingChar }) {
  str = str != null ? str : 'MISSING_STRING';

  const numCharsPreStr = Math.max(Math.floor((targetLength - str.length) / 2), 0);
  str = `${paddingChar.repeat(numCharsPreStr)}${str}`;

  const numCharsPostStr = Math.max(targetLength - str.length, 0);
  str = `${str}${paddingChar.repeat(numCharsPostStr)}`;

  return str;
};


const collectSays = function(skill, lambda) {
  const result = [];
  let state = null;

  var collect = function(part) {
    let sample;
    if (part.isSay) {
      sample = "";
      try {
        sample = part.express({
          slots: {},
          lambda,
          noDatabase: true,
          language: skill.testLanguage
        });
      } catch (e) {
        console.log(e);
        throw new ParserError(part.location, `Failed to express say \`${part}\`: ${e.toString()}`);
      }
      if (sample) {
        result.push({
          part,
          state,
          sample
        });
      }
    } else if (part.isSoundEffect) {
      sample = part.toSSML(skill.testLanguage);
      result.push({
        part,
        state,
        sample
      });
    }
    if (part.startFunction != null) {
      return part.startFunction.forEachPart(skill.testLanguage, collect);
    }
  };


  for (let stateName in skill.states) {
    state = skill.states[stateName];
    if (state.startFunction != null) {
      state.startFunction.forEachPart(skill.testLanguage, collect);
    }

    for (let intentName in state.intents) {
      const intent = state.intents[intentName];
      if (intent.startFunction != null) {
        intent.startFunction.forEachPart(skill.testLanguage, collect);
      }
    }
  }

  result.sort(function(a, b) {
    if (a.sample.length > b.sample.length) { return -1; }
    if (a.sample.length < b.sample.length) { return 1; }
    return 0;
  });

  return result;
};


const grindSays = function(language, allSays, line) {
  // try to categorize every part of this string into
  // one of the say statements, anywhere in the skill
  const ctx = {
    remainder: line,
    says: []
  };

  while (ctx.remainder.length > 0) {
    let found = false;
    for (let s of Array.from(allSays)) {
      const match = s.part.matchFragment(language, ctx.remainder, true);
      if (match != null) {
        if (match.offset === 0) {
          found = true;
          ctx.remainder = match.reduced;
          ctx.says.push([line.indexOf(match.removed), match.part, match.removed]);
          break;
        }
      }
    }
    if (!found) { return ctx; }
  }
  return ctx;
};

class ExpectedExactSay {
  // verbatim text match, rather than say string search
  constructor(location, line) {
    this.location = location;
    this.line = line;
  }

  test(skill, context, result) {
    // compare without the say markers
    let test = result.speech != null ? result.speech : "";
    test = test.replace(/\s/g, ' ');

    test = abbreviateTestOutput(test, context);
    this.line = abbreviateTestOutput(this.line, context);

    if (this.line !== test) {
      throw new ParserError(this.location, `speech did not exactly match \`${this.line}\``);
    }
  }
}

class ExpectedRegexSay {
  // given a regex, rather than constructing one
  constructor(location, regex) {
    this.location = location;
    this.regex = regex;
  }

  test(skill, context, result) {
    // compare without the say markers
    let test = result.speech != null ? result.speech : "";
    test = test.replace(/\s/g, ' ');

    const abbreviatedTest = abbreviateTestOutput(test, context);
    const regexp = new RegExp(this.regex.expression, this.regex.flags);
    if (!test.match(regexp) && !abbreviatedTest.match(regexp)) {
      throw new ParserError(this.location, `speech did not match regex \`/${this.regex.expression}/${this.regex.flags}\``);
    }
  }
}

class ExpectedSay {
  // expect all say statements that concatenate into @line
  constructor(location, line) {
    this.location = location;
    this.line = line;
  }

  test(skill, context, result) {
    // step 1 identify the say statements
    const testLine = this.line.express(context);
    const collected = grindSays(skill.testLanguage, context.allSays, testLine);
    collected.remainder = collected.remainder.replace(/(^[ ]+)/, '');
    collected.remainder = collected.remainder.replace(/([ ]+$)/, '');
    if (collected.remainder.length !== 0) {
      throw new ParserError(this.location, `no say statements match \`${collected.remainder}\` out of \
\`${testLine}\``
      );
    }

    // step 2, check to see that the response can
    // match each say, in order
    let remainder = result.speech;
    remainder = abbreviateTestOutput(remainder, context);
    for (let sayIndex = 0; sayIndex < collected.says.length; sayIndex++) {
      const sayInfo = collected.says[sayIndex];
      const match = sayInfo[1].matchFragment(skill.testLanguage, remainder, true);
      if (match == null) {
        throw new ParserError(this.location, `failed to match expected segment ${sayIndex} \
\`${sayInfo[2]}\`, seeing \`${remainder}\` instead`
        );
      }
      if (match.offset !== 0) {
        throw new ParserError(this.location, `say statement appeared out of order \`${match.removed}\``);
      }
      remainder = match.reduced;
    }

    if (remainder.length !== 0) {
      throw new ParserError(this.location, `unexpected extra speech, \`${remainder}\``);
    }
  }
}


class ExpectedState {
  // expect the state in the response to be @name
  constructor(location, name) {
    this.location = location;
    this.name = name;
  }

  test(skill, context, result) {
    const data = context.db.getVariables(makeHandlerIdentity(skill));
    if (this.name === 'null') {
      if (data.__currentState !== null) {
        throw new ParserError(this.location, `response was in state \`${data.__currentState}\` instead of \
expected empty null state`
        );
      }
      return;
    }

    if (!(this.name in skill.states)) {
      throw new ParserError(this.location, `test specifies unknown state \`${this.name}\``);
    }

    if (data.__currentState !== this.name) {
      throw new ParserError(this.location, `response was in state \`${data.__currentState}\` instead of \
expected \`${this.name}\``
      );
    }
  }
}


const comparatorNames = {
  "==": "equal to",
  "!=": "unequal to",
  ">=": "greater than equal to",
  "<=": "less than or equal to",
  ">": "greater than",
  "<": "less than"
};

class ExpectedDB {
  // expect the value in the db to be this
  constructor(location, reference, op, tail) {
    this.location = location;
    this.reference = reference;
    this.op = op;
    this.tail = tail;
  }

  test(skill, context, result) {
    const data = context.db.getVariables(makeHandlerIdentity(skill));
    let value = this.reference.readFrom(data);
    if (value == null) {
      throw new ParserError(this.location, `db value \`${this.reference}\` didn't exist`);
    }
    const tail = JSON.stringify(eval(this.tail));
    if (!eval(`value ${this.op} ${tail}`)) {
      value = JSON.stringify(value);
      throw new ParserError(this.location, `db value \`${this.reference}\` was \`${value}\`, not \
${comparatorNames[this.op]} \`${tail}\``
      );
    }
  }
}


class ExpectedEndSession {
  static initClass() {

    this.prototype.isExpectedEndSession = true;
  }
  // expect the response to indicate the session should end
  constructor(location) {
    this.location = location;
  }

  test(skill, context, result) {
    if (!result.data.response.shouldEndSession) {
      throw new ParserError(this.location, "session did not indicate it should end as expected");
    }
  }
}
ExpectedEndSession.initClass();

class ExpectedContinueSession {
  static initClass() {

    this.prototype.isExpectedContinueSession = true;
  }
  constructor(location, kinds) {
    this.location = location;
    this.kinds = kinds;
  }

  test(skill, context, result) {
    if (Array.from(this.kinds).includes('microphone')) {
      if (result.data.response.shouldEndSession !== false) {
        throw new ParserError(this.location, "skill is not listening for microphone");
      }
    } else {
      if (result.data.response.shouldEndSession != null) {
        throw new ParserError(this.location, "skill is not listening for events, without microphone");
      }
    }
  }
}
ExpectedContinueSession.initClass();

class ExpectedDirective {
  static initClass() {

    this.prototype.isExpectedDirective = true;
  }
  // expect the response to indicate the session should end
  constructor(location, name) {
    this.location = location;
    this.name = name;
  }

  test(skill, context, result) {
    if (result.data.response.directives == null) {
      throw new ParserError(this.location, `response did not contain any directives, expected ${this.name}`);
    }
    let found = false;
    for (let directive of Array.from(result.data.response.directives)) {
      if (directive.type === this.name) {
        found = true;
        break;
      }
    }
    if (!found) {
      const types = ( Array.from(result.data.response.directives).map((d) => d.type) );
      throw new ParserError(this.location, `response did not contain expected directive ${this.name}, instead had [${types}]`);
    }
  }
}
ExpectedDirective.initClass();


class ResponseGeneratingStep {
  static initClass() {

    this.prototype.isResponseGeneratingStep = true;
  }
  constructor() {
    this.expectations = [];
  }

  pushExpectation(obj) {
    return this.expectations.push(obj);
  }

  checkForSessionEnd() {
    let should = null;
    let shouldnot = null;
    for (let e of Array.from(this.expectations)) {
      if (e.isExpectedContinueSession) {
        should = e;
      }
      if (e.isExpectedEndSession) {
        shouldnot = e;
      }
    }
    if ((should != null) && (shouldnot != null)) {
      throw new Error("TestError: step expects the session to end and not to end");
    }
    if (should == null) {
      if (shouldnot == null) {
        return this.expectations.push(new ExpectedContinueSession(this.location));
      }
    }
  }

  makeResult() {
    return {
      expectationsMet: true,
      errors: [],
      logs: []
    };
  }

  processEvent({ result, skill, lambda, context, resultCallback }) {
    const {
      event
    } = result;
    event.session.attributes = context.attributes;
    let trap = null;

    try {
      trap = new TrapLog;
      return lambda.handler(event, {}, (err, data) => {
        trap.stop(false);

        const cleanSpeech = function(data) {
          let speech = data != null ? data.text : undefined;
          if (!speech) {
            speech = data != null ? data.ssml : undefined;
            if (speech) {
              speech = speech.replace("<speak>", '');
              speech = speech.replace("</speak>", '');
            }
          }
          return speech;
        };

        result.err = err;
        result.data = data;
        result.speech = cleanSpeech(__guard__(result.data != null ? result.data.response : undefined, x => x.outputSpeech));
        if (__guard__(result.data != null ? result.data.response : undefined, x1 => x1.reprompt) != null) {
          result.reprompt = cleanSpeech(result.data.response.reprompt.outputSpeech);
        }
        if ((result.data != null ? result.data.sessionAttributes : undefined) != null) {
          context.attributes = result.data.sessionAttributes;
        }

        if (__guard__(result.data != null ? result.data.response : undefined, x2 => x2.card) != null) {
          const card = __guard__(result.data != null ? result.data.response : undefined, x3 => x3.card);
          result.card = card;
          result.cardReference = card.title;
        }

        if (__guard__(result.data != null ? result.data.response : undefined, x4 => x4.directives) != null) {
          result.directives = [];
          for (let index = 0; index < result.data.response.directives.length; index++) {
            const d = result.data.response.directives[index];
            if (typeof(d) !== 'object') {
              result.errors.push(`directive ${index} was not even an object. Pushed something wrong into the array?`);
              continue;
            }

            try {
              result.directives.push(JSON.parse(JSON.stringify(d)));
            } catch (error) {
              err = error;
              result.errors.push(`directive ${index} could not be JSON serialized, maybe contains circular reference and or non primitive values?`);
            }
          }
        }

        for (let expectation of Array.from(this.expectations)) {
          try {
            expectation.test(skill, context, result);
          } catch (ex) {
            result.errors.push(ex.message);
            result.expectationsMet = false;
          }
        }

        for (let l of Array.from(trap.logs)) { result.logs.push(l); }
        for (let e of Array.from(trap.errors)) { result.errors.push(e); }
        result.shouldEndSession = __guard__(result.data != null ? result.data.response : undefined, x5 => x5.shouldEndSession);
        return resultCallback(null, result);
      });

    } catch (error) {
      const ex = error;
      result.err = ex;
      if (trap != null) {
        trap.stop(true);
        for (let l of Array.from(trap.logs)) { result.logs.push(l); }
        for (let e of Array.from(trap.errors)) { result.errors.push(e); }
      }
      return resultCallback(ex, result);
    }
  }
}
ResponseGeneratingStep.initClass();

class RequestStep extends ResponseGeneratingStep {
  static initClass() {

    this.prototype.isVoiceStep = true;
  }
  constructor(location, name, source) {
    super();
    this.location = location;
    this.name = name;
    this.source = source;
  }

  run({ skill, lambda, context, resultCallback }) {
    const result = this.makeResult();
    context.attributes = {};
    result.intent = "LaunchRequest";
    const event = makeBaseRequest( skill );
    event.request = { type: this.name };
    result.event = event;
    return this.processEvent({ result, skill, lambda, context, resultCallback });
  }
}
RequestStep.initClass();

class LaunchStep extends ResponseGeneratingStep {
  static initClass() {

    this.prototype.isVoiceStep = true;
  }
  constructor(location, say, intent) {
    super();
    this.location = location;
    this.say = say;
    this.intent = intent;
  }

  run({ skill, lambda, context, resultCallback }) {
    const result = this.makeResult();
    context.attributes = {};
    result.intent = "LaunchRequest";
    const event = makeLaunchRequest( skill, context.time, skill.testLanguage );
    result.event = event;
    return this.processEvent({ result, skill, lambda, context, resultCallback });
  }
}
LaunchStep.initClass();

class VoiceStep extends ResponseGeneratingStep {
  static initClass() {

    this.prototype.isVoiceStep = true;
  }
  constructor(location, say, intent, values) {
    super();
    let v;
    this.location = location;
    this.say = say;
    this.intent = intent;
    this.values = {};
    if (values != null) {
      for (v of Array.from(values)) {
        this.values[v[0]] = { value:v[1] };
      }
    }
    if (this.say != null) {
      for (let alt of Array.from(this.say.alternates)) {
        for (let i = 0; i < alt.length; i++) {
          const part = alt[i];
          if (part != null ? part.isSlot : undefined) {
            if (!(part.name in this.values)) {
              throw new ParserError(this.location, `test say statements has \
named slot $${part.name}, but no value for it`
              );
            }
            part.fixedValue = this.values[part.name].value;
            this.values[part.name].found = true;
          }
        }
      }
      for (let k in this.values) {
        v = this.values[k];
        if (!v.found) {
          throw new ParserError(this.location, `test say statement specifies \
value for unknown slot ${k}`
          );
        }
      }
    }
  }

  run({ skill, lambda, context, resultCallback }) {
    let event;
    const result = this.makeResult();
    if (this.intent != null) {
      result.intent = this.intent;
      result.slots = {};
      for (let k in this.values) {
        const v = this.values[k];
        result.slots[k] = v.value;
      }
      event = makeIntentRequest( skill, this.intent, result.slots, context.time, skill.testLanguage );
    } else if (this.say != null) {
      let name;
      result.expressed = this.say.express(context);
      const [intent, slots] = Array.from(findIntent(skill, result.expressed));
      for (name in slots) {
        const value = slots[name];
        if (name in this.values) {
          slots[name] = this.values[name].value;
        }
      }
      if (intent == null) {
        resultCallback(new Error(`couldn't match \`${result.expressed}\` to any intents`));
        return;
      }
      result.intent = intent.name;
      result.slots = slots;
      event = makeIntentRequest( skill, intent.name, slots, context.time, skill.testLanguage );
    } else {
      resultCallback(new Error("Voice step has neither say nor intent"));
      return;
    }

    result.event = event;
    return this.processEvent({ result, skill, lambda, context, resultCallback });
  }
}
VoiceStep.initClass();


class DBFixupStep {
  static initClass() {

    this.prototype.isDBFixupStep = true;
  }
  constructor(reference, code) {
    this.reference = reference;
    this.code = code;
  }

  run({ skill, lambda, context, resultCallback }) {
    try {
      const identity = makeHandlerIdentity(skill);
      const data = context.db.getVariables(identity);
      this.reference.evalTo(data, this.code);
      context.db.setVariables(identity, data);
      return resultCallback(null, {});
    } catch (err) {
      return resultCallback(err, {});
    }
  }
}
DBFixupStep.initClass();


class WaitStep {
  static initClass() {

    this.prototype.isWaitStep = true;
  }
  constructor(duration) {
    this.duration = duration;
  }

  run({ skill, lambda, context, resultCallback }) {
    context.time += this.duration;
    context.alreadyWaited = true;
    return resultCallback(null, {});
  }
}
WaitStep.initClass();

class StopStep {
  static initClass() {

    this.prototype.isStopStep = true;
  }
  constructor(reason) {
    this.reason = reason;
    this.requestReason = (() => { switch (this.reason) {
      case 'quit': return 'USER_INITIATED';
      case 'drop': return 'EXCEEDED_MAX_REPROMPTS';
      default: return 'USER_INITIATED';
    } })();
  }

  run({ skill, lambda, context, resultCallback }) {
    try {
      const event = makeSessionEndedRequest( skill, this.requestReason, context.time, skill.testLanguage );
      return lambda.handler(event, {}, (err, data) => {
        return resultCallback(err, data);
      });
    } catch (error) {
      const err = error;
      return resultCallback(err, {});
    }
  }
}
StopStep.initClass();

class SetRegionStep {
  constructor(region) {
    this.region = region;
  }
  run({ skill, lambda, context, resultCallback }) {
    skill.testLanguage = this.region;
    return resultCallback(null, {});
  }
  report({ err, logs, sourceLine, step, output, result, context }) {
    return logs.push(`setting region to ${step.region}`);
  }
}


class SetLogStateTraces {
  constructor(location, value) {
    this.location = location;
    this.value = value;
  }
  run({ skill, lambda, context, resultCallback }) {
    skill.testLoggingTraceStates = this.value;
    return resultCallback(null, {});
  }
  report({ err, logs, sourceLine, step, output, result, context }) {
    if (this.value) {
      return logs.push("enabling state tracing");
    } else {
      return logs.push("disabling state tracing");
    }
  }
}


class CaptureStateStep {
  constructor(location, name) {
    this.location = location;
    this.name = name;
  }
  run({ skill, lambda, context, resultCallback }) {
    context.captures[this.name] = {
      db: context.db.getVariables(makeHandlerIdentity(skill)),
      attr: JSON.stringify(context.attributes)
    };
    return resultCallback(null, {});
  }
  report({ err, logs, sourceLine, step, output, result, context }) {
    return logs.push(`${sourceLine} captured state as '${this.name}'`);
  }
}

class ResumeStateStep {
  constructor(location, name) {
    this.location = location;
    this.name = name;
  }
  run({ skill, lambda, context, resultCallback }) {
    if (!(this.name in context.captures)) {
      throw new ParserError(this.location, `No state named ${this.name} to resume here`);
    }
    const state = context.captures[this.name];
    context.db.setVariables(makeHandlerIdentity(skill),state.db);
    context.attributes = JSON.parse(state.attr);
    return resultCallback(null, {});
  }
  report({ err, logs, sourceLine, step, output, result, context }) {
    return logs.push(`${sourceLine} resumed from state '${this.name}'`);
  }
}


const validateDirective = function(directive, context) {
  let e;
  let validatorFunction = directiveValidators[directive.type];

  if (validatorFunction == null) {
    // no? Try the ones from any loaded extensions
    validatorFunction = context.skill.directiveValidators[directive.type];
  }

  if (validatorFunction == null) {
    if ((context.skill.projectInfo != null ? context.skill.projectInfo.directiveWhitelist : undefined) != null) {
      if (Array.from(context.skill.projectInfo != null ? context.skill.projectInfo.directiveWhitelist : undefined).includes(directive.type)) { return null; }
    }
    return [ `unknown directive type ${directive.type}` ];
  }
  try {
    const validator = new JSONValidator(directive);
    validatorFunction(validator);
    if (validator.errors.length > 0) {
      return (() => {
        const result = [];
         for (e of Array.from(validator.errors)) {           result.push(e.toString());
        }
        return result;
      })();
    }
  } catch (error) {
    e = error;
    return [ e.toString() ];
  }
  return null;
};


var abbreviateTestOutput = function(line, context) {
  if (line == null) { return null; }
  // shorten audio
  let cleanedBucket = (context.testContext.litexa != null ? context.testContext.litexa.assetsRoot : undefined) != null ? (context.testContext.litexa != null ? context.testContext.litexa.assetsRoot : undefined) : '';
  cleanedBucket += context.testContext.language + "/";
  cleanedBucket = cleanedBucket.replace(/\-/gi, '\\-');
  cleanedBucket = cleanedBucket.replace(/\./gi, '\\.');
  cleanedBucket = cleanedBucket.replace(/\//gi, '\\/');

  // audio src=
  const audioFinderRegex = `<audio\\s+src='${cleanedBucket}([\\w\\/\\-_\\.]*)\\.mp3'/>`;
  line = abbreviateRegexReplacer(line, audioFinderRegex, "<", ".mp3>");

  // SFX URLs/soundbanks
  const audioUrlFinderRegex = "<audio\\s+src=['\"]([a-zA-Z0-9_\\-\\.\\/\\:]*)['\"]/>";
  line = abbreviateRegexReplacer(line, audioUrlFinderRegex);

  // SFX shorthand
  const sfxUrlFinderRegex = "<sfx\\s+['\"]?([a-zA-Z0-9_\\-\\.\\/\\:]*)['\"]?>";
  line = abbreviateRegexReplacer(line, sfxUrlFinderRegex);

  // also interjections
  const interjectionFinderRegex = "<say-as.interpret-as='interjection'>([^<]*)<\\/say-as>";
  line = abbreviateRegexReplacer(line, interjectionFinderRegex, "<!");

  // also breaks
  const breakFinderRegex = "<break.time='(([0-9]+)((s)|(ms)))'\\/>";
  line = abbreviateRegexReplacer(line, breakFinderRegex, "<...");

  // clean up any white space oddities
  line = line.replace(/\s/g, ' ');
  return line;
};


var abbreviateRegexReplacer = function(line, regex, matchPrefix, matchSuffix) {
  if (matchPrefix == null) { matchPrefix = '<'; }
  if (matchSuffix == null) { matchSuffix = '>'; }
  regex = new RegExp(regex, 'i');
  let match = regex.exec(line);

  while (match != null) {
    line = line.replace(match[0], `${matchPrefix}${match[1]}${matchSuffix}`);
    match = regex.exec(line);
  }

  return line;
};


const functionStripper = /function\s*\(\s*\)\s*{\s*return\s*([^}]+);\n\s*}$\s*$/;

class TestLibrary {
  constructor(target, testContext) {
    this.target = target;
    this.testContext = testContext;
    this.counter = 0;
  }

  error(message) {
    throw new Error(`[${this.counter}] `  + message);
  }
  equal(a, b) {
    this.counter += 1;
    if (a !== b) {
      return this.error(`${a} didn't equal ${b}`);
    }
  }
  check(condition) {
    this.counter += 1;
    const result = condition();
    if (!result) {
      const match = functionStripper.exec(condition.toString());
      return this.error(`false on ${(match != null ? match[1] : undefined) != null ? (match != null ? match[1] : undefined) : condition}`);
    }
  }
  report(message) {
    if (typeof(message) !== 'string') {
      message = JSON.stringify(message);
    }
    return this.target.messages.push(`  t! ${message}`);
  }
  warning(message) {
    if (typeof(message) !== 'string') {
      message = JSON.stringify(message);
    }
    return this.target.messages.push(` t✘! ${message}`);
  }
  expect(name, condition) {
    const startLine = this.target.messages.length;
    this.counter = 0;
    try {
      let doTest = true;
      if (this.target.filters) {
        doTest = false;
        for (let f of Array.from(this.target.filters)) {
          if (name.indexOf(f) >= 0) {
            doTest = true;
          }
        }
      }
      if (doTest) {
        condition();
        return this.target.reportTestCase(null, name, startLine);
      }
    } catch (err) {
      return this.target.reportTestCase(err, name, startLine);
    }
  }
  directives(title, directives) {
    let report;
    this.counter += 1;
    if (!Array.isArray(directives)) {
      directives = [directives];
    }
    let failed = false;
    for (let idx = 0; idx < directives.length; idx++) {
      const d = directives[idx];
      report = validateDirective(d, this.testContext);
      if (report === null) { continue; }
      if (report.length === 1) {
        failed = true;
        this.target.messages.push(`  ✘ ${title}[${idx}]: ${report[0]}`);
      } else if (report.length > 1) {
        failed = true;
        this.target.messages.push(`  ✘ ${title}[${idx}]`);
        for (let r of Array.from(report)) {
          this.target.messages.push(`     ✘ ${r}`);
        }
      }
    }
    if (!failed) {
      return this.report(`${title} OK`);
    }
  }
}


class CodeTest {
  constructor(file) {
    this.file = file;
  }

  test(testContext, output, resultCallback) {
    const { skill, db, lambda } = testContext;
    Test = new TestLibrary(this, testContext);
    this.messages = [];
    this.successes = 0;
    this.failures = 0;
    Test.target = this;
    let {
      exception
    } = this.file;

    const catchLog = str => this.messages.push("  c! " + str);
    const catchError = str => this.messages.push(" c✘! " + str);
    const trap = new TrapLog(catchLog, catchError);

    this.testCode = null;
    let fileCode = null;
    if (exception == null) {
      try {
        fileCode = this.file.contentForLanguage(skill.testLanguage);

        const localTestRootFormatted = skill.projectInfo.testRoot.replace(/\\/g, '/');
        const localAssetsRootFormatted = path.join(testContext.litexaRoot, 'assets').replace(/\\/g, '/');
        const modulesRootFormatted = path.join(testContext.litexaRoot).replace(/\\/g, '/');
        this.testCode = [
          `\
exports.litexa = {
  assetsRoot: 'test://',
  localTesting: true,
  localTestRoot: '${localTestRootFormatted}',
  localAssetsRoot: '${localAssetsRootFormatted}',
  modulesRoot: '${modulesRootFormatted}'
};\
`,
          skill.libraryCode,
          skill.testLibraryCodeForLanguage(skill.testLanguage),
          "initializeExtensionObjects({})",
          fileCode.js != null ? fileCode.js : fileCode
        ].join('\n');
        fs.writeFileSync(path.join(testContext.testRoot, this.file.name + '.log'), this.testCode, 'utf8');
        eval(this.testCode);
      } catch (e) {
        exception = e;
      }
    }
    trap.stop(false);

    if (exception != null) {
      let l;
      output.log.push(`✘ code test: ${this.file.name}, failed`);
      let location = '';
      if (exception.location != null) {
        l = exception.location;
        location = `[${l.first_line}:${l.first_column}] `;
      } else if (exception.stack) {
        const match = (/at eval \((.*)\)/i).exec(exception.stack);
        if (match) { location = `[${match[1]}] `; }
      }
      output.log.push(`  ✘ ${location}${exception.message != null ? exception.message : ("" + exception)}`);
      for (l of Array.from(trap.logs)) { output.log.push(` c!: ${l}`); }
      return resultCallback(this.file.exception, false);
    } else {
      if (this.failures === 0) {
        if (this.successes > 0) {
          this.messages.unshift(`✔ ${this.file.filename()}, ${this.successes} tests passed`);
        }
      } else {
        this.messages.unshift(`✘ ${this.file.filename()}, ${this.failures} tests failed, ${this.successes} passed`);
      }

      if (this.messages.length > 0) {
        output.log.push(this.messages.join('\n'));
      }

      return resultCallback(null, this.successes, this.failures);
    }
  }

  reportTestCase(err, name, startLine) {
    startLine = startLine != null ? startLine : this.messages.length;
    if (err != null) {
      this.failures += 1;
      this.messages.splice(startLine, 0, `  ✘ ${this.file.filename()} '${name}': ${err.message}`);
    } else {
      this.successes += 1;
      this.messages.splice(startLine, 0, `  ✔ ${this.file.filename()} '${name}'`);
    }
    return this.messages.push('');
  }
}


class TestContext {
  constructor(skill, options) {
    this.skill = skill;
    this.options = options;
    this.output = {
      log: [],
      cards: [],
      directives: []
    };
  }

  collectAllSays() {
    return this.allSays = collectSays(this.skill, this.lambda);
  }
}


class Test {
  static initClass() {

    this.prototype.isTest = true;
  }
  constructor(location, name, sourceFilename) {
    this.location = location;
    this.name = name;
    this.sourceFilename = sourceFilename;
    this.steps = [];
    this.capturesNames = [];
    this.resumesNames = [];
  }

  pushUser(location, line, intent, slots) {
    if ((line != null) || (intent != null)) {
      return this.steps.push(new VoiceStep(location, line, intent, slots));
    } else {
      return this.steps.push(new LaunchStep(location));
    }
  }

  pushRequest(location, name, source) {
    return this.steps.push(new RequestStep(location, name, source));
  }

  pushTestStep(step) {
    return this.steps.push(step);
  }

  pushExpectation(obj) {
    const end = this.steps.length - 1;
    for (let i = end; i >= 0; i--) {
      if (this.steps[i].pushExpectation != null) {
        this.steps[i].pushExpectation(obj);
        return;
      }
    }
    throw new ParserError(obj.location, "alexa test expectation pushed without prior intent");
  }

  findLastStep(predicate) {
    if (this.steps.length <= 0) { return null; }
    for (let start = this.steps.length-1, i = start, asc = start <= 0; asc ? i <= 0 : i >= 0; asc ? i++ : i--) {
      if (predicate(this.steps[i])) {
        return this.steps[i];
      }
    }
    return null;
  }

  pushDatabaseFix(name, code) {
    return this.steps.push(new DBFixupStep(name, code));
  }

  pushWait(duration) {
    return this.steps.push(new WaitStep(duration));
  }

  pushStop(reason) {
    return this.steps.push(new StopStep(reason));
  }

  pushSetRegion(region) {
    return this.steps.push(new SetRegionStep(region));
  }

  pushCaptureNamedState(location, name) {
    this.steps.push(new CaptureStateStep(location, name));
    return this.capturesNames.push(name);
  }

  pushResumeNamedState(location, name) {
    this.steps.push(new ResumeStateStep(location, name));
    return this.resumesNames.push(name);
  }

  pushSetLogStateTraces(location, value) {
    return this.steps.push(new SetLogStateTraces(location, value));
  }

  reportEndpointResponses({ result, context, output, logs }) {
    let l;
    let success = true;
    const {
      skill
    } = context;

    const rawObject = {
      ref: (logs != null ? logs[logs.length - 1] : undefined),
      request: (result != null ? result.event : undefined) != null ? (result != null ? result.event : undefined) : {},
      response: (result != null ? result.data : undefined) != null ? (result != null ? result.data : undefined) : {},
      db: context.db.getVariables(makeHandlerIdentity(skill)),
      trace: __guard__(result != null ? result.data : undefined, x => x.__stateTrace)
    };

    // filter out test control items
    for (let obj of [rawObject.response, rawObject.request]) {
      for (let k in obj) {
        if (k[0] === '_') {
          delete obj[k];
        }
      }
    }

    // If turned on via test options, this logs all raw responses/requests and DB contents.
    // @TODO: For extensive tests, dumping this raw object aborts with a JS Heap OOM error
    // (during writeFileSync in test.coffee) -> should be addressed.
    if ((context.testContext.options != null ? context.testContext.options.logRawData : undefined) != null) {
      output.raw.push(rawObject);
    }

    if (result.err) {
      rawObject.error = result.err.stack != null ? result.err.stack : '' + result.err;
      logs.push(`   ✘ handler error: ${result.err}`);
      if (result.err.stack != null) {
        const stack = '' + result.err.stack;
        const lines = stack.split('\n');
        for (l of Array.from(lines)) {
          l = l.replace(/\([^\)]*\)/g, '');
          logs.push(`     ${l}`);
          if (l.indexOf('processIntents') >= 0) {
            break;
          }
        }
      }
      success = false;
    } else if (result.event) {
      let index, reprompt, speech;
      const state = `◖${padStringWithChars({
        str: context.attributes.state != null ? context.attributes.state : "",
        targetLength: skill.maxStateNameLength,
        paddingChar: '-'
      })}◗`;

      if (skill.abbreviateTestOutput) {
        speech = abbreviateTestOutput( result.speech, context );
        reprompt = abbreviateTestOutput( result.reprompt, context );
      } else {
        ({
          speech
        } = result);
        ({
          reprompt
        } = result);
      }

      if (speech != null) { speech = speech.replace(/"/g, '❝'); }
      if (reprompt != null) { reprompt = reprompt.replace(/"/g, '❝'); }

      if (speech != null) {
        speech = `\"${speech}\"`;
      } else {
        speech = "NO SPEECH";
      }

      if (reprompt != null) {
        reprompt = `\"${reprompt}\"`;
      } else {
        reprompt = "NO REPROMPT";
      }

      if (result.expectationsMet) {
        logs.push(`     ${state} ${speech} ... ${reprompt}`);
      } else {
        logs.push(`   ✘ ${state} ${speech} ... ${reprompt}`);
        success = false;
      }

      (() => {
        const check = key => {
          const errors = validateSSML(skill, result[key]);
          if (errors.length > 0) {
            success = false;
            return Array.from(errors).map((error) =>
              logs.push(`      ✘ ${key}: ${error}`));
          }
        };
        check('speech');
        return check('reprompt');
      })();

      if (result.card != null) {
        index = output.cards.length;
        output.cards.push(result.card);
        logs.push(`                          [CARD ${index}] ${result.cardReference}`);
      }

      if (result.directives != null) {
        for (let directive of Array.from(result.directives)) {
          index = output.directives.length;
          output.directives.push(directive);
          logs.push(`                          [DIRECTIVE ${index}] ${directive.type}`);
          const validationErrors = validateDirective(directive, context);
          if (validationErrors) {
            for (let error of Array.from(validationErrors)) {
              logs.push(`      ✘ ${error}`);
            }
            success = false;
          }
        }
      }

      if (result.shouldEndSession) {
        logs.push("  ◣  Voice session ended");
      }
    }

    if (result.errors != null) {
      for (let e of Array.from(result.errors)) {
        logs.push(`     ✘ ${e}`);
      }
    }

    if (result.logs != null) {
      for (l of Array.from(result.logs)) {
        logs.push(`     ! ${l}`);
      }
    }

    return success;
  }

  test(testContext, output, resultCallback) {
    const { skill, db, lambda } = testContext;
    const logs = [];
    db.captures = db.captures != null ? db.captures : {};

    const context = {
      db,
      attributes: {},
      allSays: collectSays(skill, lambda),
      lambda,
      skill,
      captures: db.captures,
      testContext
    };

    let success = true;

    const gap = (__range__(0, skill.maxStateNameLength+2, false).map((i) => " ")).join('');

    skill.testLoggingTraceStates = false;

    const remainingSteps = ( Array.from(this.steps) );
    var nextStep = () => {
      /*
      if db.db.variables != context.db
        db.db.variables = context.db
        db.db.initialized = true
      */

      if (remainingSteps.length === 0) {
        if (!testContext.options.singleStep) {
          if (success) {
            logs.unshift(`✔ test: ${this.name}`);
          } else {
            logs.unshift(`✘ test: ${this.name}`);
          }
        }
        output.log.push(logs.join('\n'));
        let successCount = 0;
        let failCount = 0;
        let failedTestName = undefined;
        if (success) {
          successCount = 1;
        } else {
          failCount = 1;
          failedTestName = this.name;
        }
        setTimeout((() => resultCallback(null, successCount, failCount, failedTestName)), 1);
        return;
      }

      const step = remainingSteps.shift();

      if (context.time == null) {
        // first time in here, we'll initialize to a fixed point in time
        context.time = (new Date(2017, 9, 1, 15, 0, 0)).getTime();
      }

      if (step.isVoiceStep || step.testingTimeIncrement) {
        // unless we had an explicit wait from the test script,
        // we'll insert a few seconds between every user event
        if (!context.alreadyWaited) {
          context.time += step.testingTimeIncrement != null ? step.testingTimeIncrement : 65 * 1000;
          context.alreadyWaited = false;
        }
      }

      return step.run({ skill, lambda, context, resultCallback: (err, result) => {
        if ((err != null) || ((result != null ? result.err : undefined) != null)) {
          success = false;
        }

        let sourceLine = __guard__(step.location != null ? step.location.start : undefined, x => x.line) != null ? __guard__(step.location != null ? step.location.start : undefined, x => x.line) : "--";
        sourceLine += ".";

        switch (false) {
          case !step.isStopStep:
            if (err) {
              logs.push(`     ✘ processed ${step.requestReason} session end with error: ${err}`);
            } else {
              logs.push(`     • processed ${step.requestReason} session end without errors`);
            }
            break;

          case !step.isDBFixupStep:
            if (err) {
              logs.push(`     ✘ db fixup error: @${step.reference}, ${err}`);
            } else {
              logs.push(`     • db fixup @${step.reference}`);
            }
            break;

          case !step.isWaitStep:
            var minutes = step.duration / 1000 / 60;
            logs.push(`     • waited ${minutes.toFixed(2)} minutes`);
            break;

          case !step.isVoiceStep:
            if (err) {
              logs.push(`${sourceLine}  ❢ Voice intent error: ${err}`);
            } else {
              let paddedIntent;
              result = result != null ? result : {};
              const time = (new Date(context.time)).toLocaleTimeString();

              let textSlots = "";
              if (result.slots != null) {
                textSlots = ((() => {
                  const result1 = [];
                   for (let k in result.slots) {
                    const v = result.slots[k];
                    result1.push(`$${k}=${v}`);
                  }
                  return result1;
                })()).join(', ');
              }

              if (result.intent != null) {
                paddedIntent = result.intent.slice(0, skill.maxStateNameLength+2);
              } else {
                paddedIntent = "ERROR";
              }
              paddedIntent = padStringWithChars({
                str: paddedIntent,
                targetLength: skill.maxStateNameLength + 2,
                paddingChar: ' '
              });

              const input = "";
              //input = "\"#{result.expressed ? step.intent ? "launch"}\" -- "
              logs.push(`${sourceLine}  ❢ ${paddedIntent} ${input}${textSlots} @ ${time}`);
            }

            if (result != null) {
              if (!this.reportEndpointResponses({ result, context, output, logs })) {
                success = false;
              }
            }
            break;

          case (step.report == null):
            step.report({ err, logs, sourceLine, step, output, result, context });

            if (result != null) {
              if (!this.reportEndpointResponses({ result, context, output, logs })) {
                success = false;
              }
            }
            break;

          default:
            throw new Error("unexpected step");
        }

        return nextStep();
      }
      });
    };
    return nextStep();
  }
}
Test.initClass();

lib.TestUtils = {
  makeBaseRequest,
  makeHandlerIdentity,
  makeRequestId,
  padStringWithChars
};

lib.ExpectedExactSay = ExpectedExactSay;
lib.ExpectedRegexSay = ExpectedRegexSay;
lib.ExpectedSay = ExpectedSay;
lib.ExpectedState = ExpectedState;
lib.ExpectedDB = ExpectedDB;
lib.ExpectedEndSession = ExpectedEndSession;
lib.ExpectedContinueSession = ExpectedContinueSession;
lib.ExpectedDirective = ExpectedDirective;
lib.ResponseGeneratingStep = ResponseGeneratingStep;
lib.CodeTest = CodeTest;
lib.TestContext = TestContext;
lib.Test = Test;

module.exports = {
  lib
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}
