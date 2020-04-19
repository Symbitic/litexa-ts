/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
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

/*

  This file collects documentation sources from around the
  module and creates two outputs:
    * documentation.html at the module root
      this contains all the documentation in a single file

    * additional .md files in the documentation directory
      this contains materials scraped from other sources

  The goal is to have documentation visible in source control
  places that handle .md files elegantly, and to have an easy
  to search local reference once you've pulled the repo.

*/


const path = require('path');
const fs = require('fs');
const chalk = require('chalk');


const render = function() {

  const moduleRoot = path.join(__dirname, '..', '..');

  const makeLinkName = s => // convert human readable names into valid url links
  s.replace(/\s+/g, '_');

  const isCodeLink = function(name) {
    if (name[0].toLowerCase() !== name[0]) { return false; }
    return true;
  };

  // customize marked to collect heading info
  const markedLib = require('marked');
  const headings = [];
  let marked = null;
  (function() {
    const renderer = new markedLib.Renderer();

    renderer.heading = function(text, level) {
      const link = makeLinkName(text);
      headings.push({
        level,
        text,
        link
      });
      return `<h${level} id='${link}'>${text}</h${level}>`;
    };

    return marked = text => markedLib(text, { renderer });
  })();


  let entries = {};
  let entryNames = [];

  (function() {
    const pegFilename = path.join(moduleRoot, 'parser', 'litexa.pegjs');
    const pegSource = fs.readFileSync(pegFilename, 'utf8');

    const test = /\/\*\s*litexa\s+\[([^\]]+)\]\s+([^*]*\*+(?:[^/*][^*]*\*+)*)\//g;
    let match = test.exec(pegSource);
    return (() => {
      const result = [];
      while (match) {
        const name = match[1];
        const comment = match[2].slice(0, -1);
        if (name in entries) {
          throw `You have duplicate entry names: ${name}`;
        }
        entries[name] = {
          text: comment,
          name
        };
        result.push(match = test.exec(pegSource));
      }
      return result;
    })();
  })();

  let html = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');


  (function() {
    const pages = [];

    let source = fs.readFileSync(path.join(moduleRoot, '..', 'README.md'), 'utf8');
    pages.push(marked(source));

    const docsRoot = path.join(moduleRoot, 'documentation');
    for (let file of Array.from(fs.readdirSync(docsRoot))) {
      if (file === 'reference.md') { continue; }
      const filename = path.join(docsRoot, file);
      if (fs.statSync(filename).isDirectory()) { continue; }
      source = fs.readFileSync(filename, 'utf8');
      pages.push(marked(source));
    }

    return html = html.replace('{pages}', pages.join('\n'));
  })();


  (function() {
    let n, e;
    let entryHTML = "";
    entryNames = ((() => {
      const result = [];
       for (n in entries) {
        result.push(n);
      } 
      return result;
    })());
    entries = ((() => {
      const result1 = [];
       for (n in entries) {
        e = entries[n];
        result1.push(e);
      } 
      return result1;
    })());
    entries.sort((a, b) => a.name.localeCompare(b.name));

    const substituteLinks = function(text) {
      const test = /\[([a-zA-Z$@ ]+)\]/;
      let match = test.exec(text);
      while (match) {
        const name = match[1];
        if (!Array.from(entryNames).includes(name)) {
          console.error(chalk.red(`missing link [${name}] in \`${text.slice(0, 25)}\``));
        }
        let link = `<a href='#${makeLinkName(name)}'>${name}</a>`;
        if (isCodeLink(name)) {
          link = `<code>${link}</code>`;
        }
        text = text.replace(match[0], link);
        match = test.exec(text);
      }
      return text;
    };

    headings.push({
      level: 1,
      text: "Language Reference",
      link: "Language_Reference",
      class: "toc-language-reference"
    });

    for (e of Array.from(entries)) {
      const linkName = makeLinkName(e.name);

      headings.push({
        level: 2,
        text: e.name,
        link: linkName
      });

      let contents = e.text;
      contents = marked(contents);
      contents = substituteLinks(contents);

      let namePart = e.name;
      if (isCodeLink(e.name)) {
        namePart = `<code>${namePart}</code>`;
      }

      entryHTML += `\
<tr class='entry'> \
<td id='${linkName}' \
class='entry-cell entry-name'>${namePart}</td> \
<td class='entry-cell entry-text'>${contents}</td> \
</tr>\
`;
    }

    return html = html.replace('{entries}', entryHTML);
  })();

  (function() {
    const tocHTML = [];
    const links = {};
    let level = 1;
    for (let h of Array.from(headings)) {

      var terminator;
      let opening = false;
      if (h.level > level) {
        tocHTML.push("<ul>");
        opening = true;
      } else if (h.level < level) {
        tocHTML.push("</ul></li>");
      }
      ({
        level
      } = h);

      if (h.link in links) {
        console.error(chalk.red(`DUPLICATE LINK detected: ${h.link}`));
      }
      links[h.link] = true;

      const link = `<a href='#${h.link}'>${h.text}</a>`;
      //if isCodeLink h.text
      //  link = "<code>#{link}</code>"

      if (opening) {
        terminator = '</li>';
      } else {
        terminator = '';
      }

      if (h.class != null) {
        tocHTML.push(`<li class='${h.class}'>${link}${terminator}`);
      } else {
        tocHTML.push(`<li>${link}${terminator}`);
      }
    }

    while (level > 1) {
      tocHTML.push("</ul></li>");
      level -= 1;
    }

    return html = html.replace('{toc}', tocHTML.join('\n'));
  })();


  (function() {
    const markdownEntries = [
      "# Language Reference\n",
    ];

    const substituteLinks = function(text) {
      const test = /\[([^\]]+)\]/;
      let match = test.exec(text);
      while (match) {
        const name = match[1];
        text = text.replace(match[0], match[1]);
        match = test.exec(text);
      }
      return text;
    };


    for (let e of Array.from(entries)) {
      const contents = e.text;
     //(don't need to do this now) contents = substituteLinks contents

      markdownEntries.push(`\
## ${e.name}

${contents}\
`
      );
    }

    const outputFilename = path.join(moduleRoot, 'documentation', 'reference.md');
    return fs.writeFileSync(outputFilename, markdownEntries.join('\n'), 'utf8');
  })();

  console.log('');
  return console.log(chalk.green((new Date).toLocaleString()));
};

render();

if (process.argv[2] === 'watch') {
  const docsDir = path.join(__dirname, '../');
  const fileCache = {};

  // Takes a string and generates a 32-bit integer
  const hash = function(contents) {
    let hashedInt = 0;
    if (contents.length === 0) { return hashedInt; }
    for (let i = 0, end = contents.length - 1, asc = 0 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) {
      const char = contents.charCodeAt(i);
      hashedInt = ((hashedInt << 5) - hashedInt) + char;
      hashedInt = hashedInt || 0;
    }
    return hashedInt;
  };

  // Watches for changes
  fs.watch(docsDir, function(event, file) {
    const filePath = path.join(docsDir, file);
    const fileExists = fs.existsSync(filePath);

    // Ignores extraneous temp data
    if (fileExists) {
      const format = 'utf8';

      // hash the file
      const data = hash(fs.readFileSync(filePath, format));

      // Caches the fingerprint of the data
      if (fileCache[file] == null) { fileCache[file] = data; }

      // If the contents change, cache contents then re-render the documentation
      if (fileCache[file] !== data) {
        fileCache[file] = data;
        return render();
      }
    }
  });
}
