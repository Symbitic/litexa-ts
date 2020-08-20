/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import assert from 'assert';
import parser from '@litexa/core/src/parser/parser';
import preamble from '../preamble';
import { VariableScopeManager } from '@litexa/core/src/parser/variableScope';
import debug from 'debug';

const saysDebug = debug('says');
const echoThis = str => str;
const constant = "goat";

const execute = async function (object, func, properties) {
  const options = {
    language: 'default',
    scopeManager: new VariableScopeManager
  };

  // patch in this sneaky test global
  options.scopeManager.allocate(null, 'constant');
  options.scopeManager.allocate(null, 'echoThis');

  const escapeSpeech = str => str;
  let context = {
    say: [],
    db: {
      read(key) { return properties[key]; }
    },
    slots: properties
  };

  let output = [];
  try {
    if (func === 'toLambda') {
      object.toLambda(output, '', options);
      let wrapper = null;
      output.unshift('wrapper = async function(){');
      output.push('};');
      eval(output.join('\n'));
      await wrapper();
    } else {
      output = object[func](options);
      context = eval(output);
    }
  } catch (error) {
    console.error(output);
    throw error;
  }
  return context;
};


const expectSay = async function (fragment, expectation, properties) {
  properties = properties != null ? properties : {};
  const result = await parser.parseFragment(`say "${fragment}" `);
  saysDebug(result.alternates[0]);
  const context = await execute(result, 'toLambda', properties);
  const string = context.say.join(' ');
  return assert.equal(string, expectation);
};

const expectSayError = async function (fragment, error, properties) {
  try {
    await expectSay(fragment, '', properties);
    return Promise.reject(`didn't fail as expected with ${error}`);
  } catch (err) {
    return assert.equal(err.toString(), `Error: ${error}`);
  }
};


const expectScreenString = async function (fragment, expectation, properties) {
  properties = properties != null ? properties : {};
  const result = await parser.parseFragment(`card "${fragment}" `);
  const context = await execute(result.title, 'toExpression', properties);
  const string = context;
  try {
    return assert.equal(string, expectation);
  } catch (error) {
    console.error(JSON.stringify(result.title, null, 2));
    throw error;
  }
};

const expectScreenStringError = async function (fragment, error, properties) {
  try {
    await expectScreenString(fragment, '', properties);
    return Promise.reject(`didn't fail as expected with ${error}`);
  } catch (err) {
    return assert.equal(err.toString(), `Error: ${error}`);
  }
};


describe('interpolates say strings', function () {

  it('does line concatenation', () => expectSay(`something
or
other\
`, "something or other"));

  it('treats empty lines as breaks', () => expectSay(`something

or
other\
`, "something\nor other"));

  it('treats multiple empty lines as breaks', () => expectSay(`something


or
other\
`, "something\n\nor other"));

  it('treats empty lines as breaks repeatedly', () => expectSay(`something

or

other\
`, "something\nor\nother"));

  it('interpolates database values', () => expectSay("hello @name", "hello Bob", { name: "Bob" }));

  it('interpolates slot values', () => expectSay("hello $name", "hello Bob", { name: "Bob" }));

  it('mixes slots and database', () => expectSay("hello $alice, @bob", "hello Alice, Bob", { alice: "Alice", bob: "Bob" }));

  it('interprets breaks', () => Promise.all([
    expectSay("<...100ms>", "<break time=\'100ms\'/>"),
    expectSay("oh, <...100ms> I guess so", "oh, <break time=\'100ms\'/> I guess so"),
    expectSay("oh,<...100ms>I guess so", "oh,<break time=\'100ms\'/>I guess so"),
    expectSay("<...100ms> I guess so", "<break time=\'100ms\'/> I guess so")
  ]));

  it('interprets interjections', () => Promise.all([
    expectSay("<!something>", "<say-as interpret-as='interjection'>something</say-as>"),
    expectSay("<!something else>", "<say-as interpret-as='interjection'>something else</say-as>"),
    expectSay("<!something!>", "<say-as interpret-as='interjection'>something!</say-as>"),
    expectSay("<! something>", "<say-as interpret-as='interjection'>something</say-as>"),
    expectSay("<! something>,", "<say-as interpret-as='interjection'>something,</say-as>"),
    expectSay("<! something>, something", "<say-as interpret-as='interjection'>something,</say-as> something"),
    expectSay("<! something, >something", "<say-as interpret-as='interjection'>something, </say-as>something"),
    expectSay("<! something,> something", "<say-as interpret-as='interjection'>something,</say-as> something")
  ]));

  it('interprets multiple interjections', () => Promise.all([
    expectSay("<! something,> <!other>", "<say-as interpret-as='interjection'>something,</say-as> <say-as interpret-as='interjection'>other</say-as>"),

    expectSay("<! something>,<!other>", "<say-as interpret-as='interjection'>something,</say-as><say-as interpret-as='interjection'>other</say-as>"),

    expectSay("<! something.><!other>", "<say-as interpret-as='interjection'>something.</say-as><say-as interpret-as='interjection'>other</say-as>")
  ]));

  it('interpolates expressions', function () {
    expectSay("{1 + 1}", "2");
    expectSay("{echoThis(\"called\")}", "called");
    expectSay("{echoThis('called')}", "called");
    return expectSay("{constant}", "goat");
  });

  it('interpolates expressions with variables', () => expectSay("{@first + $last}", "BobBobson", { first: 'Bob', last: 'Bobson' }));

  it('interpolates multiple expressions', () => expectSay("@name is {12 + $age - @flatter} years old {@when}.", "Dude is 15 years old today.",
    { name: 'Dude', age: 5, flatter: 2, when: 'today' }));

  return it('rejects unknown tags', () => expectSayError("<nonsense>", "unknown tag <nonsense>"));
});


