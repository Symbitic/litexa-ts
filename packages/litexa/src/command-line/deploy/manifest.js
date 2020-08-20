/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import fs from 'fs';
import path from 'path';
import util from 'util';
import smapi from '../api/smapi';
import { JSONValidator } from '../../parser/jsonValidator';

const writeFile = util.promisify(fs.writeFile);

let logger = console;
let askProfile = null;

function testObjectsEqual(a, b) {
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      throw `${JSON.stringify(a)} NOT EQUAL TO ${JSON.stringify(b)}`;
    }

    if (a.length !== b.length) {
      throw `${JSON.stringify(a)} NOT EQUAL TO ${JSON.stringify(b)}`;
    }

    for (let i = 0; i < a.length; i++) {
      testObjectsEqual(a[i], b[i]);
    }
    return;
  }

  if (typeof (a) === 'object') {
    let k;
    if (typeof (b) !== 'object') {
      throw `${JSON.stringify(a)} NOT EQUAL TO ${JSON.stringify(b)}`;
    }

    // check all B keys are present in A, as long as B key actually has a value
    for (k in b) {
      if (b[k] == null) { continue; }
      if (!(k in a)) {
        throw `${JSON.stringify(a)} NOT EQUAL TO ${JSON.stringify(b)}`;
      }
    }

    // check that all values in A are the same in B
    for (k in a) {
      testObjectsEqual(a[k], b[k]);
    }
    return;
  }

  if (a !== b) {
    throw `${JSON.stringify(a)} NOT EQUAL TO ${JSON.stringify(b)}`;
  }
};

function loadSkillInfo(context, manifestContext) {
  logger.log("loading skill.json");
  const infoFilename = path.join(context.projectRoot, 'skill');

  try {
    manifestContext.skillInfo = require(infoFilename);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      writeDefaultManifest(context, path.join(context.projectRoot, 'skill.coffee'));
      throw `skill.* was not found in project root ${context.projectRoot}, so a default has been generated in CoffeeScript. Please modify as appropriate and try deployment again.`;
    }
    logger.error(err);
    throw `Failed to parse skill manifest ${infoFilename}`;
  }
  return Promise.resolve();
};

function getManifestFromSkillInfo(context, manifestContext) {
  logger.log("building skill manifest");
  if (!('manifest' in manifestContext.skillInfo)) {
    throw "Didn't find a 'manifest' property in the skill.* file. Has it been corrupted?";
  }

  const deploymentTarget = context.projectInfo.variant;

  // Let's check if a deployment target specific manifest is being exported in the form of:
  // { deploymentTargetName: { manifest: {...} } }
  for (let key in manifestContext.skillInfo) {
    if (key === deploymentTarget) {
      manifestContext.fileManifest = manifestContext.skillInfo[deploymentTarget].manifest;
    }
  }

  if (manifestContext.fileManifest == null) {
    // If we didn't find a deployment-target-specific manifest, let's try to get the manifest
    // from the top level of the file export.
    manifestContext.fileManifest = manifestContext.skillInfo.manifest;
  }

  if (manifestContext.fileManifest == null) {
    throw `skill* is neither exporting a top-level 'manifest' key, nor a 'manifest' nested below the current deployment target '${deploymentTarget}' - please export a manifest for either and re-deploy.`;
  }

  return Promise.resolve();
};

