/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS202: Simplify dynamic range loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import fs from 'fs';

import path from 'path';
import mkdirp from 'mkdirp';
import coffee from 'coffeescript';
import testing from './testing';
const { ParserError, formatLocationStart } = require("./errors").lib;
import { default as sayCounter } from './sayCounter';
import { default as MockDB } from './mockdb';
import Files from './files';
import litexaParser from './parser';
const { _initPaths } = require('module').Module;

const lib = require('./parserlib');

const makeReferenceTester = function(litexaRoot, source) {
  let func;
  try {
    // build a closure that can check for the existence of a symbol
    // within the main body of the inline code closure
    process.env.NODE_PATH = path.join(litexaRoot, 'node_modules');
    _initPaths();
    func = eval(`\
(function() {
  ${source}
  return (test) => eval("typeof(" + test + ") != 'undefined';");
})();\
`
    );
  } catch (err) {
    // complex code could die in that closure, and if it does we're
    // unable to validate local variable usage as they may be pointing
    // to a JavaScript variable
    console.error(`warning: user code is either failing to compile, \
or is too complex for simple reference tester: ${err}. \
Variable names from code cannot be checked in Litexa.`
    );
    func = test => true;
  }

  return func;
};

export class Skill {
  constructor(projectInfo) {
    let extensionInfo, extensionName;
    this.projectInfo = projectInfo;
    if (!this.projectInfo) {
      throw new Error("Cannot construct a skill without a project info");
    }
    if (!this.projectInfo.name) {
      throw new Error("Cannot construct a skill without a name");
    }
    this.name = this.projectInfo.name;

    // might be a custom parser, if there are extensions
    this.parser = null;

    if ((typeof window !== 'undefined' && window !== null ? window.literateAlexaParser : undefined)) {
      this.parser = window.literateAlexaParser;
    } else {
      this.parser = eval(litexaParser.buildExtendedParser(this.projectInfo));
    }

    // cache these to customize the handler
    this.extendedEventNames = {};
    for (extensionName in this.projectInfo.extensions) {
      extensionInfo = this.projectInfo.extensions[extensionName];
      if ((extensionInfo.compiler != null ? extensionInfo.compiler.validEventNames : undefined) == null) { continue; }
      for (let eventName of (extensionInfo.compiler != null ? extensionInfo.compiler.validEventNames : undefined)) {
        this.extendedEventNames[eventName] = true;
      }
    }
    this.extendedEventNames = ((() => {
      const result = [];
       for (let e in this.extendedEventNames) {
        result.push(e);
      }
      return result;
    })());

    // cache these for testing later
    this.directiveValidators = {};
    for (extensionName in this.projectInfo.extensions) {
      extensionInfo = this.projectInfo.extensions[extensionName];
      const vals = __guard__(extensionInfo.compiler != null ? extensionInfo.compiler.validators : undefined, x => x.directives) != null ? __guard__(extensionInfo.compiler != null ? extensionInfo.compiler.validators : undefined, x => x.directives) : {};
      for (let directiveName in vals) {
        const validator = vals[directiveName];
        if (directiveName in this.directiveValidators) {
          const v = this.directiveValidators[directiveName];
          throw new Error(`duplicate directive validator for the directive \
${directiveName} found in both ${extensionName} and ${v.sourceExtension}`
          );
        }
        validator.sourceExtension = extensionName;
        this.directiveValidators[directiveName] = validator;
      }
    }

    // sources
    this.files = {};
    this.languages =
      {'default': {}};
    this.reparseLiterateAlexa();
  }

  setFile(filename, language, contents) {
    if (contents == null) {
      console.log(filename, language, contents);
      if (contents == null) { throw new Error("probably missing language at skill set file"); }
    }

    if (contents == null) {
      console.error(`could not set contents of ${filename} to ${contents}`);
      return;
    }

    if (['config.json'].includes(filename)) {
      // ignore these, they're used by the system not the skill
      return;
    }

    if (!(language in this.languages)) { this.languages[language] = {}; }

    const existingFile = this.files[filename];
    if (existingFile != null) {
      existingFile.replaceContent(language, contents);
      return;
    }

    const match = Files.infoFromFilename(filename);
    if (match == null) {
      throw new Error(`couldn't find extension in filename ${filename}`);
    }
    let { category, name, extension } = match;

    if (name === 'skill') {
      category = 'config';
    }

    switch (extension) {
      case "litexa":
        this.files[filename] = new Files.LiterateAlexaFile(name, language, "litexa", contents, category);
        this.files[filename].parsed = false;
        return this.files[filename].dirty = true;
      case "js":
        return this.files[filename] = new Files.JavaScriptFile(name, language, extension, contents, category);
      case "coffee":
        return this.files[filename] = new Files.CoffeeScriptFile(name, language, extension, contents, category);
      case "json":
        return this.files[filename] = new Files.JSONDataFile(name, language, extension, contents, category);
      default:
        throw new Error(`couldn't work out what to do with extension ${extension} in file ${filename}`);
    }
  }

