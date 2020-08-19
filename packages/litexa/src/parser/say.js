/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const { parseFragment } = require('./parser');
const { ParserError } = require('./errors');
const {
  replaceNewlineCharacters,
  isEmptyContentString,
  isFirstOrLastItemOfArray,
  dedupeNonNewlineConsecutiveWhitespaces,
  cleanTrailingSpaces,
  cleanLeadingSpaces
} = require('./utils');
const sayCounter = require('./sayCounter');

class StringPart {
  constructor(text) {
    // Whitespace and line break rules:
    //   line breaks are converted to whitespaces
    //   empty (or whitespace-only) lines are considered a line break
    //   consecutive whitespaces are condensed to a single whitespace
    const splitLines = text.split('\n');
    const lines = splitLines.map((str, idx) => {
      if (isEmptyContentString(str) && !isFirstOrLastItemOfArray(idx, splitLines)) {
        return '\n';
      }
      if (!isFirstOrLastItemOfArray(idx, splitLines)) {
        return str.trim();
      }
      return dedupeNonNewlineConsecutiveWhitespaces(str);
    });

    this.tagClosePos = null;
    if (lines.length > 1) {
      this.tagClosePos = lines[0].length + 1;
      if (lines[0] === '\n') {
        this.tagClosePos += 1;
      }
    }
    this.text = lines.join(' ');
    const transformations = [
      cleanTrailingSpaces,
      cleanLeadingSpaces,
      dedupeNonNewlineConsecutiveWhitespaces
    ];
    transformations.forEach(transformation => {
      return this.text = transformation(this.text);
    });
  }

  toString() {
    return this.text;
  }
  toUtterance() {
    return this.text;
  }
  toLambda(options) {
    // escape quotes
    let str = this.text.replace(/"/g, '\"');
    // escape line breaks
    str = replaceNewlineCharacters(str, '\\n');
    return '"' + str + '"';
  }
  express(context) {
    return this.text;
  }
  toRegex() {
    let str = this.text;
    // escape regex control characters
    str = str.replace( /\?/g, '\\?' );
    str = str.replace( /\./g, '\\.' );
    // mirror the line break handling for the lambda
    str = replaceNewlineCharacters(str, '\\n');
    return `(${str})`;
  }
  toTestRegex() {
    return this.toRegex();
  }
  toTestScore() {
    return 10;
  }
  toLocalization() {
    return this.toString();
  }
};

class TagPart {
  constructor(skill, location, code, content, variable) {
    let needle;
    this.location = location;
    this.code = code;
    this.content = content;
    this.variable = variable;
    const validFontSizes = [2, 3, 5, 7];
    this.attributes = {};
    this.open = false;

    const openUnlessContent = () => {
      this.open = true;
      if (this.content && this.content.trim().length > 0) {
        return this.open = false;
      }
    };

    switch (this.code) {
      case '!':
        this.tag = 'say-as';
        this.attributes = { 'interpret-as': 'interjection' };
        break;
      case '...':
        this.tag = 'break';
        this.attributes = { time: this.variable };
        break;
      case 'sfx':
        this.tag = null;
        this.proxy = this.content;
        this.content = null;
        break;
      case 'fontsize':
        if (!validFontSizes.includes(parseInt(this.variable))) {
          throw new ParserError(this.location, `invalid font size ${this.variable}, expecting one of ${JSON.stringify(validFontSizes)}`);
        }
        this.tag = 'font';
        this.attributes = { size: this.variable };
        openUnlessContent();
        break;
      case 'center':
        this.tag = 'div';
        this.attributes = { align: 'center' };
        openUnlessContent();
        break;
      case 'i':
      case 'b':
      case 'u':
        this.tag = this.code;
        openUnlessContent();
        break;
      default:
        // look at extensions that might handle this
        const extensions = skill.getExtensions();
        let info = null;
        if (extensions) {
          for (let name in extensions) {
            const ext = extensions[name];
            info = ext && ext.language && ext.language.sayTags && ext.language.sayTags[this.code];
            if (info) {
              break;
            }
          }
        }
        if (!info) {
          throw new ParserError(this.location, `unknown tag <${this.code}>`);
        }
        if (typeof info.process === 'function') {
          info.process(this);
        }
    }
  }

