###
# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
# Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
###

assert = require 'assert'
debug = require('debug')('says')
path = require 'path'
parser = require '@litexa/core/src/parser/parser'
preamble = require '../preamble.coffee'

{ VariableScopeManager } = require '@litexa/core/src/parser/variableScope'

echoThis = (str) -> str
constant = "goat"

execute = (object, func, properties) ->
  options = {
    language: 'default'
    scopeManager: new VariableScopeManager
  }

  # patch in this sneaky test global
  options.scopeManager.allocate null, 'constant'
  options.scopeManager.allocate null, 'echoThis'

  escapeSpeech = (str) -> '' + str
  context =
    say:[]
    db:
      read: (key) -> properties[key]
    slots: properties

  pickSayFragment = (context, key, options) ->
    index = Math.floor Math.random() * options.length
    return options[index]

  output = []
  try
    if func == 'toLambda'
      object.toLambda output, '', options
      wrapper = null
      output.unshift 'wrapper = async function(){'
      output.push '};'
      context.code = output.join '\n'
      eval context.code
      await wrapper()
    else
      output = object[func] options
      context = eval output
  catch error
    console.error output
    throw error
  return context



expectSay = (fragment, expectation, properties) ->
  properties = properties ? {}
  result = await parser.parseFragment """say "#{fragment}" """
  debug result.alternates[0]
  context = await execute result, 'toLambda', properties
  string = context.say.join ' '
  if Array.isArray(expectation)
    for ex in expectation
      if string == ex
        return
    console.log context.code
    assert.fail "\"#{string}\" was not found in #{JSON.stringify(expectation)}"
  else
    if string != expectation
      console.log context.code
    assert.equal string, expectation

expectSayError = (fragment, error, properties) ->
  try
    await await expectSay fragment, '', properties
    Promise.reject "didn't fail as expected with #{error}"
  catch err
    assert.equal err.toString(), "Error: #{error}"


expectScreenString = (fragment, expectation, properties) ->
  properties = properties ? {}
  result = await parser.parseFragment """card "#{fragment}" """
  context = await execute result.title, 'toExpression', properties
  string = context
  try
    assert.equal string, expectation
  catch error
    console.error JSON.stringify result.title, null, 2
    throw error

 expectScreenStringError = (fragment, error, properties) ->
   try
     await expectScreenString fragment, '', properties
     Promise.reject "didn't fail as expected with #{error}"
   catch err
     assert.equal err.toString(), "Error: #{error}"