  getFileContents(searchFilename, language) {
    if (!(language in this.languages)) {
      language = this.getLanguageForRegion(language);
    }
    for (let filename in this.files) {
      const file = this.files[filename];
      if (filename === searchFilename) {
        return file.contentForLanguage(language);
      }
    }
    return null;
  }

  getExtensions() {
    return (this.projectInfo != null ? this.projectInfo.extensions : undefined) != null ? (this.projectInfo != null ? this.projectInfo.extensions : undefined) : {};
  }

  createDefaultStates() {
    let global, intent, launch;
    const result = {};
    result.launch = (launch = new lib.State('launch'));
    result.global = (global = new lib.State("global"));

    const pushCode = function(target, line) {
      line.location = { source: 'default state constructor', language: 'default' };
      return target.pushCode(line);
    };

    const location =
    (intent = global.pushOrGetIntent(null, "AMAZON.StopIntent", null));
    intent.defaultedResetOnGet = true;
    pushCode(intent, new lib.SetSkillEnd());

    intent = global.pushOrGetIntent(null, "AMAZON.CancelIntent", null);
    intent.defaultedResetOnGet = true;
    pushCode(intent, new lib.SetSkillEnd());

    intent = global.pushOrGetIntent(null, "AMAZON.StartOverIntent", null);
    intent.defaultedResetOnGet = true;
    pushCode(intent, new lib.Transition("launch", false));

    result.launch.resetParsePhase();
    result.global.resetParsePhase();

    return result;
  }


  reparseLiterateAlexa() {
    // parsed parts
    let extension, language, state;
    let name;
    this.states = this.createDefaultStates();
    this.tests = {};
    this.dataTables = {};
    this.sayMapping = {};
    this.dbTypes = {};
    this.maxStateNameLength = 16;

    for (let extensionName in this.projectInfo.extensions) {
      extension = this.projectInfo.extensions[extensionName];
      if (extension.statements == null) { continue; }
      const {
        statements
      } = extension;
      if (statements.lib == null) { continue; }
      for (let k in statements.lib) {
        const v = statements.lib[k];
        lib[k] = v;
      }
    }

    for (language in this.languages) {
      // begin from the top of the state again each time
      for (name in this.states) {
        state = this.states[name];
        state.resetParsePhase();
      }

      for (name in this.files) {
        const file = this.files[name];
        if (file.extension === 'litexa') {
          try {
            const litexaSource = file.contentForLanguage(language);
            const shouldIncludeFile = this.parser.parse(litexaSource, {
              lib,
              skill: this,
              source: file.filename(),
              startRule: 'AllFileExclusions',
              context: {
                skill: this
              }
            });
            if (!shouldIncludeFile) { continue; }

            this.parser.parse(litexaSource, {
              lib,
              skill: this,
              source: file.filename(),
              language
            });
          } catch (err) {
            err.location = err.location != null ? err.location : {};
            err.location.source = name;
            err.location.language = language;
            throw err;
          }
        }
      }
    }

    // now that we have all the states, validate connectivity
    const stateNames = ((() => {
      const result = [];
       for (name in this.states) {
        result.push(name);
      }
      return result;
    })());
    for (language in this.languages) {
      for (name in this.states) {
        state = this.states[name];
        state.validateTransitions(stateNames, language);
      }
    }

    // check to see that every slot type is built in or defined
    // note, custom slots may be defined out of order, so we let
    // those slide until we get here
    return (() => {
      const result1 = [];
      for (language in this.languages) {
        var context = {
          skill: this,
          language,
          types: []
        };

        var customSlotTypes = [];
        for (name in this.states) {
          state = this.states[name];
          state.collectDefinedSlotTypes(context, customSlotTypes);
        }

        result1.push((() => {
          const result2 = [];
          for (name in this.states) {
            state = this.states[name];
            result2.push(state.validateSlotTypes(context, customSlotTypes));
          }
          return result2;
        })());
      }
      return result1;
    })();
  }


  pushOrGetState(stateName, location) {
    if (!(stateName in this.states)) {
      this.states[stateName] = new lib.State(stateName);
    }

    for (let name in this.states) {
      this.maxStateNameLength = Math.max( this.maxStateNameLength, name.length + 2 );
    }

    const state = this.states[stateName];

    // a state may only exist once per language
    if (state.locations[location.language] != null) {
      throw new ParserError(location, `a state named ${stateName} was already \
defined at ${formatLocationStart(state.locations[location.language])}`
      );
    }

    // record this as the one
    state.locations[location.language] = location;
    state.prepareForLanguage(location);

    // record the default location as primary
    if (location.language === 'default') {
      state.location = location;
    }
    return state;
  }

  pushIntent(state, location, utterance, intentInfo) {
    // scan for duplicates, we'll merge if we see them
    const intent = state.pushOrGetIntent(location, utterance, intentInfo);
    for (let stateName in this.states) {
      const existingState = this.states[stateName];
      if (existingState !== state) {
        const existingIntent = existingState.getIntentInLanguage(location.language, intent.name);
        if ((existingIntent != null) && (existingIntent.referenceIntent == null)) {
          intent.referenceIntent = existingIntent;
          return intent;
        }
      }
    }
    return intent;
  }

  pushCode(line) {
    this.startFunction = this.startFunction != null ? this.startFunction : new lib.Function;
    return this.startFunction.lines.push(line);
  }