  toString() {
    switch (this.code) {
      case '!':
        return `<${this.code}${this.content}>`;
      case '...':
        return `<${this.code}${this.variable}>`;
      case 'sfx':
        return `<${this.code} ${this.proxy}>`;
      default:
        return `<${this.code}>`;
    }
  }

  toUtterance() {
    throw new ParserError(null, "you cannot use a tag part in an utterance");
  }

  toSSML(language) {
    let k, v;
    if (!language) {
      language = "default";
    }
    if (this.tag) {
      let attributes = ((() => {
        const result = [];
         for (k in this.attributes) {
          v = this.attributes[k];
          result.push(`${k}='${v}'`);
        }
        return result;
      })());
      if (this.codeAttributes) {
        for (k in this.codeAttributes) {
          v = this.codeAttributes[k];
          attributes.push(`${k}='" + ${v} + "'`);
        }
      }
      attributes = attributes.join(' ');
      if (attributes.length > 0) {
        attributes = ' ' + attributes;
      }
      if (this.open) {
          return `<${this.tag}${attributes}>`;
      } else {
        if (this.content) {
          return `<${this.tag}${attributes}>${this.content}</${this.tag}>`;
        } else {
          return `<${this.tag}${attributes}/>`;
        }
      }
    } else if (this.proxy) {
      return this.proxy.toSSML(language);
    } else if (this.verbatim) {
      return this.verbatim;
    } else {
      return "";
    }
  }

  toLambda(options) {
    if (this.proxy) {
      return this.proxy.toSSMLFunction(options.language);
    }
    return '"' + this.toSSML(options.language) + '"';
  }

  express(context) {
    return this.toSSML(context.language);
  }

  toRegex() {
    let str = this.toSSML();
    // escape regex control characters
    str = str.replace( /\?/g, '\\?' );
    str = str.replace( /\./g, '\\.' );
    str = str.replace( /\//g, '\\/' );
    return `(${str})`;
  }

  toTestRegex() {
    switch (this.code) {
      case "!":
        return `(${this.toRegex()}|(<!${this.content}>))`;
      case "...":
        return `(${this.toRegex()}|(<...${this.attributes.time}>))`;
      case "sfx":
        const testSFXMatch = `${((this.proxy ? this.proxy.name : undefined) && (this.proxy ? this.proxy.type : undefined)) ? `|(<${this.proxy.name}.${this.proxy.type}>)|(<${this.proxy.name}>)` : ''}`;
        return `(${this.toRegex()}${testSFXMatch})`;
      default:
        return this.toRegex();
    }
  }

  toTestScore() {
    return 9;
  }

  toLocalization() {
    return this.toString();
  }
};

class DatabaseReferencePart {
  constructor(ref) {
    this.ref = ref;
    this.isDB = true;
    this.needsEscaping = true;
  }

  toString() {
    return `@${this.ref.toString()}`;
  }
  toUtterance() {
    throw new ParserError(null, "you cannot use a database reference in an utterance");
  }
  toLambda(options) {
    return `context.db.read('${this.ref.base}')${this.ref.toLambdaTail()}`;
  }
  express(context) {
    if (context.noDatabase) {
      return "STUB";
    }
    return "" + this.ref.readFrom(context.db);
  }
  toRegex() {
    return "([\\S\u00A0]+)";
  }
  toTestRegex() { return this.toRegex(); }
  toLocalization(localization) {
    return this.toString();
  }
};

class StaticVariableReferencePart {
  constructor(ref) {
    this.ref = ref;
    this.needsEscaping = true;
  }

  isStatic() {
    return true;
  }

  toString() {
    return `DEPLOY.${this.ref.toString()}`;
  }

  toUtterance() {
    throw new ParserError(null, "you cannot use a static reference in an utterance");
  }

