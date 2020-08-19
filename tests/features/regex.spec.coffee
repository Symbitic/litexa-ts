preamble = require '../preamble'

describe 'supports regex skill', ->
  it 'runs the regex integration test', ->
    preamble.runSkill 'regex'