  pushTest(test) {
    this.tests[test.location.language] = this.tests[test.location.language] != null ? this.tests[test.location.language] : [];
    return this.tests[test.location.language].push(test);
  }

  pushDataTable(table) {
    // todo name stomp?
    return this.dataTables[table.name] = table;
  }

  pushSayMapping(location, from, to) {
    if (location.language in this.sayMapping) {
      for (let mapping of this.sayMapping[location.language]) {
        if ((mapping.from === from) && (mapping.to === !to)) {
          throw new ParserError(location, `duplicate pronunciation mapping for \'${from}\' \
as \'${to}\' in \'${location.language}\' language, previously \'${mapping.to}\'`
          );
        }
      }
      return this.sayMapping[location.language].push({ from, to });
    } else {
      return this.sayMapping[location.language] = [{ from, to }];
    }
  }

  pushDBTypeDefinition(definition) {
    const defLocation = definition.location;
    const defLanguage = definition.location.language;
    const defName = definition.name;
    const defType = definition.type;

    this.dbTypes[defLanguage] = this.dbTypes[defLanguage] != null ? this.dbTypes[defLanguage] : {};

    if ((this.dbTypes[defLanguage] != null ? this.dbTypes[defLanguage][defName] : undefined) != null) {
      throw new ParserError(defLocation, `The DB variable ${this.dbTypes[defLanguage][defName]} already \
has the previously defined type ${this.dbTypes[defLanguage][defName]} in language ${defLanguage}`
      );
    }

    return this.dbTypes[defLanguage][defName] = defType;
  }

  refreshAllFiles() {
    let litexaDirty = false;
    for (let name in this.files) {
      const file = this.files[name];
      if ((file.extension === 'litexa') && file.dirty) {
        litexaDirty = true;
        file.dirty = false;
      }
    }
    if (this.projectInfoDirty) {
      litexaDirty = true;
      this.projectInfoDirty = false;
    }
    if (litexaDirty) {
      return this.reparseLiterateAlexa();
    }
  }

  toSkillManifest() {
    const skillFile = this.files['skill.json'];
    if (skillFile == null) {
      return "missing skill file";
    }
    const output = JSON.parse(JSON.stringify(skillFile.content));
    __guard__(__guard__(__guard__(output.skillManifest != null ? output.skillManifest.apis : undefined, x2 => x2.custom), x1 => x1.endpoint), x => x.uri = "arn");
    return JSON.stringify(output, null, 2);
  }

