{assert} = require 'chai'
{spy} = require 'sinon'
{Time} = require '../../lib/services/time.service'

describe 'Time', ->
  describe '#serverTimeGetDay', ->
    mockDate = undefined

    beforeEach ->
      mockDate =
        getDay: ->
          0

    it 'returns the day', ->
      dateSpy = spy(mockDate, 'getDay')
      Time.serverTimeGetDay mockDate
      assert dateSpy.calledOnce, 'got the day'