function buildSkillManifest(context, manifestContext) {
  let e, extension, extensionName, i, k, validator;
  const lambdaArn = context.artifacts.get('lambdaARN');
  if (!lambdaArn) {
    throw "Missing lambda ARN during manifest deployment. Has the Lambda been deployed yet?";
  }

  const { fileManifest } = manifestContext;
  // pull the skill file's manifest into our template merge manifest, which
  // will set any non-critical values that were missing in the file manifest
  const mergeManifest = {
    manifestVersion: "1.0",
    publishingInformation: {
      isAvailableWorldwide: false,
      distributionCountries: ['US'],
      distributionMode: 'PUBLIC',
      category: 'GAMES',
      testingInstructions: 'no instructions',
      gadgetSupport: undefined
    },
    privacyAndCompliance: {
      allowsPurchases: false,
      usesPersonalInfo: false,
      isChildDirected: false,
      isExportCompliant: true,
      containsAds: false
    },
    apis: {
      custom: {
        endpoint: {
          uri: lambdaArn
        },
        regions: {
          NA: {
            endpoint: {
              uri: lambdaArn
            }
          }
        },
        interfaces: []
      }
    }
  };
  //events: {}
  //permissions: {}

  if (!('publishingInformation' in fileManifest)) {
    throw "skill.json is missing publishingInformation. Has it been corrupted?";
  }

  const { interfaces } = mergeManifest.apis.custom;

  for (let key in fileManifest) {
    let data, left, locale, v;
    switch (key) {
      case 'publishingInformation':
        // copy over all sub keys of publishing information
        for (k in mergeManifest.publishingInformation) {
          v = mergeManifest.publishingInformation[k];
          mergeManifest.publishingInformation[k] = fileManifest.publishingInformation[k] != null ? fileManifest.publishingInformation[k] : v;
        }

        if (!('locales' in fileManifest.publishingInformation)) {
          throw `skill.json is missing locales in publishingInformation. Has it been corrupted?`;
        }

        // dig through specified locales. TODO: compare with code language support?
        mergeManifest.publishingInformation.locales = {};
        manifestContext.locales = [];

        // check for icon files that were deployed via 'assets' directories
        const deployedIconAssets = (left = context.artifacts.get('deployedIconAssets')) != null ? left : {};
        manifestContext.deployedIconAssetsMd5Sum = '';

        for (locale in fileManifest.publishingInformation.locales) {
          // copy over kosher keys, ignore the rest
          let left1;
          data = fileManifest.publishingInformation.locales[locale];
          const whitelist = ['name', 'summary', 'description',
            'examplePhrases', 'keywords', 'smallIconUri',
            'largeIconUri'];
          const copy = {};
          for (k of Array.from(whitelist)) {
            copy[k] = data[k];
          }

          // check for language-specific skill icon files that were deployed via 'assets'
          let localeIconAssets = deployedIconAssets[locale] != null ? deployedIconAssets[locale] : deployedIconAssets[locale.slice(0, 2)];
          // fallback to default skill icon files, if no locale-specific icons found
          if (localeIconAssets == null) {
            localeIconAssets = deployedIconAssets.default;
          }

          // Unless user specified their own icon URIs, use the deployed asset icons.
          // If neither a URI is specified nor an asset icon is deployed, throw an error.
          if (copy.smallIconUri != null) {
            copy.smallIconUri = copy.smallIconUri;
          } else {
            const smallIconFileName = 'icon-108.png';
            if ((localeIconAssets != null) && (localeIconAssets[smallIconFileName] != null)) {
              const smallIcon = localeIconAssets[smallIconFileName];
              manifestContext.deployedIconAssetsMd5Sum += smallIcon.md5;
              copy.smallIconUri = smallIcon.url;
            } else {
              throw `Required smallIconUri not found for locale ${locale}. Please specify a \
'smallIconUri' in the skill manifest, or deploy an '${smallIconFileName}' image via \
assets.`;
            }
          }

          if (copy.largeIconUri != null) {
            copy.largeIconUri = copy.largeIconUri;
          } else {
            const largeIconFileName = 'icon-512.png';
            if ((localeIconAssets != null) && (localeIconAssets[largeIconFileName] != null)) {
              const largeIcon = localeIconAssets[largeIconFileName];
              manifestContext.deployedIconAssetsMd5Sum += largeIcon.md5;
              copy.largeIconUri = largeIcon.url;
            } else {
              throw `Required largeIconUri not found for locale ${locale}. Please specify a \
'smallIconUri' in the skill manifest, or deploy an '${largeIconFileName}' image via \
assets.`;
            }
          }

          mergeManifest.publishingInformation.locales[locale] = copy;

          let invocationName = (left1 = (context.deploymentOptions.invocation != null ? context.deploymentOptions.invocation[locale] : undefined) != null ? (context.deploymentOptions.invocation != null ? context.deploymentOptions.invocation[locale] : undefined) : data.invocation) != null ? left1 : data.name;
          invocationName = invocationName.replace(/[^a-zA-Z0-9 ]/g, ' ');
          invocationName = invocationName.toLowerCase();

          if (context.deploymentOptions.invocationSuffix != null) {
            invocationName += ` ${context.deploymentOptions.invocationSuffix}`;
          }

          const maxLength = 160;
          if (copy.summary.length > maxLength) {
            copy.summary = copy.summary.slice(0, +(maxLength - 4) + 1 || undefined) + '...';
            logger.log(`uploaded summary length: ${copy.summary.length}`);
            logger.warning(`summary for locale ${locale} was too long, truncated it to ${maxLength} \
characters`
            );
          }

          if (!copy.examplePhrases) {
            copy.examplePhrases = [
              "Alexa, launch <invocation>",
              "Alexa, open <invocation>",
              "Alexa, play <invocation>"
            ];
          }

          copy.examplePhrases = Array.from(copy.examplePhrases).map((phrase) =>
            phrase.replace(/\<invocation\>/gi, invocationName));

          // if 'production' isn't in the deployment target name, assume it's a development skill
          // and append a ' (target)' suffix to its name
          if (!context.projectInfo.variant.includes('production')) {
            copy.name += ` (${context.projectInfo.variant})`;
          }

          manifestContext.locales.push({
            code: locale,
            invocation: invocationName
          });
        }

        if (!(manifestContext.locales.length > 0)) {
          throw "No locales found in the skill.json manifest. Please add at least one.";
        }
        break;

      case 'privacyAndCompliance':
        // dig through these too
        for (k in mergeManifest.privacyAndCompliance) {
          v = mergeManifest.privacyAndCompliance[k];
          mergeManifest.privacyAndCompliance[k] = fileManifest.privacyAndCompliance[k] != null ? fileManifest.privacyAndCompliance[k] : v;
        }

        if (fileManifest.privacyAndCompliance.locales != null) {
          mergeManifest.privacyAndCompliance.locales = {};
          for (locale in fileManifest.privacyAndCompliance.locales) {
            data = fileManifest.privacyAndCompliance.locales[locale];
            mergeManifest.privacyAndCompliance.locales[locale] = {
              privacyPolicyUrl: data.privacyPolicyUrl,
              termsOfUseUrl: data.termsOfUseUrl
            };
          }
        }
        break;

      case 'apis':
        // copy over any keys the user has specified, they might know some
        // advanced information that hasn't been described in a plugin yet,
        // trust the user on this
        if (fileManifest.apis && fileManifest.apis.custom && fileManifest.apis.custom.interfaces) {
          for (i of fileManifest.apis.custom.interfaces) {
            interfaces.push(i);
          }
        }
        break;
      default:
        // no opinion on any remaining keys, so if they exist, copy them over
        mergeManifest[key] = fileManifest[key];
    }
  }

  // collect which APIs are actually in use and merge them
  const requiredAPIs = {};
  context.skill.collectRequiredAPIs(requiredAPIs);
  for (k in context.projectInfo.extensions) {
    extension = context.projectInfo.extensions[k];
    if ((extension.compiler != null ? extension.compiler.requiredAPIs : undefined) == null) { continue; }
    for (let a of Array.from(extension.compiler.requiredAPIs)) {
      requiredAPIs[a] = true;
    }
  }
  for (let apiName in requiredAPIs) {
    let found = false;
    for (i of Array.from(interfaces)) {
      if (i.type === apiName) {
        found = true;
      }
    }
    if (!found) {
      logger.log(`enabling interface ${apiName}`);
      interfaces.push({ type: apiName });
    }
  }

  // save it for later, wrap it one deeper for SMAPI
  manifestContext.manifest = mergeManifest;

  const finalManifest = { manifest: mergeManifest };

  // extensions can opt to validate the manifest, in case there are other
  // dependencies they want to assert
  for (extensionName in context.projectInfo.extensions) {
    extension = context.projectInfo.extensions[extensionName];
    validator = new JSONValidator(finalManifest);
    __guard__(extension.compiler != null ? extension.compiler.validators : undefined, x1 => x1.manifest({ validator, skill: context.skill }));
    if (validator.errors.length > 0) {
      for (e of Array.from(validator.errors)) { logger.error(e); }
      throw "Errors encountered with the manifest, cannot continue.";
    }
  }

  // now that we have the manifest, we can also validate the models
  for (let region in finalManifest.manifest.publishingInformation.locales) {
    const model = context.skill.toModelV2(region);
    validator = new JSONValidator(model);
    for (extensionName in context.projectInfo.extensions) {
      extension = context.projectInfo.extensions[extensionName];
      __guard__(extension.compiler != null ? extension.compiler.validators : undefined, x2 => x2.model({ validator, skill: context.skill }));
      if (validator.errors.length > 0) {
        for (e of Array.from(validator.errors)) { logger.error(e); }
        throw `Errors encountered with model in ${region} language, cannot continue`;
      }
    }
  }

  manifestContext.manifestFilename = path.join(context.deployRoot, 'skill.json');
  return writeFile(manifestContext.manifestFilename, JSON.stringify(finalManifest, null, 2), 'utf8');
};