  toLambda(options) {
    let language, source;
    this.refreshAllFiles();

    sayCounter.reset();

    options = options != null ? options : {};
    this.libraryCode = [
      "var litexa = exports.litexa;",
      "if (typeof(litexa) === 'undefined') { litexa = {}; }",
      "if (typeof(litexa.modulesRoot) === 'undefined') { litexa.modulesRoot = process.cwd(); }"
    ];

    if (this.projectInfo.DEPLOY != null) {
      this.libraryCode.push(`litexa.DEPLOY = ${JSON.stringify(this.projectInfo.DEPLOY)};`);
    }

    if (options.preamble != null) {
      this.libraryCode.push(options.preamble);
    } else {
      source = fs.readFileSync(__dirname + '/lambda-preamble.js', 'utf8');
      this.libraryCode.push(source);
    }

    // some functions we'd like to allow developers to override
    this.libraryCode.push("litexa.overridableFunctions = {");
    this.libraryCode.push("  generateDBKey: function(identity) {");
    this.libraryCode.push("    return `${identity.deviceId}`;");
    this.libraryCode.push("  }");
    this.libraryCode.push("};");

    // @TODO: remove dynamoDb from core litexa into the deploy-aws module
    const ttlConfiguration = __guard__(__guard__(this.projectInfo.deployments != null ? this.projectInfo.deployments[this.projectInfo.variant] : undefined, x1 => x1.dynamoDbConfiguration), x => x.timeToLive);
    if (((ttlConfiguration != null ? ttlConfiguration.AttributeName : undefined) != null) && ((ttlConfiguration != null ? ttlConfiguration.secondsToLive : undefined) != null)) {
      if (typeof(ttlConfiguration.AttributeName) !== "string") {
        throw new Error("`dynamoDbConfiguration.AttributeName` must be a string.");
      }
      if (typeof(ttlConfiguration.secondsToLive) !== "number") {
        throw new Error("`dynamoDbConfiguration.secondsToLive` must be a number.");
      }
      this.libraryCode.push("litexa.ttlConfiguration = {");
      this.libraryCode.push(`  AttributeName: '${ttlConfiguration.AttributeName}',`);
      this.libraryCode.push(`  secondsToLive: ${ttlConfiguration.secondsToLive}`);
      this.libraryCode.push("};");
    } else if (((ttlConfiguration != null ? ttlConfiguration.AttributeName : undefined) != null) || ((ttlConfiguration != null ? ttlConfiguration.secondsToLive : undefined) != null)) {
      console.log("Not setting TTL. If you want to set a TTL, Litexa config requires both `AttributeName` and `secondsToLive` fields in `dynamoDbConfiguration.timeToLive`.");
    }

    const librarySource = fs.readFileSync(__dirname + '/litexa-library.js', 'utf8');
    this.libraryCode.push(librarySource);

    source = fs.readFileSync(__dirname + '/litexa-gadget-animation.js', 'utf8');
    this.libraryCode.push(source);

    this.libraryCode.push(this.extensionRuntimeCode());

    this.libraryCode.push(`litexa.extendedEventNames = ${JSON.stringify(this.extendedEventNames)};`);

    this.libraryCode = this.libraryCode.join("\n");

    const output = new Array;

    output.push(this.libraryCode);

    output.push("// END OF LIBRARY CODE");

    output.push("\n// version summary");
    output.push(`const userAgent = ${JSON.stringify(this.projectInfo.userAgent)};\n`);

    output.push(`litexa.projectName = '${this.name}';`);
    output.push("var __languages = {};");
    for (language in this.languages) {
      output.push(`__languages['${language}'] = { enterState:{}, processIntents:{}, exitState:{}, dataTables:{} };`);
    }

    (() => {
      output.push("litexa.sayMapping = {");
      for (language in this.sayMapping) {
        const lines = [];
        output.push(`  '${language}': [`);
        for (let mapping of this.sayMapping[language]) {
          const from = mapping.from.replace(/'/g, '\\\'');
          const to = mapping.to.replace(/'/g, '\\\'');
          lines.push(`    { from: new RegExp(' ${from}','gi'), to: ' ${to}' }`);
          lines.push(`    { from: new RegExp('${from} ','gi'), to: '${to} ' }`);
        }
        output.push(lines.join(",\n"));
        output.push("  ],");
      }
      return output.push("};");
    })();

    (() => {
      let file, name;
      const shouldIncludeFile = function(file) {
        if (file.extension !== 'json') { return false; }
        if (file.fileCategory !== 'regular') { return false; }
        return true;
      };

      // write out the default language file data as
      // an inlined in memory cache
      output.push("var jsonSourceFiles = {}; ");
      const defaultFiles = [];
      for (name in this.files) {
        file = this.files[name];
        if (!shouldIncludeFile(file)) { continue; }
        if (file.content['default'] == null) { continue; }
        output.push(`jsonSourceFiles['${name}'] = ${JSON.stringify(file.content['default'], null, 2)};`);
        defaultFiles.push(name);
      }
      output.push("\n");

      output.push("__languages.default.jsonFiles = {");
      let props = [];
      for (name of defaultFiles) {
        props.push(`  '${name}': jsonSourceFiles['${name}']`);
      }
      output.push(props.join(",\n"));
      output.push("};\n");

      // each language is then either a pointer back
      // to the main cache, or a local override data block
      return (() => {
        const result = [];
        for (language in this.languages) {
          if (language === 'default') { continue; }
          const files = {};
          for (name in this.files) {
            file = this.files[name];
            if (!shouldIncludeFile(file)) { continue; }
            if (language in file.content) {
              files[name] = JSON.stringify(file.content[language], null, 2);
            } else if ('default' in file.content) {
              files[name] = true;
            }
          }
          output.push(`__languages['${language}'].jsonFiles = {`);
          props = [];
          for (name in files) {
            const data = files[name];
            if (data === true) {
              props.push(`  '${name}': jsonSourceFiles['${name}']`);
            } else {
              props.push(`  '${name}': ${data}`);
            }
          }
          output.push(props.join(",\n"));
          result.push(output.push("};\n"));
        }
        return result;
      })();
    })();

    //output.push "exports.dataTables = {};"

    source = fs.readFileSync(__dirname + '/handler.js', 'utf8');
    output.push(source);

    for (language in this.languages) {
      var dbType, dbTypeName, name;
      options.language = language;
      output.push("(function( __language ) {");
      output.push("var enterState = __language.enterState;");
      output.push("var processIntents = __language.processIntents;");
      output.push("var exitState = __language.exitState;");
      output.push("var dataTables = __language.dataTables;");
      output.push("var jsonFiles = __language.jsonFiles;");

      output.push(this.lambdaCodeForLanguage(language, output));

      (() => {
        let referenceSourceCode = "var litexa = {};\n";
        referenceSourceCode += librarySource + "\n";
        referenceSourceCode += this.extensionRuntimeCode();
        referenceSourceCode += this.testLibraryCodeForLanguage(language) + "\n";

        try {
          // for pro debugging when you get the error about complexity, write
          // the contents of the reference tester to the .test directory
          mkdirp.sync(path.join(this.projectInfo.root, '.test'));
          fs.writeFileSync((path.join(this.projectInfo.root, '.test', 'referenceTester.js')), referenceSourceCode);
        } catch (error) {}

        return options.referenceTester = makeReferenceTester((path.join(this.projectInfo.root, 'litexa')), referenceSourceCode);
      })();

      // inject code to map typed DB objects to their
      // types from inside this closure
      output.push("__language.dbTypes = {");
      const lines = [];
      for (dbTypeName in this.dbTypes[language]) {
        dbType = this.dbTypes[language][dbTypeName];
        lines.push(`  ${dbTypeName}: ${dbType}`);
      }

      // Copy over any default DB type definitions that aren't explicitly overriden.
      if (language !== "default") {
        for (dbTypeName in this.dbTypes.default) {
          dbType = this.dbTypes.default[dbTypeName];
          this.dbTypes[language] = this.dbTypes[language] != null ? this.dbTypes[language] : {};
          this.dbTypes[language][dbTypeName] = this.dbTypes[language][dbTypeName] != null ? this.dbTypes[language][dbTypeName] : dbType;
        }
      }

      output.push(lines.join(",\n"));
      output.push("};");

      for (name in this.states) {
        const state = this.states[name];
        state.toLambda(output, options);
      }
      output.push("\n");

      for (name in this.dataTables) {
        const table = this.dataTables[name];
        table.toLambda(output, options);
      }
      output.push("\n");

      output.push(`})( __languages['${language}'] );`);
      output.push("\n");
    }

    return output.join('\n');
  }


