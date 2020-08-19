/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/*
 * The project info object is a merge of the information derived
 * from the project config file, and information scanned from the
 * project data, like lists of asset and code files.
 */

import { existsSync, lstatSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import globalModulesPath from 'global-modules';
import debug from 'debug';
import LoggingChannel from './loggingChannel';
import { name as _name, version } from '../../package.json';
import lib from '../parser/parserlib';
const projectInfoDebug = debug('litexa-project-info');

class ProjectInfo {
  constructor(...args) {
    const obj = args[0];
    const { jsonConfig } = obj;
    this.variant = obj.variant;
    const logger = obj.logger ? obj.logger : new LoggingChannel({ logPrefix: 'project info' });
    this.doNotParseExtensions = obj.doNotParseExtensions ? obj.doNotParseExtensions : false;
    this.variant = this.variant ? this.variant : 'development';
    for (let k in jsonConfig) {
      this[k] = jsonConfig[k];
    }
    this.litexaRoot = join(this.root, "litexa");
    projectInfoDebug(`litexa root is ${this.litexaRoot}`);
    this.logger = logger;

    this.DEPLOY = this.deployments
      && this.deployments[this.variant]
      && this.deployments[this.variant].DEPLOY;
    if (!this.DEPLOY) {
      this.DEPLOY = {}
    }

    this.disableAssetReferenceValidation = this.deployments
      && this.deployments[this.variant]
      && this.deployments[this.variant].disableAssetReferenceValidation;

    // Direct Public Side-Effect
    this.parseDirectory(jsonConfig);
  }

  parseDirectory() {
    let f;
    if (!existsSync(this.litexaRoot) && (this.root !== '--mockRoot')) {
      throw new Error(`Cannot initialize ProjectInfo no litexa sub directory found at ${this.litexaRoot}`);
    }

    // compiled summary of package/extension info, to be sent in each response
    this.userAgent = `${_name}/${version} Node/${process.version}`;

    this.parseExtensions();

    projectInfoDebug('beginning languages parse');
    this.languages = {};
    this.languages.default = this.parseLanguage(this.litexaRoot, 'default');
    this.languagesRoot = join(this.litexaRoot, 'languages');
    if (existsSync(this.languagesRoot)) {
      const filter = f => {
        const fullPath = join(this.languagesRoot, f);
        if (!lstatSync(fullPath).isDirectory()) {
          return false;
        }
        if (f[0] === '.') {
          return false;
        }
        return true;
      };

      const languages = readdirSync(this.languagesRoot)
        .filter(f => filter(f));

      for (let lang of languages) {
        this.languages[lang] = this.parseLanguage(join(this.languagesRoot, lang), lang);
      }
    }

    // check for a localization summary file in the project's root dir
    for (let type of [ 'json', 'js' ]) {
      const localizationFilePath = join(this.root, `localization.${type}`);
      if (existsSync(localizationFilePath)) {
        this.localization = require(localizationFilePath);
      }
    }

    // if skill has no localization file, let's add a blank localization container
    // (to be populated by toLocalization() calls)
    if (!this.localization) {
      return this.localization = {
        intents: {},
        speech: {}
      };
    }
  }

  parseExtensions() {
    this.extensions = {};
    this.extensionOptions = this.extensionOptions ? this.extensionOptions : {};

    if ((this.root === '--mockRoot') || this.doNotParseExtensions) {
      return;
    }

    const deployModules = join(this.litexaRoot, 'node_modules');

    const scanForExtensions = modulesRoot => {
      projectInfoDebug(`scanning for extensions at ${modulesRoot}`);
      // this is fine, no extension modules to scan
      if (!existsSync(modulesRoot)) {
        return;
      }

      for (let moduleName of readdirSync(modulesRoot)) {
        if (moduleName.charAt(0) === '@') {
          const scopePath = join(modulesRoot, moduleName);
          for (let scopedModule of readdirSync(scopePath)) {
            const scopedModuleName = join(moduleName, scopedModule);
            scanModuleForExtension(scopedModuleName, modulesRoot);
          }
        } else {
          scanModuleForExtension(moduleName, modulesRoot);
        }
      }
    };

    const scanModuleForExtension = (moduleName, modulesRoot) => {
      if (this.extensions[moduleName]) {
        // this extension was already loaded - ignore duplicate
        // (probably installed locally as well as globally)
        return;
      }

      const modulePath = join(modulesRoot, moduleName);
      projectInfoDebug(`looking in ${modulePath}`);

      // attempt to load any of the supported types
      let found = false;
      let extensionFile = '';
      for (let type of [ 'coffee', 'js' ]) {
        extensionFile = join(modulePath, `litexa.extension.${type}`);
        projectInfoDebug(extensionFile);
        if (existsSync(extensionFile)) {
          found = true;
          break;
        }
      }

      // fine, this is not an extension module
      if (!found) {
        projectInfoDebug(`module ${moduleName} did not contain litexa.extension.js/coffee, skipping for extensions`);
        return;
      }

      projectInfoDebug(`loading extension \`${moduleName}\``);
      // add extension name and version to userAgent, to be included in responses
      try {
        const extensionPackageInfo = require(join(modulePath, 'package.json'));
        this.userAgent += ` ${moduleName}/${extensionPackageInfo.version}`;
      } catch (err) {
        console.warn(`WARNING: Failed to load a package.json for the extension module at ${modulePath}/package.json, while looking for its version number. Is it missing?`);
      }

      const extension = require(extensionFile);
      extension.__initialized = false;
      extension.__location = modulesRoot;
      extension.__deployable = modulesRoot === deployModules;

      const options = this.extensionOptions[moduleName] ? this.extensionOptions[moduleName] : {};

      this.extensions[moduleName] = extension(options, lib);
      if (this.extensions[moduleName].language && this.extensions[moduleName].language.lib) {
        for (let k in this.extensions[moduleName].language.lib) {
          if (k in lib) {
            throw new Error(`extension \`${moduleName}\` wanted to add type \`${k}\` to lib, but it was already there. That extension is unfortunately not compatible with this project.`
            );
          }
          lib[k] = this.extensions[moduleName].language.lib[k];
        }
      }
    };

    const nodeModules = join(this.root, 'node_modules');
    const localModulesPath = join(this.root, 'modules');

    return [ deployModules, nodeModules, localModulesPath, globalModulesPath ]
      .map((x) => scanForExtensions(x));
  }

  parseLanguage(root, lang) {
    let kind, proc;
    let f;
    projectInfoDebug(`parsing language at ${root}`);
    const def = {
      assetProcessors: {},
      convertedAssets: {
        root: join(this.root, '.deploy', 'converted-assets', lang),
        files: []
      },
      assets: {
        root: join(root, 'assets'),
        files: []
      },
      code: {
        root,
        files: []
      }
    };

    if (this.root === '--mockRoot') {
      return;
    }

    const fileBlacklist = [
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'tslint.json',
      'mocha.opts',
      '.mocharc.json',
      '.DS_Store'
    ];

    // collect all the files in the litexa directory
    // as inputs for the litexa compiler
    const codeExtensionsWhitelist = [
      '.litexa',
      '.coffee',
      '.js',
      '.json'
    ];

    const codeFilter = f => {
      const fullPath = join(def.code.root, f);
      if (!lstatSync(fullPath).isFile()) {
        return false;
      }
      if (f[0] === '.') {
        return false;
      }
      const extension = extname(f);
      return !codeExtensionsWhitelist.includes(extension) ? false : true;
    };

    def.code.files = readdirSync(def.code.root)
      .filter(f => codeFilter(f));

    const assetExtensionsWhitelist = [
      '.png',
      '.jpg',
      '.svg',
      '.mp3',
      '.otf',
      '.json',
      '.jpeg',
      '.txt',
      '.html',
      '.css',
      '.js',
      '.map',
      '.glb',
      '.m4a',
      '.mp4',
      '.ico',
      '.ogg',
      '.unityweb'
    ];

    for (kind in this.extensions) {
      const info = this.extensions[kind];
      if (!info.assetPipeline) {
        continue;
      }
      for (let procIndex = 0; procIndex < info.assetPipeline.length; procIndex++) {
        // @TODO: Validate processor here?

        // Create a clone of our processor, so as not to override previous languages' inputs/outputs.
        proc = info.assetPipeline[procIndex];
        const clone = {};
        Object.assign(clone, proc);

        const name = clone.name ? clone.name : `${kind}[${procIndex}]`;

        if (!clone.listOutputs) {
          throw new Error(`asset processor ${procIndex} from extension ${kind} doesn't have a listOutputs function.`);
        }

        def.assetProcessors[name] = clone;
        clone.inputs = [];
        clone.outputs = [];
        clone.options = this.plugins ? this.plugins[kind] : undefined;
      }
    }

    // collect all the assets
    if (existsSync(def.assets.root)) {
      // we support direct copy for some built in types
      const { logger } = this;
      const assetFilter = f => {
        const fullPath = join(def.assets.root, f);
        if (!lstatSync(fullPath).isFile()) {
          return false;
        }
        if (f[0] === '.') {
          return false;
        }
        const extension = extname(f);
        if (!assetExtensionsWhitelist.includes(extension)) {
          return false;
        }
        return true;
      };

      def.assets.files = [];

      const processDirectory = root => {
        projectInfoDebug(`processing asset dir ${root}`);
        return (() => {
          const result1 = [];
          for (f of Array.from(readdirSync(root))) {
            if (Array.from(fileBlacklist).includes(f)) { continue; }

            f = join(root, f);
            const stat = statSync(f);
            if (stat.isDirectory()) {
              processDirectory(f);
              continue;
            }

            f = relative(def.assets.root, f);
            projectInfoDebug(`processing asset file ${f}`);

            let processed = false;
            if (assetFilter(f)) {
              def.assets.files.push(f);
              processed = true;
            }

            // check whether any extensions would produce
            // usable assets from this file
            for (kind in def.assetProcessors) {
              proc = def.assetProcessors[kind];
              const outputs = proc.listOutputs({
                assetName: f,
                assetsRoot: def.assets.root,
                targetRoot: null,
                options: proc.options
              });

              if ((outputs != null ? outputs.length : undefined) > 0) {
                projectInfoDebug(`${kind}: ${f} -> ${outputs}`);
                processed = true;
                proc.inputs.push(f);
                for (let o of Array.from(outputs)) {
                  proc.outputs.push(o);
                  if ((Array.from(def.assets.files).includes(o)) || (Array.from(def.convertedAssets.files).includes(o))) {
                    throw new Error(`Asset processor ${kind} would \
produce a duplicate file ${o}. \
Please resolve this before continuing by either \
deleting the duplicate or determining whether you \
have multiple asset processors that create \
the same output.`
                    );
                  }
                  def.convertedAssets.files.push(o);
                }
              }
            }

            if (!processed) {
              result1.push(logger.warning(`Unsupported internally or by extensions, skipping asset: ${f}`));
            } else {
              result1.push(undefined);
            }
          }
          return result1;
        })();
      };

      processDirectory(def.assets.root);
    }

    projectInfoDebug(`project info: \n ${JSON.stringify(def, null, 2)}`);
    return def;
  }

  filesForLanguage(lang) {
    let info, list, name, type;
    const result = {};
    for (type in this.languages.default) {
      info = this.languages.default[type];
      list = (result[type] = {});
      for (name of Array.from(info.files)) {
        list[name] = join(info.root, name);
      }
    }
    if (lang in this.languages) {
      for (type in this.languages[lang]) {
        info = this.languages[lang][type];
        list = result[type];
        for (name of Array.from(info.files)) {
          list[name] = join(info.root, name);
        }
      }
    }
    return result;
  }
}

ProjectInfo.createMock = () => {
  const config = {
    root: "--mockRoot",
    name: "mockProject",
    isMock: true
  };
  return new ProjectInfo({ jsonConfig: config, variant: "mockTesting" });
};

export default ProjectInfo;