describe 'interpolates say strings', ->

  it 'does line concatenation', ->
    await expectSay """something
      or
      other
    """, "something or other"

  it 'treats empty lines as breaks', ->
    await expectSay """something

      or
      other
    """, "something\nor other"

  it 'treats multiple empty lines as breaks', ->
    await expectSay """something


      or
      other
    """, "something\n\nor other"

  it 'treats empty lines as breaks repeatedly', ->
    await expectSay """something

      or

      other
    """, "something\nor\nother"

  it 'interpolates database values', ->
    await expectSay "hello @name", "hello Bob", { name: "Bob" }

  it 'interpolates slot values', ->
    await expectSay "hello $name", "hello Bob", { name: "Bob" }

  it 'mixes slots and database', ->
    await expectSay "hello $alice, @bob", "hello Alice, Bob", { alice: "Alice", bob: "Bob" }

  it 'interprets breaks', ->
    Promise.all [
      await expectSay "<...100ms>", "<break time=\'100ms\'/>"
      await expectSay "oh, <...100ms> I guess so", "oh, <break time=\'100ms\'/> I guess so"
      await expectSay "oh,<...100ms>I guess so", "oh,<break time=\'100ms\'/>I guess so"
      await expectSay "<...100ms> I guess so", "<break time=\'100ms\'/> I guess so"
    ]

  it 'interprets interjections', ->
    Promise.all [
      await expectSay "<!something>", "<say-as interpret-as='interjection'>something</say-as>"
      await expectSay "<!something else>", "<say-as interpret-as='interjection'>something else</say-as>"
      await expectSay "<!something!>", "<say-as interpret-as='interjection'>something!</say-as>"
      await expectSay "<! something>", "<say-as interpret-as='interjection'>something</say-as>"
      await expectSay "<! something>,", "<say-as interpret-as='interjection'>something,</say-as>"
      await expectSay "<! something>, something", "<say-as interpret-as='interjection'>something,</say-as> something"
      await expectSay "<! something, >something", "<say-as interpret-as='interjection'>something, </say-as>something"
      await expectSay "<! something,> something", "<say-as interpret-as='interjection'>something,</say-as> something"
    ]

  it 'interprets multiple interjections', ->
    Promise.all [
      await expectSay "<! something,> <!other>", "<say-as interpret-as='interjection'>something,</say-as> <say-as interpret-as='interjection'>other</say-as>"

      await expectSay "<! something>,<!other>", "<say-as interpret-as='interjection'>something,</say-as><say-as interpret-as='interjection'>other</say-as>"

      await expectSay "<! something.><!other>", "<say-as interpret-as='interjection'>something.</say-as><say-as interpret-as='interjection'>other</say-as>"
    ]

  it 'interpolates expressions', ->
    await expectSay "{1 + 1}", "2"
    await expectSay "{echoThis(\"called\")}", "called"
    await expectSay "{echoThis('called')}", "called"
    await expectSay "{constant}", "goat"

  it 'interpolates expressions with variables', ->
    await expectSay "{@first + $last}", "BobBobson", { first:'Bob', last:'Bobson' }

  it 'interpolates multiple expressions', ->
    await expectSay "@name is {12 + $age - @flatter} years old {@when}.", "Dude is 15 years old today.",
      { name: 'Dude', age: 5, flatter: 2, when: 'today'}

  it 'rejects unknown tags', ->
    await expectSayError "<nonsense>", "unknown tag <nonsense>"


describe 'interpolates on-screen strings', ->

  it 'does line concatenation', ->
    expectScreenString """
      something
      or
      other
    """, "something or other"

  it 'does font sizes', ->
    Promise.all [
      expectScreenString '<f3 something 1>', "<font size='3'>something 1</font>"
      expectScreenString 'before <f5 something 2>', "before <font size='5'>something 2</font>"
      expectScreenString '<f7 something> after', "<font size='7'>something</font> after"
      expectScreenString '<f7 > big stuff', "<font size='7'> big stuff</font>"
    ]

  it 'fails on unsupported font sizes', ->
    expectScreenStringError "<f1 something>", "invalid font size 1, expecting one of [2,3,5,7]"

  it 'does centering', ->
    Promise.all [
      expectScreenString '<center something to say 1>', "<div align='center'>something to say 1</div>"
      expectScreenString '<center something to say 2> but not this', "<div align='center'>something to say 2</div> but not this"
      expectScreenString '<center>something to say 3', "<div align='center'>something to say 3</div>"
      expectScreenString """<center>center but not
        this part""", "<div align='center'>center but not</div> this part"
      expectScreenString """<center>first line
        <center>second line""", "<div align='center'>first line</div> <div align='center'>second line</div>"
    ]

  it 'does italics', ->
    Promise.all [
      expectScreenString  '<i an italic sentence 1>', "<i>an italic sentence 1</i>"
      expectScreenString  '<i> an italic sentence 2', "<i> an italic sentence 2</i>"
    ]

  it 'does bolds', ->
    Promise.all [
      expectScreenString  '<b a bold sentence 1>', "<b>a bold sentence 1</b>"
      expectScreenString  '<b> a bold sentence 2', "<b> a bold sentence 2</b>"
      expectScreenString  """<b> a bold part, followed
        by a non bold part""", "<b> a bold part, followed</b> by a non bold part"
    ]

  it 'does underlines', ->
    Promise.all [
      expectScreenString  '<u an underlined sentence 1>', "<u>an underlined sentence 1</u>"
      expectScreenString  '<u> an underlined sentence 2', "<u> an underlined sentence 2</u>"
    ]

  it 'mixes tags', ->
    Promise.all [
      expectScreenString '<center><u><b>lots', "<div align='center'><u><b>lots</b></u></div>"
      expectScreenString '<center><u><b lots inside>', "<div align='center'><u><b>lots inside</b></u></div>"
      expectScreenString """<center><b>centered and bold
        neither
        <b><f7>bold and large
        """, "<div align='center'><b>centered and bold</b></div> neither <b><font size='7'>bold and large</font></b>"

      expectScreenString """<center><b>title part

        <f3>body text <u underlined part>
        """, "<div align='center'><b>title part</b></div>\n<font size='3'>body text <u>underlined part</u></font>"
    ]

