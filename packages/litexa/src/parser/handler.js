/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */
var enableStateTracing, handlerSteps, logStateTraces, loggingLevel, ref, ref1, ref2, ref3, ref4, ref5, ref6, ref7, ref8, shouldUniqueURLs,
  indexOf = [].indexOf;

// causes every request and response object to be written to the logs
loggingLevel = (ref = typeof process !== "undefined" && process !== null ? (ref1 = process.env) != null ? ref1.loggingLevel : void 0 : void 0) != null ? ref : null;

// when enabled, logs out every state transition when it happens, useful for tracing what
// order things happened in  when something goes wrong
logStateTraces = (ref2 = typeof process !== "undefined" && process !== null ? (ref3 = process.env) != null ? ref3.logStateTraces : void 0 : void 0) === 'true' || ref2 === true;

enableStateTracing = ((ref4 = typeof process !== "undefined" && process !== null ? (ref5 = process.env) != null ? ref5.enableStateTracing : void 0 : void 0) === 'true' || ref4 === true) || logStateTraces;

// hack for over aggressive Show caching
shouldUniqueURLs = (typeof process !== "undefined" && process !== null ? (ref6 = process.env) != null ? ref6.shouldUniqueURLs : void 0 : void 0) === 'true';

// assets root location is determined by an external variable
litexa.assetsRoot = (ref7 = typeof process !== "undefined" && process !== null ? (ref8 = process.env) != null ? ref8.assetsRoot : void 0 : void 0) != null ? ref7 : litexa.assetsRoot;

handlerSteps = {};

exports.handler = function (event, lambdaContext, callback) {
  var handlerContext;
  handlerContext = {
    originalEvent: event,
    litexa: litexa
  };
  // patch for testing support to be able to toggle this without
  // recreating the lambda
  if (event.__logStateTraces != null) {
    logStateTraces = event.__logStateTraces;
  }
  switch (loggingLevel) {
    case 'verbose':
      // when verbose logging, dump the whole event to the console
      // this is pretty quick, but it makes for massive logs
      exports.Logging.log("VERBOSE REQUEST " + JSON.stringify(event, null, 2));
      break;
    case 'terse':
      exports.Logging.log("VERBOSE REQUEST " + JSON.stringify(event.request, null, 2));
  }
  // patch when missing so downstream doesn't have to check
  if (event.session == null) {
    event.session = {};
  }
  if (event.session.attributes == null) {
    event.session.attributes = {};
  }
  return handlerSteps.extractIdentity(event, handlerContext).then(function () {
    return handlerSteps.checkFastExit(event, handlerContext);
  }).then(function (proceed) {
    if (!proceed) {
      return callback(null, {});
    }
    return handlerSteps.runConcurrencyLoop(event, handlerContext).then(async function (response) {
      var err, events, extensionName, promise;
      // if we have post process extensions, then run each one in series
      promise = Promise.resolve();
      for (extensionName in extensionEvents) {
        events = extensionEvents[extensionName];
        if (events.beforeFinalResponse != null) {
          try {
            await events.beforeFinalResponse(response);
          } catch (error) {
            err = error;
            exports.Logging.error(`Failed to execute the beforeFinalResponse event for extension ${extensionName}: ${err}`);
            throw err;
          }
        }
      }
      return response;
    }).then(function (response) {
      // if we're fully resolved here, we can return the final result
      if (loggingLevel) {
        exports.Logging.log("VERBOSE RESPONSE " + JSON.stringify(response, null, 2));
      }
      return callback(null, response);
    }).catch(function (err) {
      // otherwise, we've failed, so return as an error, without data
      return callback(err, null);
    });
  });
};

