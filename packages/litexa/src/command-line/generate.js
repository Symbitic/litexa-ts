/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import inquirer from 'inquirer';
import { Artifacts } from '../deployment/artifacts';

import ArtifactTrackerGenerator from './generators/artifactTrackerGenerator';
import AssetsDirectoryGenerator from './generators/assetsDirectoryGenerator';
import ConfigGenerator from './generators/configGenerator';
import DirectoryCreator from './generators/directoryCreator';
import DirectoryStructureCreator from './generators/directory/structureCreator';
import LoggingChannel from './loggingChannel';
import ProjectInfo from './project-info';
import SkillIconsGenerator from './generators/skillIconsGenerator';
import SkillManifestGenerator from './generators/skillManifestGenerator';
import SourceCodeGenerator from './generators/sourceCodeGenerator';
import TemplateFilesHandler from './generators/templateFilesHandler';
import config from './project-config';

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

export default {
  run
};