  extensionRuntimeCode() {
    if (this.projectInfo == null) { return ""; }
    const code = [];
    const names = {};

    const list = [];
    for (let extensionName in this.projectInfo.extensions) {
      const extension = this.projectInfo.extensions[extensionName];
      const {
        runtime
      } = extension;
      if (runtime == null) { continue; }

      if (runtime.apiName == null) {
        throw new Error(`Extension \`${extensionName}\` specifies it has a runtime \
component, but didn't provide an apiName key`
        );
      }
      const {
        apiName
      } = runtime;

      if (runtime.apiName in names) {
        throw new Error(`Extension \`${extensionName}\` specifies a runtime \
component with the apiName \`${apiName}\`, but that name \
is already in use by the \`${names[apiName]}\` extension.`
        );
      }

      names[apiName] = extensionName;

      list.push(`  // ${extensionName} extension`);
      if (runtime.require != null) {
        list.push(`  ref = require('${runtime.require}')(context);`);
      } else if (runtime.source != null) {
        list.push(`  ref = (${runtime.source})(context);`);
      } else {
        throw new Error(`Extension \`${extensionName}\` specified a runtime \
component, but provides neither require nor source keys.`
        );
      }

      list.push(`  ${apiName} = ref.userFacing;`);
      list.push(`  extensionEvents['${extensionName}'] = ref.events;`);
      list.push(`  if (ref.requests) { extensionRequests['${extensionName}'] = ref.requests; }`);
    }

    if (list.length > 0) {
      code.push("// *** Runtime objects from loaded extensions");
      for (let name in names) {
        code.push(`let ${name} = null;`);
      }
      code.push("\n");
    }

    code.push("// *** Initializer functions from loaded extensions");
    code.push("let extensionEvents = {};");
    code.push("let extensionRequests = {};");
    code.push("function initializeExtensionObjects(context){");
    code.push("  let ref = null;");
    code.push(list.join("\n"));
    code.push("};");

    return code.join('\n');
  }

  testLibraryCodeForLanguage(language) {
    const output = [];
    output.push("var jsonFiles = {};");
    for (let name in this.files) {
      const file = this.files[name];
      if (file.extension !== 'json') { continue; }
      if (file.fileCategory !== 'regular') { continue; }
      const content = file.contentForLanguage(language);
      if (content != null) {
        output.push(`jsonFiles['${name}'] = ${JSON.stringify(content)};`);
      }
    }
    output.push(this.lambdaCodeForLanguage(language));
    return output.join('\n');
  }

  lambdaCodeForLanguage(language) {
    let coffeeCode;
    let output = [];
    const appendFiles = filter => {
      return (() => {
        const result = [];
        for (let name in this.files) {
          const file = this.files[name];
          if (file.extension !== filter) { continue; }
          if (file.fileCategory !== 'regular') { continue; }
          if (file.exception != null) {
            throw file.exception;
          }
          result.push(output.push(file.rawForLanguage(language)));
        }
        return result;
      })();
    };

    appendFiles('js');
    const jsCode = output.join('\n');
    output = [];
    appendFiles('coffee');
    try {
      const allCode = output.join('\n');
      coffeeCode = coffee.compile(allCode, { bare: true });
    } catch (err) {
      err.filename = 'allcoffee';
    }

    return jsCode + '\n' + coffeeCode;
  }


  hasStatementsOfType(types) {
    for (let name in this.states) {
      const state = this.states[name];
      if (state.hasStatementsOfType(types)) { return true; }
    }
    return false;
  }

  collectRequiredAPIs(apis) {
    this.refreshAllFiles();
    return (() => {
      const result = [];
      for (let name in this.states) {
        const state = this.states[name];
        result.push((typeof state.collectRequiredAPIs === 'function' ? state.collectRequiredAPIs(apis) : undefined));
      }
      return result;
    })();
  }


  toUtterances() {
    this.refreshAllFiles();
    const output = [];
    for (let name in this.states) {
      const state = this.states[name];
      state.toUtterances(output);
    }
    return output.join('\n');
  }