handlerSteps.extractIdentity = function (event, handlerContext) {
  return new Promise(function (resolve, reject) {
    var identity, ref10, ref11, ref12, ref13, ref14, ref9;
    // extract the info we consider to be the user's identity. Note
    // different events may provide this information in different places
    handlerContext.identity = identity = {};
    if (((ref9 = event.context) != null ? ref9.System : void 0) != null) {
      identity.requestAppId = (ref10 = event.context.System.application) != null ? ref10.applicationId : void 0;
      identity.userId = (ref11 = event.context.System.user) != null ? ref11.userId : void 0;
      identity.deviceId = (ref12 = event.context.System.device) != null ? ref12.deviceId : void 0;
    } else if (event.session != null) {
      identity.requestAppId = (ref13 = event.session.application) != null ? ref13.applicationId : void 0;
      identity.userId = (ref14 = event.session.user) != null ? ref14.userId : void 0;
      identity.deviceId = 'no-device';
    }
    return resolve();
  });
};

handlerSteps.checkFastExit = function (event, handlerContext) {
  var terminalEvent;
  // detect fast exit for valid events we don't route yet, or have no response to
  terminalEvent = false;
  switch (event.request.type) {
    case 'System.ExceptionEncountered':
      exports.Logging.error(`ERROR System.ExceptionEncountered: ${JSON.stringify(event.request)}`);
      terminalEvent = true;
      break;
    case 'SessionEndedRequest':
      terminalEvent = true;
  }
  if (!terminalEvent) {
    return true;
  }
  // this is an event that ends the session, but we may have code
  // that needs to cleanup on skill exist that result in a BD write
  return new Promise(function (resolve, reject) {
    var tryToClose;
    tryToClose = function () {
      var dbKey;
      dbKey = litexa.overridableFunctions.generateDBKey(handlerContext.identity);
      return db.fetchDB({
        identity: handlerContext.identity,
        dbKey,
        ttlConfiguration: litexa.ttlConfiguration,
        fetchCallback: function (err, dbObject) {
          if (err != null) {
            return reject(err);
          }
          // todo, insert any new skill cleanup code here
          //   check to see if dbObject needs flushing

          // all clear, we don't have anything active
          if (loggingLevel) {
            exports.Logging.log("VERBOSE Terminating input handler early");
          }
          return resolve(false);
          // write back the object, to clear our memory
          return dbObject.finalize(function (err) {
            if (err != null) {
              return reject(err);
            }
            if (dbObject.repeatHandler) {
              return tryToClose();
            } else {
              return resolve(false);
            }
          });
        }
      });
    };
    return tryToClose();
  });
};

handlerSteps.runConcurrencyLoop = function (event, handlerContext) {
  // to solve for concurrency, we keep state in a database
  // and support retrying all the logic after this point
  // in the event that the database layer detects a collision
  return new Promise(async function (resolve, reject) {
    var __language, lang, langCode, language, numberOfTries, ref9, requestTimeStamp, runHandler;
    numberOfTries = 0;
    requestTimeStamp = (new Date((ref9 = event.request) != null ? ref9.timestamp : void 0)).getTime();
    // work out the language, from the locale, if it exists
    language = 'default';
    if (event.request.locale != null) {
      lang = event.request.locale;
      langCode = lang.slice(0, 2);
      for (__language in __languages) {
        if ((lang.toLowerCase() === __language.toLowerCase()) || (langCode === __language)) {
          language = __language;
        }
      }
    }
    litexa.language = language;
    handlerContext.identity.litexaLanguage = language;
    runHandler = function () {
      var dbKey;
      numberOfTries += 1;
      if (numberOfTries > 1) {
        exports.Logging.log(`CONCURRENCY LOOP iteration ${numberOfTries}, denied db write`);
      }
      dbKey = litexa.overridableFunctions.generateDBKey(handlerContext.identity);
      return db.fetchDB({
        identity: handlerContext.identity,
        dbKey,
        ttlConfiguration: litexa.ttlConfiguration,
        fetchCallback: async function (err, dbObject) {
          var base, ref10, ref11, response, stateContext;
          try {
            // build the context object for the state machine
            stateContext = {
              say: [],
              reprompt: [],
              directives: [],
              shouldEndSession: false,
              now: requestTimeStamp,
              settings: {},
              traceHistory: [],
              requestId: event.request.requestId,
              language: language,
              event: event,
              request: (ref10 = event.request) != null ? ref10 : {},
              db: new DBTypeWrapper(dbObject, language)
            };
            stateContext.settings = (ref11 = stateContext.db.read("__settings")) != null ? ref11 : {
              resetOnLaunch: true
            };
            if (!dbObject.isInitialized()) {
              dbObject.initialize();
              await (typeof (base = __languages[stateContext.language].enterState).initialize === "function" ? base.initialize(stateContext) : void 0);
            }
            await handlerSteps.parseRequestData(stateContext);
            await handlerSteps.initializeMonetization(stateContext, event);
            await handlerSteps.routeIncomingIntent(stateContext);
            await handlerSteps.walkStates(stateContext);
            response = (await handlerSteps.createFinalResult(stateContext));
            if (event.__reportStateTrace) {
              response.__stateTrace = stateContext.traceHistory;
            }
            if (dbObject.repeatHandler) {
              // the db failed to save, repeat the whole process
              return (await runHandler());
            } else {
              return resolve(response);
            }
          } catch (error) {
            err = error;
            return reject(err);
          }
        }
      });
    };
    // kick off the first one
    return (await runHandler());
  });
};

