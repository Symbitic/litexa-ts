/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const { ParserError } = require('./errors');

const sayCounter = require('./sayCounter');

const literalRegex = line => line
  .replace(/\./g, '\\.')
  .replace(/\//g, '\\/')
  .replace(/\\/g, '\\')
  .replace(/\-/g, '\\-');

class SoundEffect {
  constructor(location, assetName) {
    this.location = location;
    this.alternates = [assetName];
    this.isSoundEffect = true;
  }

  pushAlternate(assetName) {
    if (!assetName.isAssetName) {
      const name = (assetName.constructor && assetName.constructor.name) || undefined;
      throw new ParserError(assetName.location, `Alternate type mismatch, expecting an audio asset here, saw a ${name} instead`);
    }
    return this.alternates.push(assetName);
  }

  toLambda(output, indent, options) {
    let line;
    if (this.alternates.length > 1) {
      const sayKey = sayCounter.get();
      output.push(`${indent}switch(pickSayString(context, ${sayKey}, ${this.alternates.length})) {`);
      for (let idx = 0; idx < this.alternates.length; idx++) {
        const alt = this.alternates[idx];
        if (idx === (this.alternates.length - 1)) {
          output.push(`${indent}  default:`);
        } else {
          output.push(`${indent}  case ${idx}:`);
        }
        line = alt.toSSMLFunction(options.language);
        if (line && (line !== '""')) {
          output.push(`${indent}    context.say.push( ${line} );`);
        }
        output.push(`${indent}    break;`);
      }
      return output.push(`${indent}}`);
    } else {
      line = this.alternates[0].toSSMLFunction(options.language);
      return output.push(`${indent}context.say.push( ${line} );`);
    }
  }

  toSSML(language) {
    return this.alternates[0].toSSML(language);
  }

  matchFragment(language, line, asTestLine) {
    for (let name of this.alternates) {
      let regex, regexText;
      if (asTestLine) {
        if (name.testRegex == null) {
          regexText = `((<${literalRegex(name.toString())}>)|(<audio src='.*${literalRegex(name.toString())}'/>))`;
          name.testRegex = new RegExp(regexText, '');
        }
        regex = name.testRegex;
      } else {
        if (name.regex == null) {
          regexText = `(${literalRegex(name.toSSML(language))})`;
          name.regex = new RegExp(regexText, '');
        }
        ({ regex } = name);
      }

      const match = regex.exec(line);
      if (match == null) {
        continue;
      }
      if (!(match[0].length > 0)) {
        continue;
      }

      return {
        offset: match.index,
        reduced: line.replace(regex, ''),
        part: this,
        removed: match[0],
        slots: {},
        dbs: {}
      };
    }
  }
};

class PlayMusic {
  constructor(location, assetName) {
    this.location = location;
    this.assetName = assetName;
    this.toString = `playMusic ${this.assetName}`;
  }

  toLambda(output, indent, options) {
    if (this.assetName.localFile) {
      return output.push(`${indent}context.musicCommand = { action: 'play', url: ${this.assetName.toURLFunction(options.language)} }`);
    } else {
      return output.push(`${indent}context.musicCommand = { action: 'play', url: '${this.assetName}' }`);
    }
  }

  collectRequiredAPIs(apis) {
    return apis['AUDIO_PLAYER'] = true;
  }
};

class StopMusic {
  constructor(location) {
    this.location = location;
    this.toString = 'stopMusic';
  }

  toLambda(output, indent, options) {
    return output.push(`${indent}context.musicCommand = { action: 'stop' }`);
  }

  collectRequiredAPIs(apis) {
    return apis['AUDIO_PLAYER'] = true;
  }
};

const lib = {
  SoundEffect,
  PlayMusic,
  StopMusic,
};

module.exports = {
  lib,
  ...lib
};