  getLanguageForRegion(region) {
    if (region == null) { throw new Error("missing region"); }
    let language = region;
    if (!(language in this.languages)) {
      language = language.slice(0, 2);
      if (language === 'en') {
        language = 'default';
      }
      if (!(language in this.languages)) {
        language = 'default';
        const message = `cannot find language for region ${region} in skill ${this.name}, only have ${(() => {
          const result = [];
          for (let k in this.languages) {
            result.push(k);
          }
          return result;
        })()}`;
        if (this.strictMode) {
          throw new Error(message);
        } else {
          console.error(message);
        }
      }
    }
    return language;
  }


  toModelV2(region) {
    let name;
    this.refreshAllFiles();

    if (region == null) {
      throw new Error("missing region for toModelV2");
    }

    const language = this.getLanguageForRegion(region);

    const context = {
      intents: {},
      language,
      skill: this,
      types: {}
    };

    const output = {
      languageModel: {
        invocationName: "",
        types: [],
        intents: []
      }
    };

    for (name in this.states) {
      const state = this.states[name];
      state.toModelV2(output, context, this.extendedEventNames);
    }

    for (name in context.types) {
      const type = context.types[name];
      output.languageModel.types.push(type);
    }

    if (output.languageModel.types.length === 0) {
      delete output.languageModel.types;
    }

    const addRequiredIntents = function(list) {
      let i;
      const intentMap = {};
      for (i of output.languageModel.intents) {
        intentMap[i.name] = true;
      }

      return (() => {
        const result = [];
        for (i of list) {
          if (!(i in intentMap)) {
            result.push(output.languageModel.intents.push({ name: i }));
          } else {
            result.push(undefined);
          }
        }
        return result;
      })();
    };

    if (this.hasStatementsOfType(['music'])) {
      // audio player required
      if (true) {
        addRequiredIntents([
          "AMAZON.PauseIntent",
          "AMAZON.ResumeIntent"
        ]);
      }

      // audio player optional
      if (false) {
        addRequiredIntents([
          "AMAZON.CancelIntent",
          "AMAZON.LoopOffIntent",
          "AMAZON.LoopOnIntent",
          "AMAZON.NextIntent",
          "AMAZON.PreviousIntent",
          "AMAZON.RepeatIntent",
          "AMAZON.ShuffleOffIntent",
          "AMAZON.ShuffleOnIntent"
        ]);
      }

      // display optional
      if (false) {
        addRequiredIntents([
          "AMAZON.NavigateHomeIntent"
        ]);
      }
    }

    // ??
    addRequiredIntents([ "AMAZON.StartOverIntent" ]);

    // This one is required, and SMAPI will actually auto insert it
    addRequiredIntents([ "AMAZON.NavigateHomeIntent" ]);

    let invocation = this.name.replace(/[^a-zA-Z0-9 ]/g, ' ');
    if (this.files['skill.json']) {
      const read = __guard__(__guard__(this.files['skill.json'].content.manifest.publishingInformation != null ? this.files['skill.json'].content.manifest.publishingInformation.locales : undefined, x1 => x1[region]), x => x.invocationName);
      if (read != null) { invocation = read; }
    }
    output.languageModel.invocationName = invocation.toLowerCase();
    return output;
  }

  hasIntent(name, language) {
    for (let n in this.states) {
      const state = this.states[n];
      if (state.hasIntent(name, language)) { return true; }
    }
    return false;
  }

  toLocalization() {
    this.refreshAllFiles();

    const localization = {
      intents: {},
      speech: {}
    };

    for (let name in this.states) {
      const state = this.states[name];
      state.toLocalization(localization);
    }

    return localization;
  }


