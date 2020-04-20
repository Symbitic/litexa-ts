/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

let cached, e, hash, parser, source, sourceHash, sourcePEG;
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const peg = require('pegjs');
const crypto = require('crypto');
const debug = require('debug')('litexa');

const sourceFilename = `${__dirname}/litexa.pegjs`;
const cacheFilename = `${__dirname}/litexa.pegjs.cached`;
let parserSourceCode = null;

try {
  hash = crypto.createHash('md5');
  sourcePEG = fs.readFileSync(sourceFilename, 'utf8');
  hash.update(sourcePEG);
  sourceHash = hash.digest('hex');

  cached = JSON.parse(fs.readFileSync(cacheFilename, 'utf8'));
  if (cached.hash === sourceHash) {
    parserSourceCode = cached.source;
    debug("cached parser loaded");
  } else {
    debug(`cached parser was state ${sourceHash} != ${cached.hash}`);
  }
} catch (error) {
  e = error;
  debug("no cached parser found");
  debug(e);
}

if (!parserSourceCode) {
  source = fs.readFileSync(sourceFilename, 'utf8');
  parserSourceCode = peg.generate(source, { cache: true, output: 'source', format: 'bare', allowedStartRules:['start', 'TestStatements'] });
  cached = {
    hash: sourceHash,
    source: parserSourceCode
  };
  fs.writeFileSync(cacheFilename, JSON.stringify(cached, null, 2), 'utf8');
}

try {
  parser = eval(parserSourceCode);
} catch (error1) {
  e = error1;
  debug("failed to eval parser");
  throw e;
}

module.exports.parser = parser;
module.exports.sourceCode = parserSourceCode;

module.exports.buildExtendedParser = function(projectInfo) {
  let extParser, extParserSource, projectCodeCacheFilename, projectSourceCacheFilename;
  let enableParserCache = false;

  if (projectInfo.isMock) {
    enableParserCache = false;
  }

  // try to load the cache
  if (enableParserCache) {
    const tempdir = path.join(projectInfo.root, '.deploy');
    mkdirp.sync(tempdir);
    projectSourceCacheFilename = path.join(tempdir, 'extended-litexa.pegjs');
    projectCodeCacheFilename = path.join(tempdir, 'extended-litexa.pegjs.cached');
    try {
      extParserSource = fs.readFileSync(projectCodeCacheFilename, 'utf8');
      extParser = eval(extParserSource);
      return extParser;
    } catch (error2) {}
  }

  // interpolate in any extensions
  let extSourcePEG = "" + sourcePEG;
  const statementNames = [];
  const testStatementNames = [];
  const intentStatementNames = [];

  for (let extensionName in projectInfo.extensions) {
    var statement, statementName;
    const extension = projectInfo.extensions[extensionName];
    if (extension.language == null) { continue; }

    for (statementName in extension.language.statements) {
      statement = extension.language.statements[statementName];
      statementNames.push(statementName);
      if (statement.parser == null) {
        throw new Error(`Statement ${statementName} in extension \
${extensionName} is missing parser code`
        );
      }
      extSourcePEG += `\n${statement.parser}\n`;
    }

    for (statementName in extension.language.testStatements) {
      statement = extension.language.testStatements[statementName];
      testStatementNames.push(statementName);
      if (statement.parser == null) {
        throw new Error(`Test statement ${statementName} in extension ${extensionName} is missing parser code`);
      }
      extSourcePEG += `\n${statement.parser}\n`;
    }
  }

  const replacePlaceholder = function(placeholder, nameList) {
    const block = Array.from(nameList).map((s) =>
      "  / " + s);
    return extSourcePEG = extSourcePEG.replace(placeholder, block.join('\n'));
  };

  replacePlaceholder("  /* ADDITIONAL STATEMENTS */", statementNames);
  replacePlaceholder("  /* ADDITIONAL TEST STATEMENTS */", testStatementNames);
  replacePlaceholder("  /* ADDITIONAL INTENT STATEMENTS */", intentStatementNames);

  // save the combined parser input for later
  if (enableParserCache) {
    fs.writeFileSync(projectSourceCacheFilename, extSourcePEG, 'utf8');
  }

  extParserSource = peg.generate(extSourcePEG, { cache: true, output: 'source', format: 'bare', allowedStartRules:['start', 'TestStatements', 'AllFileExclusions'] });

  try {
    extParser = eval(extParserSource);
  } catch (err) {
    debug("failed to eval extended parser");
    throw e;
  }

  // success! Recycle the generated parser for later
  if (enableParserCache) {
    fs.writeFileSync(projectCodeCacheFilename, extParserSource, 'utf8');
  }
  return extParser;
};


let fragmentParser = null;
module.exports.parseFragment = function(fragment, language) {
  if (fragmentParser == null) {
    source = fs.readFileSync(sourceFilename, 'utf8');
    const fragmentParserSource = peg.generate(source, {
      cache: true,
      output: 'source',
      format: 'bare',
      allowedStartRules:['Fragment']
    });
    fragmentParser = eval(fragmentParserSource);
  }

  let result = null;

  const skill = {
    pushCode(thing) { return result = thing; },
    getExtensions() { return {}; }
  };

  fragmentParser.parse(fragment, {
    skill,
    lib: require('./parserlib'),
    language: language != null ? language : 'default'
  }
  );

  return result;
};