  toLambda(options) {
    return `litexa.DEPLOY.${this.ref.toLambda()}`;
  }

  express(context) {
    return eval(`context.lambda.litexa.DEPLOY.${this.ref.toLambda()}`);
  }

  evaluateStatic(context) {
    return eval(`context.skill.projectInfo.DEPLOY.${this.ref.toLambda()}`);
  }

  toRegex() {
    throw "missing toRegex function for StaticVariableReferencePart";
  }

  toTestRegex() {
    return this.toRegex();
  }

  toLocalization(localization) {
    return this.toString();
  }
}

class DatabaseReferenceCallPart {
  constructor(ref, args) {
    this.ref = ref;
    this.args = args;
    this.isDB = true;
    this.needsEscaping = true;
  }
  toString() {
    const args = this.args.map((a) => a.toString()).join(', ');
    return `@${this.ref.toString()}(${args})`;
  }
  toUtterance() {
    throw new ParserError(null, "you cannot use a database reference in an utterance");
  }
  toLambda(options) {
    const args = this.args.map((a) => a.toLambda(options)).join(', ');
    return `(await context.db.read('${this.ref.base}')${this.ref.toLambdaTail()}(${args}))`;
  }
  express(context) {
    if (context.noDatabase) { return "STUB"; }
    return "" + this.ref.readFrom(context.db);
  }
  toRegex() {
    return "([\\S\u00A0]+)";
  }
  toTestRegex() {
    return this.toRegex();
  }
  toLocalization(localization) {
    return this.toString();
  }
}

class SlotReferencePart {
  constructor(name) {
    this.name = name;
    this.isSlot = true;
    this.needsEscaping = true;
  }
  toString() {
    return `$${this.name}`;
  }
  toUtterance() {
    return `{${this.name}}`;
  }
  toLambda(options) {
    return `context.slots.${this.name.toLambda(options)}`;
  }
  express(context) {
    if (this.fixedValue) {
      return `$${this.name}`;
    }
    return "" + context.slots[this.name];
  }
  toRegex() {
    return "([\\$\\S\u00A0]+)";
  }
  toTestRegex() {
    return this.toRegex();
  }
  toTestScore() {
    return 1;
  }
  toLocalization(localization) {
    return this.toString();
  }
}

class JavaScriptPart {
  constructor(expression) {
    this.expression = expression;
    this.isJavaScript = true;
    this.needsEscaping = true;
  }
  toString() {
    return `{${this.expression.toString()}}`;
  }
  toUtterance() {
    throw new ParserError(null, "you cannot use a JavaScript reference in an utterance");
  }
  toLambda(options) {
    return `(${this.expression.toLambda(options)})`;
  }
  express(context) {
    this.expression.toString();
    // func = (p.express(context) for p in @expression.parts).join(' ')
    try {
      return context.lambda.executeInContext(func);
    } catch (e) {}
  }
  //console.error "failed to execute `#{func}` in context: #{e}"
  toRegex() {
    // assuming this can only match a single substitution
    return "([\\S\u00A0]+)";
  }
  toTestRegex() {
    return this.toRegex();
  }
  toLocalization(localization) {
    return this.toString();
  }
}

class JavaScriptFragmentPart {
  constructor(func) {
    this.func = func;
  }
  toString() {
    return `{ ${this.func}}`;
  }
  toUtterance() {
    throw new ParserError(null, "you cannot use a JavaScript reference in an utterance");
  }
  toLambda(options) {
    return `${this.func}`;
  }
  express(context) {
    return this.func;
  }
  toRegex() {
    throw new Error("JavaScriptFragmentPart can't be matched in a regex");
  }
  toTestRegex() {
    return this.toRegex();
  }
};

class AssetNamePart {
  constructor(assetName) {
    this.assetName = assetName;
    this.isAssetNamePart = true;
  }
  toString() {
    return `<${this.assetName}>`;
  }
  toUtterance() {
    throw new ParserError(this.assetName.location, "can't use an asset name part in an utterance");
  }
  toLambda(options) {
    return this.assetName.toSSML(options.language);
  }
  express(context) {
    return this.toString();
  }
  toRegex() {
    return `(${this.toSSML()})`;
  }
  toTestRegex() {
    return this.toRegex();
  }
  toTestScore() {
    return 10;
  }
}

function partsToExpression(parts, options) {
  let closed;
  if (!((parts ? parts.length : undefined) > 0)) {
    return "''";
  }

  let result = [];
  let tagContext = [];
  const closeTags = () => {
    if (tagContext.length === 0) {
      return '';
    }
    closed = [];
    for (let i = tagContext.length - 1; i >= 0; i--) {
      const tag = tagContext[i];
      closed.push(`</${tag}>`);
    }
    tagContext = [];
    return '"' + closed.join('') + '"';
  };

  result = (() => {
    const result1 = [];
    for (let p of parts) {
      if (p.open) {
        tagContext.push(p.tag);
      }

      let code = p.toLambda(options);

      if (p.tagClosePos) {
        closed = closeTags();
        if (closed) {
          const before = code.slice(0, p.tagClosePos) + '"';
          const after = '"' + code.slice(p.tagClosePos);
          code =  [before, closed, after].join('+');
        }
      }

      if (p.needsEscaping) {
        result1.push(`escapeSpeech( ${code} )`);
      } else {
        result1.push(code);
      }
    }
    return result1;
  })();

  closed = closeTags();
  if (closed) {
    result.push(closed);
  }
  return result.join(' + ');
};

class Say {
  constructor(parts, skill) {
    this.isSay = true;
    this.alternates = {
      default: [ parts ]
    };
    this.checkForTranslations(skill);
  }