  runTests(options, cb, tests) {

    let err, file, n, name, t, test;
    let k;
    const testContext = new lib.TestContext(this, options);

    testContext.litexaRoot = '';

    if ((this.config != null ? this.config.root : undefined) != null) {
      //process.chdir @config.root
      testContext.litexaRoot = path.join(this.config.root, 'litexa');
    }

    if ((this.projectInfo != null ? this.projectInfo.root : undefined) != null) {
      testContext.litexaRoot = path.join(this.projectInfo.root, 'litexa');
    }

    testContext.testRoot = path.join(testContext.litexaRoot, '..', '.test');

    for (k of ['abbreviateTestOutput', 'strictMode', 'testDevice']) {
      if ((options != null ? options[k] : undefined) != null) {
        this[k] = options[k];
      }
    }

    options.reportProgress = options.reportProgress != null ? options.reportProgress : function() {};

    if (this.abbreviateTestOutput == null) {
      this.abbreviateTestOutput = true;
    }

    const testRegion = options.region != null ? options.region : 'en-US';
    testContext.language = (this.testLanguage = this.getLanguageForRegion(testRegion));
    // test the language model doesn't have any errors
    const languageModel = this.toModelV2(testRegion);

    // mock some things external to the handler
    const db = new MockDB();
    testContext.db = db;

    // for better error reporting, while testing prefer to have tracing on
    if (process.env.enableStateTracing == null) {
      process.env.enableStateTracing = true;
    }

    // capture the lambda compilation
    const exports = {};
    testContext.lambda = exports;

    exports.litexa = {
      assetsRoot: 'test://',
      localTesting: true,
      localTestRoot: this.projectInfo.testRoot,
      localAssetsRoot: path.join(testContext.litexaRoot, 'assets'),
      modulesRoot: path.join(testContext.litexaRoot),
      reportProgress: options.reportProgress
    };

    testContext.litexa = exports.litexa;

    exports.executeInContext = line => eval(line);

    try {
      this.lambdaSource = this.toLambda({preamble: "", strictMode: options.strictMode});
      this.lambdaSource += `\
escapeSpeech = function(line) {
  return ("" + line).replace(/ /g, '\u00A0');
}\
`;
    } catch (error) {
      err = error;
      console.error("failed to construct skill function");
      return cb(err, { summary: err.stack });
    }

    try {
      process.env.NODE_PATH = path.join(testContext.litexaRoot, 'node_modules');
      _initPaths();

      if ((this.projectInfo != null ? this.projectInfo.testRoot : undefined) != null) {
        fs.writeFileSync((path.join(this.projectInfo.testRoot, 'test.js')), this.lambdaSource, 'utf8');
      }

      eval(this.lambdaSource);
    } catch (error1) {
      // see if we can catch the source
      // console.error err
      /*
        try
          Module = require 'module'
          tmp = new Module
          tmp._compile @lambdaSource, 'test.js'
        catch err2
          if err2.toString() == err.toString()
            console.error err2.stack
      */
      err = error1;
      return cb(err, { summary: "Failed to bind skill function, check your inline code for errors." });
    }

    const {
      Logging
    } = exports;
    Logging.log = function() {
      return console.log.apply(console, arguments);
    };
    Logging.error = function() {
      return console.error.apply(console, arguments);
    };
    exports.Logging = Logging;

    // determine which tests to run
    let remainingTests = [];
    if (tests) {
      for (t of tests) { remainingTests.push(t); }
    } else {
      const focusTest = function(testfilename, testname) {
        if (options.focusedFiles == null) { return true; }
        for (let f of options.focusedFiles) {
          if (testfilename.indexOf(f) >= 0) {
            return true;
          }
          if (testname && (testname.indexOf(f) >= 0)) {
            return true;
          }
        }
        return false;
      };

      const includedTests = {};
      if (this.testLanguage in this.tests) {
        for (test of this.tests[this.testLanguage]) {
          if (!focusTest(test.sourceFilename, test.name)) { continue; }
          remainingTests.push(test);
          includedTests[test.sourceFilename] = true;
        }
      }

      if (this.tests.default != null) {
        for (test of this.tests['default']) {
          if (!focusTest(test.sourceFilename, test.name)) { continue; }
          if (includedTests[test.sourceFilename]) { continue; }
          remainingTests.push(test);
        }
      }

      for (name in this.files) {
        file = this.files[name];
        if (file.isCode && (file.fileCategory === 'test')) {
          test = new testing.lib.CodeTest(file);
          if (!focusTest(file.filename(), null)) {
            test.filters = options.focusedFiles != null ? options.focusedFiles : null;
          }
          remainingTests.push(test);
        }
      }
    }

    // resolve dependent captures
    // if the focused tests rely on resuming state
    // from another test, then we need to pull them
    // into the list
    const captureNeeds = {};
    const captureHaves = {};
    for (t of remainingTests) {
      if (t.resumesNames != null) {
        for (n of t.resumesNames) {
          captureNeeds[n] = true;
        }
      }
      if (t.capturesNames != null) {
        for (n of t.capturesNames) {
          captureHaves[n] = true;
        }
      }
    }

    for (var need in captureNeeds) {
      if (!(need in captureHaves)) {
        (() => {
          if (this.testLanguage in this.tests) {
            for (test of this.tests[this.testLanguage]) {
              if ((test.capturesNames != null) && test.capturesNames.includes(need)) {
                captureHaves[need] = true;
                remainingTests.push(test);
                return;
              }
            }
          }

          for (test of this.tests['default']) {
            if ((test.capturesNames != null) && test.capturesNames.includes(need)) {
              captureHaves[need] = true;
              remainingTests.push(test);
              return;
            }
          }
        })();
      }
    }

    (() => {
      // order by capture dependency:
      // rebuild list by looping repeatedly through inserting,
      //  but only when capture dependency is already in list
      let t;
      const testCount = remainingTests.length;
      let presorted = remainingTests;
      remainingTests = [];
      const savedNames = [];
      for (let looping = 0, end = testCount, asc = 0 <= end; asc ? looping < end : looping > end; asc ? looping++ : looping--) {
        if (remainingTests.length === testCount) { break; }
        for (test of presorted) {
          let ready = true;
          if (test.resumesNames) {
            for (name of test.resumesNames) {
              if (!savedNames.includes(name)) { ready = false; }
            }
          }
          if (ready) {
            remainingTests.push(test);
            if (test.capturesNames) {
              for (n of test.capturesNames) { savedNames.push(n); }
            }
            test.capturesSorted = true;
          }
        }
        presorted = ((() => {
          const result = [];
           for (t of presorted) {             if (!t.capturesSorted) {
              result.push(t);
            }
          }
          return result;
        })());
      }

      if (remainingTests.length !== testCount) {
        const names = ((() => {
          const result1 = [];
           for (t of presorted) {             result1.push(t.name);
          }
          return result1;
        })());
        throw Error(`Couldn't find states to resume for ${testCount - remainingTests.length} tests: ${JSON.stringify(names)}`);
      }
    })();

    testContext.collectAllSays();

    // accumulate output
    let successes = 0;
    let fails = 0;
    const failedTests = [];
    const output = { log:[], cards:[], directives:[], raw:[] };

    if (!options.singleStep) {
      output.log.push(`Testing in region ${options.region}, language ${this.testLanguage} out of ${JSON.stringify(((() => {
        const result = [];
        for (k in this.languages) {
          result.push(k);
        }
        return result;
      })()))}`);
    }

    for (name in this.files) {
      file = this.files[name];
      if (file.exception != null) {
        output.log.push(`Error with file ${file.filename()}: ${file.exception}`);
      }
    }

    // step through each test asynchronously
    let testCounter = 1;
    const totalTests = remainingTests.length;
    let lastTimeStamp = new Date;
    const firstTimeStamp = new Date;
    var nextTest = () => {
      if (remainingTests.length === 0) {
        const totalTime = new Date - firstTimeStamp;
        options.reportProgress( `test steps complete ${testCounter-1}/${totalTests} ${totalTime}ms total` );
        if (fails) {
          output.summary = `✘ ${successes + fails} tests run, ${fails} failed (${totalTime}ms)\nFailed tests were:\n  ` + failedTests.join("\n  ");
        } else {
          output.summary = `✔ ${successes} tests run, all passed (${totalTime}ms)\n`;
        }
        if (!options.singleStep) {
          output.log.unshift(output.summary);
        }
        output.tallies = {
          successes,
          fails
        };
        output.success = fails === 0;
        cb(null, output, testContext);
        return;
      }

      testContext.db.reset();
      test = remainingTests.shift();

      options.reportProgress( `test step ${testCounter++}/${totalTests} +${new Date - lastTimeStamp}ms: ${test.name != null ? test.name : (test.file != null ? test.file.filename() : undefined)}` );
      lastTimeStamp = new Date;

      return test.test(testContext, output, (err, successCount, failCount, failedTestName) => {
        successes += successCount;
        fails += failCount;
        if (failedTestName) {
          failedTests.push(failedTestName);
        }
        if ((remainingTests.length > 0) && ((successCount + failCount) > 0)) {
         output.log.push("\n");
       }
        return nextTest();
      });
    };

    return nextTest();
  }

