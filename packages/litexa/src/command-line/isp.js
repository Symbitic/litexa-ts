/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const rimraf = require('rimraf');
const { loadArtifacts } = require('../deployment/artifacts');
const skillBuilder = require('./skill-builder');
const smapi = require('./api/smapi');
const LoggingChannel = require('./loggingChannel');

/*
 * Utility for running ISP-related Litexa CLI commands, which query @smapi via the ASK CLI.
 * @function init ... needs to be called before issuing any ISP commands
 * @param args ... object which should at minimum provide:
 *   @param root  ... directory where to search for Litexa project
 *   @param stage ... deployment stage to use
 */
module.exports = {
  async init(args) {
    this.logger = new LoggingChannel({
      logPrefix: 'isp',
      logStream: args.logger != null ? args.logger : console,
      enableVerbose: args.verbose
    });
    this.artifacts = args.artifacts;
    this.root = args.root;
    this.skillId = args.skillId;
    this.deployment = args.deployment;
    this.stage = args.stage;
    this.smapi = args.smapi || smapi;

    return await this.initializeSkillInfo();
  },

  async initializeSkillInfo() {
    if (!this.artifacts || !this.skillId) {
      // Build the skill so we can retrieve the skill ID.
      const skill = await skillBuilder.build(this.root, this.deployment);
      skill.projectInfo.variant = this.deployment;

      const context = {
        projectInfo: skill.projectInfo,
        projectRoot: skill.projectInfo && skill.projectInfo.root,
        deploymentName: this.deployment,
        deploymentOptions: skill.projectInfo.deployments[this.deployment]
      };

      this.askProfile = context.deploymentOptions ? context.deploymentOptions.askProfile : undefined;
      this.ispDir = path.join(skill.projectInfo ? skill.projectInfo.root : undefined, 'isp', this.deployment);

      await loadArtifacts({ context, logger: this.logger });
      this.artifacts = context.artifacts;
      this.skillId = this.artifacts.get('skillId');
    }
  },

  async pullAndStoreRemoteProducts() {
    const productSummaries = await this.pullRemoteProductSummaries();
    return this.storeProductDefinitions(productSummaries);
  },

  async pullRemoteProductSummaries() {
    const productList = await this.pullRemoteProductList();
    return JSON.parse(productList);
  },

  async pullRemoteProductList() {
    this.logger.log(`querying in-skill products using askProfile '${this.askProfile}' and skill ID '${this.skillId}' ...`);

    try {
      const productList = this.smapi.call({
        askProfile: this.askProfile,
        command: 'list-isp-for-skill',
        params: {
          'skill-id': this.skillId,
          'stage': this.stage
        },
        logChannel: this.logger
      });
      return productList;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        this.logger.error(`calling 'list-isp-for-skill' failed with error: ${err.message}`);
        return Promise.reject(err);
      }
      // ENOENT just meant there was no ISP data on the server -> ignore
      return [];
    }
  },

  async resetRemoteProductEntitlements() {
    if (this.stage === 'live') {
      this.logger.error("unable to modify remote in-skill products in 'live' stage -> please use 'development'");
      return;
    }

    const remoteProducts = await this.pullRemoteProductSummaries();
    const resetPromises = [];

    this.logger.log(`resetting in-skill product entitlements for skill ID '${this.skillId}' ...`);

    try {
      for (let remoteProduct of remoteProducts) {
        await this.smapi.call({
          askProfile: this.askProfile,
          command: 'reset-isp-entitlement',
          params: {
            'isp-id': remoteProduct.productId
          }
        });
      }
    } catch (err) {
      this.logger.error(`failed to call reset-isp-entitlement with error: ${err.message}`);
      return Promise.reject(err);
    }
  },

  async storeProductDefinitions(products) {
    if (!Array.isArray(products)) {
      const err = new Error("@smapi didn't return an array for 'list-isp-for-skill'");
      return Promise.reject(err);
    }

    rimraf.sync(this.ispDir);
    mkdirp.sync(this.ispDir);

    this.logger.log(`storing in-skill product definitions in ${this.ispDir} ...`);

    const artifactSummary = {};

    for (let product of products) {
      const fileName = `${product.referenceName}.json`;
      const filePath = path.join(this.ispDir, fileName);
      const productDefinition = await this.getProductDefinition(product);
      this.logger.verbose(`writing ${filePath} ...`);
      fs.writeFileSync(filePath, JSON.stringify(productDefinition, null, '\t'));
      artifactSummary[`${product.referenceName}`] = {
        productId: product.productId
      };
    }

    this.artifacts.save('monetization', artifactSummary);
  },

  async getProductDefinition(product) {
    try {
      const productDefinition = await this.smapi.call({
        askProfile: this.askProfile,
        command: 'get-isp',
        params: {
          'isp-id': product.productId,
          'stage': this.stage
        },
        logChannel: this.logger
      });
      return JSON.parse(productDefinition);
    } catch (err) {
      this.logger.error(`failed to retrieve in-skill product definition for '${product.referenceName}' with error: ${err.message}`);
      return Promise.reject(err);
    }
  },

  async pushLocalProducts() {
    if (this.stage === 'live') {
      this.logger.error("unable to modify remote in-skill products in 'live' stage -> please use 'development'");
      return;
    }

    const localProducts = await this.readLocalProducts();
    const remoteProducts = await this.pullRemoteProductSummaries();

    const artifactSummary = {};

    for (let product of localProducts) {
      if (this.listContainsProduct(remoteProducts, product)) {
        this.logger.verbose(`found in-skill product '${product.referenceName}' on server, updating product ...`);
        await this.updateRemoteProduct(product, artifactSummary);
      } else {
        this.logger.verbose(`didn't find in-skill product '${product.referenceName}' on server, creating product ...`);
        await this.createRemoteProduct(product, artifactSummary);
      }
    }

    for (let remoteProduct of remoteProducts) {
      if (!this.listContainsProduct(localProducts, remoteProduct)) {
        this.logger.warning(`found in-skill product '${remoteProduct.referenceName}' on server, but not locally: deleting product ...`);
        await this.deleteRemoteProduct(remoteProduct);
      }
    }

    return this.artifacts.save('monetization', artifactSummary);
  },

  async readLocalProducts() {
    if (!fs.existsSync(this.ispDir)) {
      this.logger.log(`no ISP directory found at ${this.ispDir}, skipping monetization upload`);
      return;
    }

    this.logger.log(`reading ISP data from ${this.ispDir} ...`);

    const localProducts = [];
    const artifactSummary = this.artifacts.get('monetization');

    try {
      for (let file of fs.readdirSync(this.ispDir)) {
        if (fs.lstatSync(path.join(this.ispDir, file)).isFile()) {
          const product = {};
          product.filePath = path.join(this.ispDir, file);
          product.data = JSON.parse(fs.readFileSync(product.filePath, 'utf8'));
          product.referenceName = product.data.referenceName;
          product.productId = artifactSummary[`${product.referenceName}`] != null ? artifactSummary[`${product.referenceName}`].productId : undefined;
          localProducts.push(product);
        }
      }
    } catch (err) {
      return Promise.reject(err);
    }

    return localProducts;
  },

  listContainsProduct(list, product) {
    for (let listProduct of list) {
      if (listProduct.productId === product.productId) {
        return true;
      }
    }
    return false;
  },

  createRemoteProduct(product, artifactSummary) {
    return new Promise((resolve, reject) => {
      this.logger.log(`creating in-skill product '${product.referenceName}' from ${product.filePath} ...`);

      return this.smapi.call({
        askProfile: this.askProfile,
        command: 'create-isp',
        params: { file: product.filePath },
        logChannel: this.logger
      })
        .then(data => {
          product.productId = data.substring(data.search("amzn1"), data.search(" based"));
          artifactSummary[`${product.referenceName}`] = {
            productId: product.productId
          };
          return this.logger.verbose("successfully created product");
        }).then(() => {
          return this.associateProduct(product);
        }).then(() => resolve()).catch(err => {
          this.logger.error(`creating in-skill product '${product.referenceName}' failed with error: \
${err.message}`
          );
          return reject(err);
        });
    });
  },

  updateRemoteProduct(product, artifactSummary) {
    return new Promise((resolve, reject) => {
      const monetization = this.artifacts.get('monetization');
      if ((monetization[`${product.referenceName}`] != null ? monetization[`${product.referenceName}`].productId : undefined) == null) {
        this.logger.error(`unable to find product ID for '${product.referenceName}' in artifacts`);
        reject();
      }

      const productId = monetization[`${product.referenceName}`] != null ? monetization[`${product.referenceName}`].productId : undefined;

      this.logger.log(`updating in-skill product '${product.referenceName}' from ${product.filePath} \
...`
      );

      return this.smapi.call({
        askProfile: this.askProfile,
        command: 'update-isp',
        params: {
          'isp-id': productId,
          file: product.filePath,
          stage: this.stage
        },
        logChannel: this.logger
      })
        .then(data => {
          this.logger.verbose("successfully updated product");
          artifactSummary[`${product.referenceName}`] = {
            productId
          };
          return resolve();
        }).catch(err => {
          this.logger.error(`updating in-skill product '${product.referenceName}' failed with error: \
${err.message}`
          );
          return reject(err);
        });
    });
  },

  deleteRemoteProduct(product) {
    return new Promise((resolve, reject) => {
      return this.disassociateProduct(product)
        .then(() => {
          this.logger.log(`deleting in-skill product '${product.referenceName}' from server ...`);
          return this.smapi.call({
            askProfile: this.askProfile,
            command: 'delete-isp',
            params: {
              'isp-id': product.productId,
              stage: this.stage
            },
            logChannel: this.logger
          });
        })
        .then(data => {
          this.logger.verbose("successfully deleted product");
          return resolve();
        }).catch(err => {
          this.logger.error(`deleting in-skill product '${product.referenceName}' failed with error: \
${err.message}`
          );
          return reject(err);
        });
    });
  },

  associateProduct(product) {
    return new Promise((resolve, reject) => {
      this.logger.log(`associating in-skill product '${product.referenceName}' to skill ID \
'${this.skillId}' ...`
      );
      return this.smapi.call({
        askProfile: this.askProfile,
        command: 'associate-isp',
        params: {
          'isp-id': product.productId,
          'skill-id': this.skillId
        },
        logChannel: this.logger
      })
        .then(data => {
          this.logger.verbose("successfully associated product");
          return resolve();
        }).catch(err => {
          this.logger.error(`associating in-skill product '${product.referenceName}' failed with error: \
${err.message}`
          );
          return reject(err);
        });
    });
  },

  disassociateProduct(product) {
    return new Promise((resolve, reject) => {
      this.logger.log(`disassociating in-skill product '${product.referenceName}' from skill \
'${this.skillId}' ...`
      );
      return this.smapi.call({
        askProfile: this.askProfile,
        command: 'disassociate-isp',
        params: {
          'isp-id': product.productId,
          'skill-id': this.skillId
        },
        logChannel: this.logger
      })
        .then(data => {
          this.logger.verbose("successfully disassociated product");
          return resolve();
        }).catch(err => {
          this.logger.error(`disassociating in-skill product '${product.referenceName}' failed with error: \
${err.message}`
          );
          return reject(err);
        });
    });
  }
};