  checkForTranslations(skill) {
    // Check if the localization map exists and has an entry for this string.
    const localizationEntry = skill
      && skill.projectInfo
      && skill.projectInfo.localization
      && skill.projectInfo.localization.speech
      && skill.projectInfo.localization.speech[this.toString()];

    if (localizationEntry) {
      return (() => {
        const result = [];
        for (var language in localizationEntry) {
        // ignore the translation if it's empty
          const translation = localizationEntry[language];
          if (!translation) { continue; }
          // ignore the translation if it isn't for one of the skill languages (could just be comments)
          if (!Object.keys(skill.languages).includes(language)) { continue; }

          var alternates = translation.split('|'); // alternates delineation character is '|'

          result.push((() => {
            const result1 = [];
            for (let i = 0, end = alternates.length - 1, asc = 0 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) {
            // parse the translation to identify the string parts
              const fragment = `say "${alternates[i]}" `;

              let parsedTranslation = null;
              try {
                parsedTranslation = parseFragment(fragment, language);
              } catch (err) {
                throw new Error(`Failed to parse the following fragment translated for ${language}:\n${fragment}\n${err}`);
              }

              if (i === 0) {
                // first (and potentially only) alternate
                result1.push(this.alternates[language] = parsedTranslation.alternates.default);
              } else {
                // split by '|' returned more than one string -> this is an 'or' alternate
                result1.push(this.alternates[language].push(parsedTranslation.alternates.default[0]));
              }
            }
            return result1;
          })());
        }
        return result;
      })();
    }
  }

  pushAlternate(parts, skill, language) {
    if (!language) {
      language = 'default';
    }
    this.alternates[language].push(parts);
    // re-check localization since alternates are combined into single key as follows:
    //   "speech|alternate one|alternate two"
    return this.checkForTranslations(skill);
  }

  toString(language) {
    if (!language) {
      language = 'default';
    }
    switch (this.alternates[language].length) {
      case 0:
        return '';
      case 1:
        return this.alternates[language][0].map((p) => p.toString()).join('');
      default:
        return this.alternates[language].map((a) => a.join('').toString()).join('|');
    }
  }

  toExpression(options, language) {
    if (!language) {
      language = 'default';
    }
    return partsToExpression(this.alternates[language][0], options);
  }