describe 'randomizes say statement variants', ->
  it "does not repeat say variations back-to-back", ->
    results = await preamble.runSkill 'say-randomization'
    lines = for r in results.raw
      r.response.response.outputSpeech.ssml
    for i in [1...lines.length]
      if lines[i] == lines[i - 1]
        throw "duplicate encountered: #{lines[i]} == #{lines[i - 1]}"

describe 'formats say statements with interpolation properly', ->
  it 'runs the say-formatting integration test', ->
    preamble.runSkill 'say-formatting'
    .then (result) ->
      response = result.raw[1].response.response
      directives = response.directives
      assert.equal directives.length, 2
      assert.equal directives[0].type, 'Display.RenderTemplate'
      assert.equal directives[1].type, 'Hint'
      assert.equal directives[0].template.textContent.primaryText.text, "<b> this is one</b> continuous line on <div align='center'>a screen. But this is</div><br/>not a continuous line."
      response = result.raw[2].response.response
      directives = response.directives
      assert.equal directives[0].type, 'Display.RenderTemplate'
      assert.equal directives[0].template.textContent.primaryText.text, "This is a <b>line.</b>"
      response = result.raw[3].response.response
      directives = response.directives
      assert.equal directives[0].type, 'Display.RenderTemplate'
      assert.equal directives[0].template.textContent.primaryText.text, "start<br/>end"

describe 'adds reprompts correctly', ->
  it 'runs the say-reprompt integration test', ->
    preamble.runSkill 'say-reprompt'
      .then (result) ->
        individualSayReprompt = result.raw[0].response.response
        sayReprompt = result.raw[1].response.response

        assert.equal individualSayReprompt.outputSpeech.ssml, '<speak>1st say 2nd say</speak>'
        assert.equal individualSayReprompt.reprompt.outputSpeech.ssml, '<speak>1st reprompt 2nd reprompt</speak>'
        assert.equal sayReprompt.outputSpeech.ssml, '<speak>say-only common say and reprompt</speak>'
        assert.equal sayReprompt.reprompt.outputSpeech.ssml, '<speak>common say and reprompt reprompt-only</speak>'


describe 'supports inline alternation', ->
  it 'supports a single alternative', ->
    Promise.all ( for i in [0...20]
      await expectSay "this | that", [ "this", "that" ]
    )

  it 'supports multiple alternatives', ->
    Promise.all ( for i in [0...20]
      await expectSay "this | that | the other", [ "this", "that", "the other" ]
    )

  it 'supports the hanging alternate', ->
    Promise.all ( for i in [0...20]
      await expectSay "this | that | ", [ "this", "that", "" ]
    )

  it 'supports the hanging alternate in a group', ->
    Promise.all ( for i in [0...20]
      await expectSay "(this | that |) thing ", [ "this thing", "that thing", "thing" ]
    )

  it 'supports lots of multiple alternatives', ->
    Promise.all ( for i in [0...20]
      await expectSay "this | that | the other | longer stuff | 1, 2, 3, 4", [ "this", "that", "the other", "longer stuff", "1, 2, 3, 4" ]
    )

  it 'supports alternation with @variables', ->
    Promise.all ( for i in [0...20]
      await expectSay "hello | @greeting", [ "hello", "hi" ], { greeting: "hi" }
    )

  it 'supports grouping and alternation with @variables', ->
    Promise.all ( for i in [0...20]
      await expectSay "(@greeting | @parting) there", [ "hi there", "bye there" ], { greeting: "hi", parting: "bye" }
    )

  it 'supports a complex mix of groups and alternations', ->
    Promise.all ( for i in [0...20]
      await expectSay "((take | bring) your (@item | gift) | go away)", [
        "take your book",
        "take your gift",
        "bring your book",
        "bring your gift",
        "go away"
      ], { item: "book" }
    )