function createOrUpdateSkill(context, manifestContext) {
  const skillId = context.artifacts.get('skillId');
  if (skillId != null) {
    manifestContext.skillId = skillId;
    logger.log("skillId found in artifacts, getting information");
    return updateSkill(context, manifestContext);
  } else {
    logger.log("no skillId found in artifacts, creating new skill");
    return createSkill(context, manifestContext);
  }
};

function parseSkillInfo(data) {
  try {
    data = JSON.parse(data);
  } catch (err) {
    logger.verbose(data);
    logger.error(err);
    throw "failed to parse JSON response from SMAPI";
  }

  const info = {
    status: __guard__(data.manifest != null ? data.manifest.lastUpdateRequest : undefined, x => x.status) != null ? __guard__(data.manifest != null ? data.manifest.lastUpdateRequest : undefined, x => x.status) : null,
    errors: __guard__(data.manifest != null ? data.manifest.lastUpdateRequest : undefined, x1 => x1.errors),
    manifest: data.manifest,
    raw: data
  };

  if (info.errors) {
    info.errors = JSON.stringify(info.errors, null, 2);
    logger.verbose(info.errors);
  }
  logger.verbose(`skill is in ${info.status} state`);

  return info;
};

const updateSkill = (context, manifestContext) => smapi.call({
  askProfile,
  command: 'get-skill',
  params: { 'skill-id': manifestContext.skillId },
  logChannel: logger
})
  .catch(err => {
    if (err.code === 404) {
      return Promise.reject("The skill ID stored in artifacts.json doesn't seem to exist in the deployment account. Have you deleted it manually in the dev console? If so, please delete it from the artifacts.json and try again.");
    } else {
      return Promise.reject(err);
    }
  }).then(data => {
    let needsUpdating = false;
    const info = parseSkillInfo(data);
    if (info.status === 'FAILED') {
      needsUpdating = true;
    } else {
      try {
        testObjectsEqual(info.manifest, manifestContext.manifest);
        logger.log("skill manifest up to date");
      } catch (error) {
        const err = error;
        logger.verbose(err);
        logger.log("skill manifest mismatch");
        needsUpdating = true;
      }
    }

    if (context.artifacts.get('skill-manifest-assets-md5') !== manifestContext.deployedIconAssetsMd5Sum) {
      logger.log("skill icons changed since last update");
      needsUpdating = true;
    }

    if (!needsUpdating) {
      logger.log("skill manifest up to date");
      return Promise.resolve();
    }

    logger.log("updating skill manifest");
    return smapi.call({
      askProfile,
      command: 'update-skill',
      params: {
        'skill-id': manifestContext.skillId,
        'file': manifestContext.manifestFilename
      },
      logChannel: logger
    })
      .then(data => waitForSuccess(context, manifestContext.skillId, 'update-skill'))
      .then(() => context.artifacts.save('skill-manifest-assets-md5', manifestContext.deployedIconAssetsMd5Sum))
      .catch(err => Promise.reject(err));
  });


