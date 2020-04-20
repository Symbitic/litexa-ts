/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const { Skill } = require('../parser/skill');
const fs = require('fs');
const path = require('path');
const config = require('./project-config');
const parserlib = require('../parser/parserlib');
const ProjectInfo = require('./project-info');

async function build(root, variant) {
  parserlib.__resetLib();

  const jsonConfig = await config.loadConfig(root);
  const projectInfo = new ProjectInfo({jsonConfig, variant});

  const skill = new Skill(projectInfo);
  skill.strictMode = true;

  for (let language in projectInfo.languages) {
    const languageInfo = projectInfo.languages[language];
    const codeInfo = languageInfo.code;
    for (let file of codeInfo.files) {
      const filename = path.join(codeInfo.root, file);
      const data = fs.readFileSync(filename, 'utf8');
      skill.setFile(file, language, data);
    }
  }

  return skill;
};

module.exports = {
  build
};