handlerSteps.parseRequestData = function (stateContext) {
  var auth, extensionName, func, handled, incomingState, intent, isColdLaunch, name, obj, ref10, ref11, ref12, ref13, ref14, ref15, ref16, ref17, ref18, ref9, request, requests, value;
  request = stateContext.request;
  // this is litexa's dynamic request context, i.e. accesible from litexa as $something
  stateContext.slots = {
    request: request
  };
  stateContext.oldInSkillProducts = stateContext.inSkillProducts = (ref9 = stateContext.db.read("__inSkillProducts")) != null ? ref9 : {
    inSkillProducts: []
  };
  // note:
  // stateContext.handoffState  : who will handle the next intent
  // stateContext.handoffIntent : which intent will be delivered next
  // stateContext.currentState  : which state are we ALREADY in
  // stateContext.nextState     : which state is queued up to be transitioned into next
  stateContext.handoffState = null;
  stateContext.handoffIntent = false;
  stateContext.currentState = stateContext.db.read("__currentState");
  stateContext.nextState = null;
  if (request.type === 'LaunchRequest') {
    reportValueMetric('Launches');
  }
  switch (request.type) {
    case 'IntentRequest':
    case 'LaunchRequest':
      incomingState = stateContext.currentState;
      // don't have a current state? Then we're going to launch
      if (!incomingState) {
        incomingState = 'launch';
        stateContext.currentState = null;
      }
      isColdLaunch = request.type === 'LaunchRequest' || ((ref10 = stateContext.event.session) != null ? ref10.new : void 0);
      if (stateContext.settings.resetOnLaunch && isColdLaunch) {
        incomingState = 'launch';
        stateContext.currentState = null;
      }
      if (request != null ? request.intent : void 0) {
        intent = request.intent;
        stateContext.intent = intent.name;
        if (intent.slots != null) {
          ref11 = intent.slots;
          for (name in ref11) {
            obj = ref11[name];
            stateContext.slots[name] = obj.value;
            auth = (ref12 = obj.resolutions) != null ? (ref13 = ref12.resolutionsPerAuthority) != null ? ref13[0] : void 0 : void 0;
            if ((auth != null) && ((ref14 = auth.status) != null ? ref14.code : void 0) === 'ER_SUCCESS_MATCH') {
              value = (ref15 = auth.values) != null ? (ref16 = ref15[0]) != null ? (ref17 = ref16.value) != null ? ref17.name : void 0 : void 0 : void 0;
              if (value != null) {
                stateContext.slots[name] = value;
              }
            }
          }
        }
        stateContext.handoffIntent = true;
        stateContext.handoffState = incomingState;
        stateContext.nextState = null;
      } else {
        stateContext.intent = null;
        stateContext.handoffIntent = false;
        stateContext.handoffState = null;
        stateContext.nextState = incomingState;
      }
      break;
    case 'Connections.Response':
      stateContext.handoffIntent = true;
      // if we get this and we're not in progress,
      // then reroute to the launch state
      if (stateContext.currentState != null) {
        stateContext.handoffState = stateContext.currentState;
      } else {
        stateContext.nextState = 'launch';
        stateContext.handoffState = 'launch';
      }
      break;
    default:
      stateContext.intent = request.type;
      stateContext.handoffIntent = true;
      stateContext.handoffState = stateContext.currentState;
      stateContext.nextState = null;
      handled = false;
      for (extensionName in extensionRequests) {
        requests = extensionRequests[extensionName];
        if (request.type in requests) {
          handled = true;
          func = requests[request.type];
          if (typeof func === 'function') {
            func(request);
          }
        }
      }
      if (ref18 = request.type, indexOf.call(litexa.extendedEventNames, ref18) >= 0) {
        handled = true;
      }
      if (!handled) {
        throw new Error(`unrecognized event type: ${request.type}`);
      }
  }
  return initializeExtensionObjects(stateContext);
};