describe('interpolates on-screen strings', function () {

  it('does line concatenation', () => expectScreenString(`\
something
or
other\
`, "something or other"));

  it('does font sizes', () => Promise.all([
    expectScreenString('<f3 something 1>', "<font size='3'>something 1</font>"),
    expectScreenString('before <f5 something 2>', "before <font size='5'>something 2</font>"),
    expectScreenString('<f7 something> after', "<font size='7'>something</font> after"),
    expectScreenString('<f7 > big stuff', "<font size='7'> big stuff</font>")
  ]));

  it('fails on unsupported font sizes', () => expectScreenStringError("<f1 something>", "invalid font size 1, expecting one of [2,3,5,7]"));

  it('does centering', () => Promise.all([
    expectScreenString('<center something to say 1>', "<div align='center'>something to say 1</div>"),
    expectScreenString('<center something to say 2> but not this', "<div align='center'>something to say 2</div> but not this"),
    expectScreenString('<center>something to say 3', "<div align='center'>something to say 3</div>"),
    expectScreenString(`<center>center but not
this part`, "<div align='center'>center but not</div> this part"),
    expectScreenString(`<center>first line
<center>second line`, "<div align='center'>first line</div> <div align='center'>second line</div>")
  ]));

  it('does italics', () => Promise.all([
    expectScreenString('<i an italic sentence 1>', "<i>an italic sentence 1</i>"),
    expectScreenString('<i> an italic sentence 2', "<i> an italic sentence 2</i>")
  ]));

  it('does bolds', () => Promise.all([
    expectScreenString('<b a bold sentence 1>', "<b>a bold sentence 1</b>"),
    expectScreenString('<b> a bold sentence 2', "<b> a bold sentence 2</b>"),
    expectScreenString(`<b> a bold part, followed
by a non bold part`, "<b> a bold part, followed</b> by a non bold part")
  ]));

  it('does underlines', () => Promise.all([
    expectScreenString('<u an underlined sentence 1>', "<u>an underlined sentence 1</u>"),
    expectScreenString('<u> an underlined sentence 2', "<u> an underlined sentence 2</u>")
  ]));

  return it('mixes tags', () => Promise.all([
    expectScreenString('<center><u><b>lots', "<div align='center'><u><b>lots</b></u></div>"),
    expectScreenString('<center><u><b lots inside>', "<div align='center'><u><b>lots inside</b></u></div>"),
    expectScreenString(`<center><b>centered and bold
neither
<b><f7>bold and large\
`, "<div align='center'><b>centered and bold</b></div> neither <b><font size='7'>bold and large</font></b>"),

    expectScreenString(`<center><b>title part

<f3>body text <u underlined part>\
`, "<div align='center'><b>title part</b></div>\n<font size='3'>body text <u>underlined part</u></font>")
  ]));
});

describe('randomizes say statement variants', () => it("does not repeat say variations back-to-back", async function () {
  const results = await preamble.runSkill('say-randomization');
  const lines = Array.from(results.raw).map((r) =>
    r.response.response.outputSpeech.ssml);
  return (() => {
    const result = [];
    for (let i = 1, end = lines.length, asc = 1 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
      if (lines[i] === lines[i - 1]) {
        throw `duplicate encountered: ${lines[i]} == ${lines[i - 1]}`;
      } else {
        result.push(undefined);
      }
    }
    return result;
  })();
}));

describe('formats say statements with interpolation properly', () => it('runs the say-formatting integration test', () => preamble.runSkill('say-formatting')
  .then(function (result) {
    let { response } = result.raw[1].response;
    let { directives } = response;
    assert.equal(directives.length, 2);
    assert.equal(directives[0].type, 'Display.RenderTemplate');
    assert.equal(directives[1].type, 'Hint');
    assert.equal(directives[0].template.textContent.primaryText.text, "<b> this is one</b> continuous line on <div align='center'>a screen. But this is</div><br/>not a continuous line.");
    ({ response } = result.raw[2].response);
    ({ directives } = response);
    assert.equal(directives[0].type, 'Display.RenderTemplate');
    assert.equal(directives[0].template.textContent.primaryText.text, "This is a <b>line.</b>");
    ({ response } = result.raw[3].response);
    ({ directives } = response);
    assert.equal(directives[0].type, 'Display.RenderTemplate');
    return assert.equal(directives[0].template.textContent.primaryText.text, "start<br/>end");
  })));

describe('adds reprompts correctly', () => {
  it('runs the say-reprompt integration test', () => {
    return preamble.runSkill('say-reprompt')
      .then(function (result) {
        const individualSayReprompt = result.raw[0].response.response;
        const sayReprompt = result.raw[1].response.response;

        assert.equal(individualSayReprompt.outputSpeech.ssml, '<speak>1st say 2nd say</speak>');
        assert.equal(individualSayReprompt.reprompt.outputSpeech.ssml, '<speak>1st reprompt 2nd reprompt</speak>');
        assert.equal(sayReprompt.outputSpeech.ssml, '<speak>say-only common say and reprompt</speak>');
        return assert.equal(sayReprompt.reprompt.outputSpeech.ssml, '<speak>common say and reprompt reprompt-only</speak>');
      })
  });
});