  resumeSingleTest(testContext, test, cb) {
    const output = { log:[], cards:[], directives:[], raw:[] };

    try {
      return test.test(testContext, output, (err, successCount, failCount) => {
        return cb(null, output);
      });
    } catch (error) {
      const err = error;
      return cb(err, output);
    }
  }

  reportIntents(language) {
    this.refreshAllFiles();
    const result = {};
    for (let name in this.states) {
      const state = this.states[name];
      state.reportIntents(language, result);
    }
    return (() => {
      const result1 = [];
       for (let k in result) {
        result1.push(k);
      }
      return result1;
    })();
  }
};

export const reportError = function(e, src, filename) {
  let i;
  if (e.location != null) {
    const loc = e.location;
    console.log(`ERROR: ${filename}(${(loc.start != null ? loc.start.line : undefined)}:${(loc.start != null ? loc.start.column : undefined)}) `);
    console.log(e.message);
    return (() => {
      const result = [];
      const iterable = src.split('\n');
      for (let lineno = 0; lineno < iterable.length; lineno++) {
        const line = iterable[lineno];
        if (Math.abs( lineno - loc.start.line ) < 2) {
          console.log(`${lineno+1} > ${line}`);
        }
        if (lineno === (loc.start.line - 1)) {
          var pad = 3 + `${lineno+1}`.length;
          pad = ((() => {
            let asc, end;
            const result1 = [];
            for (i = 0, end = pad, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
              result1.push(' ');
            }
            return result1;
          })()).join('');
          let ind = pad + ((() => {
            let asc1, end1;
            const result2 = [];
            for (i = 1, end1 = loc.start.column, asc1 = 1 <= end1; asc1 ? i < end1 : i > end1; asc1 ? i++ : i--) {
              result2.push(' ');
            }
            return result2;
          })()).join('');
          ind += ((() => {
            let asc2, end2;
            const result3 = [];
            for (i = loc.start.column, end2 = loc.end.column, asc2 = loc.start.column <= end2; asc2 ? i <= end2 : i >= end2; asc2 ? i++ : i--) {
              result3.push('^');
            }
            return result3;
          })()).join('');
          result.push(console.log(ind));
        } else {
          result.push(undefined);
        }
      }
      return result;
    })();
  } else {
    console.error("parse error with no location");
    return console.error(e);
  }
};

export function parse(text, filename, language, reportErrors) {
  try {
    const skill = new Skill;
    const dot = filename.lastIndexOf('.');
    skill.name = filename.substr(0, dot);
    skill.setFile(filename, language, text);
    return skill;
  } catch (e) {
    if (reportErrors) {
      reportError(e, text, filename);
    }
    throw e;
  }
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}

export default {
  Skill,
  reportError,
  parse
};