handlerSteps.initializeMonetization = function (stateContext, event) {
  var attributes, ref10, ref11, ref9;
  stateContext.monetization = stateContext.db.read("__monetization");
  if (stateContext.monetization == null) {
    stateContext.monetization = {
      fetchEntitlements: false,
      inSkillProducts: []
    };
    stateContext.db.write("__monetization", stateContext.monetization);
  }
  if ((ref9 = (ref10 = event.request) != null ? ref10.type : void 0) === 'Connections.Response' || ref9 === 'LaunchRequest') {
    attributes = event.session.attributes;
    // invalidate monetization cache
    stateContext.monetization.fetchEntitlements = true;
    stateContext.db.write("__monetization", stateContext.monetization);
  }
  if (((ref11 = event.request) != null ? ref11.type : void 0) === 'Connections.Response') {
    stateContext.intent = 'Connections.Response';
    stateContext.handoffIntent = true;
    stateContext.handoffState = 'launch';
    stateContext.nextState = 'launch';
  }
  return Promise.resolve();
};

handlerSteps.routeIncomingIntent = async function (stateContext) {
  var base, i, item, j, name1;
  if (stateContext.nextState) {
    if (!(stateContext.nextState in __languages[stateContext.language].enterState)) {
      // we've been asked to execute a non existant state!
      // in order to have a chance at recovering, we have to drop state
      // which means when next we launch we'll start over

      // todo: reroute to launch anyway?
      await new Promise(function (resolve, reject) {
        stateContext.db.write("__currentState", null);
        return stateContext.db.finalize(function (err) {
          return reject(new Error(`Invalid state name \`${stateContext.nextState}\``));
        });
      });
    }
  }
  // if we have an intent, handle it with the current state
  // but if that handler sets a handoff, then following that
  // and keep following them until we've actually handled it
  for (i = j = 0; j < 10; i = ++j) {
    if (!stateContext.handoffIntent) {
      return;
    }
    stateContext.handoffIntent = false;
    if (enableStateTracing) {
      item = `${stateContext.handoffState}:${stateContext.intent}`;
      stateContext.traceHistory.push(item);
    }
    if (logStateTraces) {
      item = `drain intent ${stateContext.intent} in ${stateContext.handoffState}`;
      exports.Logging.log("STATETRACE " + item);
    }
    await (typeof (base = __languages[stateContext.language].processIntents)[name1 = stateContext.handoffState] === "function" ? base[name1](stateContext) : void 0);
  }
  throw new Error("Intent handler recursion error, exceeded 10 steps");
};

