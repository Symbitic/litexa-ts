/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const fs = require('fs');
const path = require('path');
const extensions = require('./fileExtensions');
const searchReplace = require('./generators/searchReplace');

function create(name, language) {
  name = name.replace(/[_\.\-]/gi, ' ')
    .replace(/\s+/gi, ' ')
    .split(' ')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
  const invocation = name.toLowerCase().replace(/[^a-z0-9']/gi, ' ');

  const extension = extensions[language];
  const lang = language === 'typescript' ? `${language}/config` : language;
  const source = path.join(__dirname, '..', '..', 'templates', 'common', lang, `skill.${extension}`);
  const data = fs.readFileSync(source, 'utf8');

  return searchReplace(data, {
    name,
    invocation
  });
}

module.exports = {
  create
};
