/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import extensions from './fileExtensions';
import searchReplace from './generators/searchReplace';

function create(name, language) {
  name = name.replace(/[_\.\-]/gi, ' ')
    .replace(/\s+/gi, ' ')
    .split(' ')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
  const invocation = name.toLowerCase().replace(/[^a-z0-9']/gi, ' ');

  const extension = extensions[language];
  const lang = language === 'typescript' ? `${language}/config` : language;
  const source = join(__dirname, '..', '..', 'templates', 'common', lang, `skill.${extension}`);
  const data = readFileSync(source, 'utf8');

  return searchReplace(data, {
    name,
    invocation
  });
}

export default {
  create
};
