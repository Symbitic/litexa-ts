###
# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
# Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
###

lib = {}

resetLib = ->
  for k of lib
    delete lib[k]

  lib.__resetLib = resetLib

  mergeLib = (required) ->
    for name, part of required.lib
      lib[name] = part

  mergeLib require("./errors")
  mergeLib require("./jsonValidator")
  mergeLib require("./dataTable")
  mergeLib require("./testing")
  mergeLib require("./variableReference")
  mergeLib require("./say")
  mergeLib require("./card")
  mergeLib require("./function")
  mergeLib require("./assets")
  mergeLib require("./soundEffect")
  mergeLib require("./intent")
  mergeLib require("./state")
  mergeLib require("./monetization")

  # reset the static index of all utterances
  lib.Intent.unregisterUtterances()

resetLib()

module.exports = lib