const waitForSuccess = (context, skillId, operation) => new Promise(function (resolve, reject) {
  const checkStatus = () => {
    logger.log(`waiting for skill status after ${operation}`);
    return smapi.call({
      askProfile,
      command: 'get-skill-status',
      params: { 'skill-id': skillId },
      logChannel: logger
    })
      .then(data => {
        const info = parseSkillInfo(data);
        switch (info.status) {
          case 'FAILED':
            logger.error(info.errors);
            return reject("skill in FAILED state");
            break;
          case 'SUCCEEDED':
            logger.log(`${operation} succeeded`);
            context.artifacts.save('skillId', skillId);
            return resolve();
            break;
          case 'IN_PROGRESS':
            setTimeout(checkStatus, 1000);
            break;
          default:
            logger.verbose(data);
            return reject(`unknown skill state: ${info.status} while waiting on SMAPI`);
        }
        return Promise.resolve();
      }).catch(err => Promise.reject(err));
  };
  return checkStatus();
});


const createSkill = (context, manifestContext) => smapi.call({
  askProfile,
  command: 'create-skill',
  params: { 'file': manifestContext.manifestFilename },
  logChannel: logger
})
  .then(data => {
    // dig out the skill id
    // logger.log data
    const lines = data.split('\n');
    let skillId = null;
    for (let line of Array.from(lines)) {
      const [k, v] = Array.from(line.split(':'));
      if (k.toLowerCase().indexOf('skill id') === 0) {
        skillId = v.trim();
        break;
      }
    }
    if (skillId == null) {
      throw "failed to extract skill ID from ask cli response to create-skill";
    }
    logger.log(`in progress skill id ${skillId}`);
    manifestContext.skillId = skillId;
    return waitForSuccess(context, skillId, 'create-skill');
  })
  .catch(err => Promise.reject(err));

