/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/*
 * The project config file is a file at the root of a litexa project
 * in the form litexa.config.[json/js/ts/coffee] that when required
 * specifies the litexa options for a project rooted in the
 * same directory.
 *
 * loadConfig will load that config file, given a project path
 *
 * Note: the project name is assumed to be the same as the
 * directory name, unless explicitly specified in the config file.
 */
import fs from 'fs';
import path from 'path';
import debug from 'debug';
import ts from 'typescript';
import { promisify } from 'util';
import extensions from './fileExtensions';
import searchReplace from './generators/searchReplace';
import projectNameValidate from './generators/validators/projectNameValidator';

const litexaDebug = debug('litexa');

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

export function writeDefault(location: string, language: string, name: string) {
  litexaDebug(`name is: ${name}`);

  const extension = extensions[language];
  const filename = `litexa.config.${extension}`;

  const writeFile = (file: string) => {
    const source = path.resolve(__dirname, '..', '..', 'templates', 'common', language, file);

    let data = fs.readFileSync(source, 'utf8');
    data = searchReplace(data, { name });

    file = path.join(location, file);
    return fs.writeFileSync(file, data, 'utf8');
  };

  if (language === 'typescript') {
    language = `${language}/config`;
    writeFile('globals.d.ts');
    writeFile('tsconfig.json');
    writeFile('tslint.json');
    writeFile('package.json');
  }

  writeFile(filename);
  return filename;
};

export async function identifyConfigFileFromPath(location: string) {
  // searches the given location and its ancestors for the first viable Litexa config file
  litexaDebug(`beginning search for a Litexa config file at ${location}`);

  const isCorrectFilename = fullpath => {
    const base = path.basename(fullpath);
    return base.match(/litexa\.config\.(js|json|coffee|ts)/);
  };

  const stats = await stat(location);
  if (stats.isFile()) {
    if (!isCorrectFilename(location)) {
      throw new Error(`The path ${location} is a file, but doesn't appear to point to a Litexa config file.`);
    }
    return location;
  }

  const files = await readdir(location);
  for (let file of files) {
    if (!isCorrectFilename(file)) {
      continue;
    }
    litexaDebug(`found root: ${location}`);

    return path.join(location, file);
  }

  const parent = path.normalize(path.join(location, '..'));
  if (parent !== location) {
    return await identifyConfigFileFromPath(parent);
  }

  throw new Error(`Failed to find a Litexa config file (litexa.config.js/json/coffee) anywhere in ${location} or its ancestors.`);
};

export async function loadConfig(atPath: string, skillNameValidate: any = null) {
  // Loads a project config file given a path, resolved by identifyConfigFileFromPath

  let config;
  if (skillNameValidate == null) {
    skillNameValidate = projectNameValidate;
  }
  let configLocation = await identifyConfigFileFromPath(atPath);
  const projectRoot = path.dirname(configLocation);

  try {
    const tsCheck = /.*\.ts$/;

    // Compile TypeScript
    if (configLocation.match(tsCheck)) {
      const source = fs.readFileSync(configLocation, 'utf8');
      const compiledJS = ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES5,
          module: ts.ModuleKind.CommonJS
        }
      });
      configLocation = configLocation.replace(/\.ts/, '.js');
      fs.writeFileSync(configLocation, compiledJS.outputText, 'utf8');
    }

    config = require(configLocation);
    config.root = projectRoot;
  } catch (err) {
    throw new Error(`Couldn't parse the Litexa config file at ${configLocation}: ${err}`);
  }

  if (!config.name) {
    config.name = path.basename(config.root);
  }

  // Validate
  try {
    skillNameValidate(config.name);
  } catch (err) {
    console.error('This project has an invalid name in its Litexa config file. Please fix it and try again!');
    throw err;
  }

  // patch the deployment names into their objects for access later
  if (config.deployments) {
    for (let name in config.deployments) {
      const deployment = config.deployments[name];
      deployment.name = name;
    }
  }

  return config;
};

export default {
  loadConfig,
  writeDefault,
  identifyConfigFileFromPath
};
