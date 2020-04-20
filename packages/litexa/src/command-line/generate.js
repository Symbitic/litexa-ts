/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const inquirer = require('inquirer');
const { Artifacts } = require('../deployment/artifacts');

const ArtifactTrackerGenerator = require('./generators/artifactTrackerGenerator');
const AssetsDirectoryGenerator = require('./generators/assetsDirectoryGenerator');
const ConfigGenerator = require('./generators/configGenerator');
const DirectoryCreator = require('./generators/directoryCreator');
const DirectoryStructureCreator = require('./generators/directory/structureCreator');
const LoggingChannel = require('./loggingChannel');
const ProjectInfo = require('./project-info');
const SkillIconsGenerator = require('./generators/skillIconsGenerator');
const SkillManifestGenerator = require('./generators/skillManifestGenerator');
const SourceCodeGenerator = require('./generators/sourceCodeGenerator');
const TemplateFilesHandler = require('./generators/templateFilesHandler');
const config = require('./project-config');

async function run(options) {
  const logger = new LoggingChannel({
    logStream: options.logger != null ? options.logger : console,
    logPrefix: 'generator',
    verbose: options.verbose
  });
  // absent any other options, generate all assets that don't exist
  logger.important('Beginning project generators');

  const dirCreator = new DirectoryStructureCreator({ logger });
  dirCreator.ensureDirExists(options.dir);

  const steps = [
    ConfigGenerator,
    ArtifactTrackerGenerator,
    SkillManifestGenerator,
    SourceCodeGenerator,
    AssetsDirectoryGenerator,
    SkillIconsGenerator
  ];

  try {
    for (let generator of steps) {
      const subLogger = logger.derive(generator.description);
      const gen = new generator({
        // Common Options
        options,
        logger: subLogger,
        // Generator-Specific Injected Dependencies
        inputHandler: inquirer,                           // ConfigGenerator, SkillManifestGenerator
        config,                                           // ConfigGenerator
        artifactClass: Artifacts,                         // ArtifactTrackerGenerator
        projectInfoClass: ProjectInfo,                    // SourceCodeGenerator
        templateFilesHandlerClass: TemplateFilesHandler,  // ConfigGenerator, SourceCodeGenerator
        directoryCreatorClass: DirectoryCreator           // SourceCodeGenerator
      });
      await gen.generate();
      subLogger.log('complete');
    }

    logger.important('Completed generation -> please consult the README.md for next steps.');
  } catch (err) {
    logger.error(err);
    logger.important('Generation failed');
  }
};

module.exports = {
  run
};