function writeDefaultManifest(context, filename) {
  logger.log("writing default skill.json");
  // try to make a nice looking name from the
  // what was the directory name
  let {
    name
  } = context.projectInfo;
  name = name.replace(/[_\.\-]/gi, ' ');
  name = name.replace(/\s+/gi, ' ');
  name = (name.split(' '));
  name = (Array.from(name).map((w) => w[0].toUpperCase() + w.slice(1)));
  name = name.join(' ');

  const manifest = `\
###
  This file exports an object that is a subset of the data
  specified for an Alexa skill manifest as defined at
  https://developer.amazon.com/docs/smapi/skill-manifest.html

  Please fill in fields as appropriate for this skill,
  including the name, descriptions, more regions, etc.

  At deployment time, this data will be augmented with
  generated information based on your skill code.
###

module.exports =
  manifest:
    publishingInformation:
      isAvailableWorldwide: false,
      distributionCountries: [ 'US' ]
      distributionMode: 'PUBLIC'
      category: 'GAMES'
      testingInstructions: "replace with testing instructions"

      locales:
        "en-US":
          name: "${name}"
          invocation: "${name.toLowerCase()}"
          summary: "replace with brief description, no longer than 120 characters"
          description: "\""Longer description, goes to the skill store.
            Line breaks are supported."\""
          examplePhrases: [
            "Alexa, launch ${name}"
            "Alexa, open ${name}"
            "Alexa, play ${name}"
          ]
          keywords: [
            'game'
            'fun'
            'single player'
            'modify this list as appropriate'
          ]

    privacyAndCompliance:
      allowsPurchases: false
      usesPersonalInfo: false
      isChildDirected: false
      isExportCompliant: true
      containsAds: false

      locales:
        "en-US":
          privacyPolicyUrl: "https://www.example.com/privacy.html",
          termsOfUseUrl: "https://www.example.com/terms.html"\
`;

  return fs.writeFileSync(filename, manifest, 'utf8');
};