  toLambda(output, indent, options) {
    let speechTargets = [ 'say' ];
    if (this.isReprompt) {
      speechTargets = [ 'reprompt' ];
    } else if (this.isAlsoReprompt) {
      speechTargets = speechTargets.concat('reprompt');
    }

    const writeAlternates = (indent, alternates) => {
      if (alternates.length > 1) {
        const sayKey = sayCounter.get();
        output.push(`${indent}switch(pickSayString(context, ${sayKey}, ${alternates.length})) {`);
        for (let idx = 0; idx < alternates.length; idx++) {
          const alt = alternates[idx];
          if (idx === (alternates.length - 1)) {
            output.push(`${indent}  default:`);
          } else {
            output.push(`${indent}  case ${idx}:`);
          }
          writeLine(indent + "    ", alt);
          output.push(`${indent}    break;`);
        }
        return output.push(`${indent}}`);
      } else {
        return writeLine(indent, alternates[0]);
      }
    };

    const writeLine = (indent, parts) => {
      const line = partsToExpression(parts, options);
      for (let target of speechTargets) {
        if (line && (line !== '""')) {
          output.push(`${indent}context.${target}.push( ${line} );`);
        }
      }
    };

    // Add language-specific output speech to the Lambda, if translations exist.
    const alternates = this.alternates[options.language] ? this.alternates[options.language] : this.alternates.default;
    return writeAlternates(indent, alternates);
  }

  express(context) {
    // given the info in the context, fully resolve the parts
    let p;
    if (this.alternates[context.language]) {
      return ((() => {
        const result = [];
        for (p of this.alternates[context.language][0]) {
          result.push(p.express(context));
        }
        return result;
      })()).join("");
    } else {
      return ((() => {
        const result1 = [];
        for (p of this.alternates.default[0]) {
          result1.push(p.express(context));
        }
        return result1;
      })()).join("");
    }
  }

  matchFragment(language, line, testLine) {
    for (let parts of this.alternates.default) {
      if (!parts.regex) {
        const regexText = parts.map((p) => p.toTestRegex()).join('');
        // prefixed with any number of spaces to eat formatting
        // adjustments with fragments are combined in the skill
        parts.regex = new RegExp("\\s*" + regexText, '');
      }

      const match = parts.regex.exec(line);
      if (!match) {
        continue;
      }
      if (!(match[0].length > 0)) { continue; }

      const result = {
        offset: match.index,
        reduced: line.replace(parts.regex, ''),
        part: this,
        removed: match[0],
        slots: {},
        dbs: {}
      };

      const iterable = match.slice(1);
      for (let idx = 0; idx < iterable.length; idx++) {
        const read = iterable[idx];
        const part = parts[idx];
        if (part ? part.isSlot : undefined) {
          result.slots[part.name] = read;
        }
        if (part ? part.isDB : undefined) {
          result.dbs[part.name] = read;
        }
      }
      return result;
    }
  }

  toLocalization(localization) {
    const collectParts = parts => {
      const locParts = [];
      for (let p of parts) {
        if (p.toLocalization) {
          const fragment = p.toLocalization(localization);
          if (fragment) {
            locParts.push(fragment);
          }
        }
      }
      return locParts.join('');
    };

    switch (this.alternates.default.length) {
      case 0:
        return;
      case 1:
        const speech = collectParts(this.alternates.default[0]);
        if (!localization.speech[speech]) {
          return localization.speech[speech] = {};
        }
        break;
      default:
        const speeches = this.alternates.default.map((a) => collectParts(a)).join('|');
        if (!localization.speech[speeches]) {
          return localization.speech[speeches] = {};
        }
    }
  }
}

const lib = {
  StringPart,
  TagPart,
  DatabaseReferencePart,
  StaticVariableReferencePart,
  DatabaseReferenceCallPart,
  SlotReferencePart,
  JavaScriptPart,
  JavaScriptFragmentPart,
  AssetNamePart,
  Say
};

module.exports = {
  lib,
  ...lib
};
