/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */
litexa.gadgetAnimation = {
  // Gadget animations are for Echo Buttons right now
  // this is about animating the colors on the buttons
  // with the SetLight directive
  buildKey: function(color, duration, blend) {
    if (color[0] === '#') {
      // build the inner key structure of an
      // animation to pass into directive
      color = color.slice(1);
    }
    return {
      color: color.toUpperCase(),
      durationMs: duration,
      blend: blend != null ? blend : true
    };
  },
  animationFromArray: function(keyData) {
    var build, d, i, len, results;
    // build an animation array suitable to give
    // the directive function, from an array of
    // arrays of arguments to pass buildKey
    // e.g. [ ['FF0000',1000,true], ['00FFFF',2000,true] ]
    build = litexa.gadgetAnimation.buildKey;
    results = [];
    for (i = 0, len = keyData.length; i < len; i++) {
      d = keyData[i];
      results.push(build(d[0], d[1], d[2]));
    }
    return results;
  },
  singleColorDirective: function(targets, color, duration) {
    var animation;
    animation = [litexa.gadgetAnimation.buildKey(color, duration, false)];
    return litexa.gadgetAnimation.directive(targets, 1, animation, "none");
  },
  resetTriggersDirectives: function(targets) {
    return [litexa.gadgetAnimation.directive(targets, 1, [litexa.gadgetAnimation.buildKey("FFFFFF", 100, false)], "buttonDown"), litexa.gadgetAnimation.directive(targets, 1, [litexa.gadgetAnimation.buildKey("FFFFFF", 100, false)], "buttonUp")];
  },
  directive: function(targets, repeats, animation, trigger, delay) {
    return {
      // directive to animate Echo buttons
      type: "GadgetController.SetLight",
      version: 1,
      targetGadgets: targets,
      parameters: {
        triggerEvent: trigger != null ? trigger : "none",
        triggerEventTimeMs: delay != null ? delay : 0,
        animations: [
          {
            targetLights: ["1"],
            repeat: repeats,
            sequence: animation
          }
        ]
      }
    };
  }
};