const waitForModelSuccess = (context, skillId, locale, operation) => new Promise((resolve, reject) => {
  const checkStatus = () => {
    logger.log(`waiting for model ${locale} status after ${operation}`);
    return smapi.call({
      askProfile,
      command: 'get-skill-status',
      params: { 'skill-id': skillId },
      logChannel: logger
    })
      .then(data => {
        let info;
        try {
          info = JSON.parse(data);
          info = info.interactionModel[locale];
        } catch (err) {
          logger.verbose(data);
          logger.error(err);
          return reject("failed to parse SMAPI result");
        }

        switch (info.lastUpdateRequest && info.lastUpdateRequest.status) {
          case 'FAILED':
            logger.error(info.errors);
            return reject("skill in FAILED state");
            break;
          case 'SUCCEEDED':
            logger.log(`model ${operation} succeeded`);
            context.artifacts.save(`skill-model-etag-${locale}`, info.eTag);
            return resolve();
            break;
          case 'IN_PROGRESS':
            setTimeout(checkStatus, 1000);
            break;
          default:
            logger.verbose(data);
            return reject(`unknown skill state: ${info.status} while waiting on SMAPI`);
        }
        return Promise.resolve();
      })
      .catch(err => reject(err));
  };
  return checkStatus();
});

function updateModel(context, manifestContext) {
  return Promise.all(manifestContext.locales.map(locale => {
    return updateModelForLocale(context, manifestContext, locale)
  }));
};

function updateModelForLocale(context, manifestContext, localeInfo) {
  const locale = localeInfo.code;

  const modelDeployStart = new Date;
  return smapi.call({
    askProfile,
    command: 'get-model',
    params: {
      'skill-id': manifestContext.skillId,
      locale
    },
    logChannel: logger
  })
    .catch(err => {
      // it's fine if it doesn't exist yet, we'll upload
      if (err.code !== 404) {
        Promise.reject(err);
      }
      return Promise.resolve("{}");
    })
    .then(data => {
      let model = context.skill.toModelV2(locale);

      // patch in the invocation from the skill manifest
      model.languageModel.invocationName = localeInfo.invocation;

      // note, SMAPI needs an extra
      // interactionModel key around the model
      model =
        { interactionModel: model };

      const filename = path.join(context.deployRoot, `model-${locale}.json`);
      fs.writeFileSync(filename, JSON.stringify(model, null, 2), 'utf8');

      let needsUpdate = false;
      try {
        data = JSON.parse(data);
        // the version number is a lamport clock, will always mismatch
        delete data.version;
        testObjectsEqual(model, data);
        logger.log(`${locale} model up to date`);
      } catch (error) {
        const err = error;
        logger.verbose(err);
        logger.log(`${locale} model mismatch`);
        needsUpdate = true;
      }

      if (!needsUpdate) {
        logger.log(`${locale} model is up to date`);
        return Promise.resolve();
      }

      logger.log(`${locale} model update beginning`);
      return smapi.call({
        askProfile,
        command: 'update-model',
        params: {
          'skill-id': manifestContext.skillId,
          locale,
          file: filename
        },
        logChannel: logger
      })
        .then(() => waitForModelSuccess(context, manifestContext.skillId, locale, 'update-model'))
        .then(() => {
          const dt = (new Date) - modelDeployStart;
          return logger.log(`${locale} model update complete, total time ${dt}ms`);
        })
        .catch(err => Promise.reject(err));
    });
};

function enableSkill(context, manifestContext) {
  logger.log("ensuring skill is enabled for testing");
  return smapi.call({
    askProfile,
    command: 'enable-skill',
    params: { 'skill-id': manifestContext.skillId },
    logChannel: logger
  })
    .catch(err => Promise.reject(err));
};

export async function deploy(context, overrideLogger) {
  logger = overrideLogger;

  askProfile = context.deploymentOptions && context.deploymentOptions.askProfile;

  const manifestContext = {};

  logger.log("beginning manifest deployment");

  try {
    await loadSkillInfo(context, manifestContext);
    await getManifestFromSkillInfo(context, manifestContext);
    await buildSkillManifest(context, manifestContext);
    await createOrUpdateSkill(context, manifestContext);
    await updateModel(context, manifestContext);
    await enableSkill(context, manifestContext);
    logger.log(`manifest deployment complete, ${logger.runningTime()}ms`);
  } catch (err) {
    if (err.code) {
      logger.error(`SMAPI error: ${err.code} ${err.message}`);
    } else if (err.stack != null) {
      logger.error(err.stack);
    } else {
      logger.error(JSON.stringify(err));
    }
    throw 'failed manifest deployment';
  }
}

export const testing = {
  getManifestFromSkillInfo
};

export default {
  deploy,
  testing
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