handlerSteps.walkStates = async function (stateContext) {
  var MaximumTransitionCount, base, i, item, j, lastState, name1, nextState, ref9;
  // keep processing state transitions until we're done
  MaximumTransitionCount = 500;
  for (i = j = 0, ref9 = MaximumTransitionCount; (0 <= ref9 ? j < ref9 : j > ref9); i = 0 <= ref9 ? ++j : --j) {
    nextState = stateContext.nextState;
    stateContext.nextState = null;
    if (!nextState) {
      return;
    }
    lastState = stateContext.currentState;
    stateContext.currentState = nextState;
    if (lastState != null) {
      await __languages[stateContext.language].exitState[lastState](stateContext);
    }
    if (enableStateTracing) {
      stateContext.traceHistory.push(nextState);
    }
    if (logStateTraces) {
      item = `enter ${nextState}`;
      exports.Logging.log("STATETRACE " + item);
    }
    if (!(nextState in __languages[stateContext.language].enterState)) {
      throw new Error(`Transitioning to an unknown state \`${nextState}\``);
    }
    await __languages[stateContext.language].enterState[nextState](stateContext);
    if (stateContext.handoffIntent) {
      stateContext.handoffIntent = false;
      if (enableStateTracing) {
        stateContext.traceHistory.push(stateContext.handoffState);
      }
      if (logStateTraces) {
        exports.Logging.log("STATETRACE " + item);
      }
      await (typeof (base = __languages[stateContext.language].processIntents)[name1 = stateContext.handoffState] === "function" ? base[name1](stateContext) : void 0);
    }
  }
  exports.Logging.error(`States error: exceeded ${MaximumTransitionCount} transitions.`);
  if (enableStateTracing) {
    exports.Logging.error(`States visited: [${stateContext.traceHistory.join(' -> ')}]`);
  } else {
    exports.Logging.error("Set 'enableStateTracing' to get a history of which states were visited.");
  }
  throw new Error(`States error: exceeded ${MaximumTransitionCount} transitions. Check your logic for non-terminating loops.`);
};

