/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

// a project collects more than one file that contributes to
// the same skill.

// Expected file types:
//  * .litexa is the state machine language
//  * .js / .coffee are code library files
//  * .csv are data files?

const coffee = require('coffeescript');

const fileCategories = [
  {
    name: 'build',
    regex: /([\w\.\-_\s]+\.build)\.([^\.]+)$/
  },
  {
    name: 'test',
    regex: /([\w\.\-_\s]+\.test)\.([^\.]+)$/
  },
  {
    name: 'regular',
    regex: /([\w\.\-_\s]+)\.([^\.]+)$/
  }
];

function infoFromFilename(filename) {
  const test = function(type, regex) {
    const match = regex.exec(filename);
    if (match) {
      return  {
        category: type,
        name: match[1],
        extension: match[2]
      };
    }
  };
  for (let info of fileCategories) {
    const res = test(info.name, info.regex);
    if (res) {
      return res;
    }
  }
  return null;
};

class File {
  constructor(name, language, extension, content, fileCategory) {
    this.name = name;
    this.extension = extension;
    this.fileCategory = fileCategory;
    this.raw = {};
    this.content = {};
    this.isFile = true;
    this.replaceContent(language, content);
  }
  replaceContent(language, content) {
    if (!content) {
      console.log(language, content);
      throw new Error("probably missing language at file replace content");
    }
    this.raw[language] = content;
    this.content[language] = content;
    this.dirty = true;
  }

  filename() {
    return `${this.name}.${this.extension}`;
  }

  contentForLanguage(language) {
    let defaultVal;
    if (language in this.content) {
      return this.content[language];
    }
    for (let k in this.content) {
      defaultVal = this.content[k];
    }
    return this.content.default ? this.content.default : defaultVal;
  }

  rawForLanguage(language) {
    if (language in this.raw) {
      return this.raw[language];
    }
    return this.raw.default;
  }
};

class JavaScriptFile extends File {
  constructor(name, language, extension, content, fileCategory) {
    super(name, language, extension, content, fileCategory);
    this.isCode = true;
  }
};

class LiterateAlexaFile extends File {
  replaceContent(language, content) {
    // normalize line endings: CRLF to just LF
    content = content.replace(/\r\n/g, '\n');

    // normalize line endings: just CR to just LF
    content = content.replace(/\r/g, '\n');

    // add end of file signal for parser
    content += '\u001A';

    return super.replaceContent(language, content);
  }
};

class CoffeeScriptFile extends File {
  constructor(name, language, extension, source, fileCategory) {
    super(name, language, extension, "", fileCategory);
    this.content = {};
    this.isCode = true;
    this.replaceContent('default', source);
  }

  replaceContent(language, source) {
    this.dirty = true;
    this.content[language] = '';
    this.raw[language] = source;
    this.exception = null;
    try {
      return this.content[language] = coffee.compile(source, {
        bare: true,
        filename: this.name + '.coffee',
        sourceMap: true,
        inlineMap: true
      });
    } catch (err) {
      this.content[language] = '';
      return this.exception = err;
    }
  }
};

class JSONDataFile extends File {
  constructor(name, language, extension, source, fileCategory) {
    super(name, language, extension, "", fileCategory);
    this.replaceContent('default', source);
  }

  replaceContent(language, source) {
    this.dirty = true;
    this.raw[language] = source;
    this.content[language] = {};
    this.exception = null;
    try {
      return this.content[language] = JSON.parse(source);
    } catch (e) {
      this.content[language] = {};
      return this.exception = e;
    }
  }
};

module.exports = {
  infoFromFilename,
  File,
  JavaScriptFile,
  LiterateAlexaFile,
  CoffeeScriptFile,
  JSONDataFile
};