handlerSteps.createFinalResult = async function (stateContext) {
  var card, content, d, err, events, extensionName, hasDisplay, joinSpeech, keep, parts, ref10, ref11, ref12, ref13, ref14, ref15, ref16, ref17, ref18, ref19, ref9, response, s, stripSSML, title, wrapper;
  stripSSML = function (line) {
    if (line == null) {
      return void 0;
    }
    line = line.replace(/<[^>]+>/g, '');
    return line.replace(/[ ]+/g, ' ');
  };
  // invoke any 'afterStateMachine' extension events
  for (extensionName in extensionEvents) {
    events = extensionEvents[extensionName];
    try {
      await (typeof events.afterStateMachine === "function" ? events.afterStateMachine() : void 0);
    } catch (error) {
      err = error;
      exports.Logging.error(`Failed to execute afterStateMachine for extension ${extensionName}: ${err}`);
      throw err;
    }
  }
  hasDisplay = ((ref9 = stateContext.event.context) != null ? (ref10 = ref9.System) != null ? (ref11 = ref10.device) != null ? (ref12 = ref11.supportedInterfaces) != null ? ref12.Display : void 0 : void 0 : void 0 : void 0) != null;
  // start building the final response json object
  wrapper = {
    version: "1.0",
    sessionAttributes: {},
    userAgent: userAgent, // this userAgent value is generated in project-info.coffee and injected in skill.coffee
    response: {
      shouldEndSession: stateContext.shouldEndSession
    }
  };
  response = wrapper.response;
  if (stateContext.shouldDropSession) {
    delete response.shouldEndSession;
  }
  // build outputSpeech and reprompt from the accumulators
  joinSpeech = function (arr, language = 'default') {
    var j, k, len, len1, line, mapping, ref13, ref14, result;
    if (!arr) {
      return '';
    }
    result = arr[0];
    ref13 = arr.slice(1);
    for (j = 0, len = ref13.length; j < len; j++) {
      line = ref13[j];
      // If the line starts with punctuation, don't add a space before.
      if (line.match(/^[?!:;,.]/)) {
        result += line;
      } else {
        result += ` ${line}`;
      }
    }
    result = result.replace(/(  )/g, ' ');
    if (litexa.sayMapping[language]) {
      ref14 = litexa.sayMapping[language];
      for (k = 0, len1 = ref14.length; k < len1; k++) {
        mapping = ref14[k];
        result = result.replace(mapping.from, mapping.to);
      }
    }
    return result;
  };
  if ((stateContext.say != null) && stateContext.say.length > 0) {
    response.outputSpeech = {
      type: "SSML",
      ssml: `<speak>${joinSpeech(stateContext.say, stateContext.language)}</speak>`,
      playBehavior: "REPLACE_ALL"
    };
  }
  if ((stateContext.reprompt != null) && stateContext.reprompt.length > 0) {
    response.reprompt = {
      outputSpeech: {
        type: "SSML",
        ssml: `<speak>${joinSpeech(stateContext.reprompt, stateContext.language)}</speak>`
      }
    };
  }
  if (stateContext.card != null) {
    card = stateContext.card;
    title = (ref13 = card.title) != null ? ref13 : "";
    content = (ref14 = card.content) != null ? ref14 : "";
    if (card.repeatSpeech && (stateContext.say != null)) {
      parts = (function () {
        var j, len, ref15, results;
        ref15 = stateContext.say;
        results = [];
        for (j = 0, len = ref15.length; j < len; j++) {
          s = ref15[j];
          results.push(stripSSML(s));
        }
        return results;
      })();
      content += parts.join('\n');
    }
    content = content != null ? content : "";
    response.card = {
      type: "Simple",
      title: title != null ? title : ""
    };
    response.card.title = response.card.title.trim();
    if (card.imageURLs != null) {
      response.card.type = "Standard";
      response.card.text = content != null ? content : "";
      response.card.image = {
        smallImageUrl: card.imageURLs.cardSmall,
        largeImageUrl: card.imageURLs.cardLarge
      };
      response.card.text = response.card.text.trim();
    } else {
      response.card.type = "Simple";
      response.card.content = content;
      response.card.content = response.card.content.trim();
    }
    keep = false;
    if (response.card.title.length > 0) {
      keep = true;
    }
    if (((ref15 = response.card.text) != null ? ref15.length : void 0) > 0) {
      keep = true;
    }
    if (((ref16 = response.card.content) != null ? ref16.length : void 0) > 0) {
      keep = true;
    }
    if (((ref17 = response.card.image) != null ? ref17.smallImageUrl : void 0) != null) {
      keep = true;
    }
    if (((ref18 = response.card.image) != null ? ref18.largeImageUrl : void 0) != null) {
      keep = true;
    }
    if (!keep) {
      delete response.card;
    }
  }
  if (stateContext.musicCommand != null) {
    stateContext.directives = (ref19 = stateContext.directives) != null ? ref19 : [];
    switch (stateContext.musicCommand.action) {
      case 'play':
        stateContext.directives.push({
          type: "AudioPlayer.Play",
          playBehavior: "REPLACE_ALL",
          audioItem: {
            stream: {
              url: stateContext.musicCommand.url,
              token: "no token",
              offsetInMilliseconds: 0
            }
          }
        });
        break;
      case 'stop':
        stateContext.directives.push({
          type: "AudioPlayer.Stop"
        });
    }
  }
  // store current state for next time, unless we're intentionally ending
  if (stateContext.shouldEndSession) {
    stateContext.currentState = null;
  }
  if (stateContext.currentState === null) {
    response.shouldEndSession = true;
  }
  stateContext.db.write("__currentState", stateContext.currentState);
  stateContext.db.write("__settings", stateContext.settings);
  // filter out any directives that were marked for removal
  stateContext.directives = (function () {
    var j, len, ref20, results;
    ref20 = stateContext.directives;
    results = [];
    for (j = 0, len = ref20.length; j < len; j++) {
      d = ref20[j];
      if (!d.DELETEME) {
        results.push(d);
      }
    }
    return results;
  })();
  if ((stateContext.directives != null) && stateContext.directives.length > 0) {
    response.directives = stateContext.directives;
  }
  // last chance, see if the developer left a postprocessor to run here
  if (litexa.responsePostProcessor != null) {
    litexa.responsePostProcessor(wrapper, stateContext);
  }
  return (await new Promise(function (resolve, reject) {
    return stateContext.db.finalize(function (err, info) {
      if (err != null) {
        if (!db.repeatHandler) {
          reject(err);
        }
      }
      return resolve(wrapper);
    });
  }));
};
