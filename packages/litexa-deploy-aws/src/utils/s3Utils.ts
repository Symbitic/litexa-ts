/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import fs from 'fs';
import md5File from 'md5-file';
import mime from 'mime';
import { hasKeys, matchesGlobPatterns } from '../lib/utils';
import { ListBucketsOutput } from 'aws-sdk/clients/s3';

let md5FileFn = md5File;

export function validateS3BucketName(bucketName: string): void {
  const safeNameRegex = /(?=^.{3,63}$)(?!^(\d+\.)+\d+$)(^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])$)/g;
  if (!safeNameRegex.test(bucketName)) {
    throw new Error(`S3 bucket name '${bucketName}' does not follow the rules for bucket naming in https://docs.aws.amazon.com/AmazonS3/latest/dev/BucketRestrictions.html. Please rename your bucket in the Litexa config to follow these guidelines and try again.`
    );
  }
}

export function validateS3PathName(str: string): void {
  const unsafeCharacterRegex = /[^0-9a-zA-Z\_\-\.\/]/g;
  if (str.match(unsafeCharacterRegex)) {
    throw new Error(`S3 upload failed, disallowed name: \`${str}\``);
  }
}

export function prepareBucket({ s3Context, skillContext, logger }): Promise<void> {
  return skillContext.S3.listBuckets({}).promise()
    .then((data: ListBucketsOutput) => {
      for (let bucket of (data.Buckets || [])) {
        if (bucket.Name === s3Context.bucketName) {
          logger.log(`found S3 bucket ${s3Context.bucketName}`);
          return Promise.resolve();
        }
      }

      return skillContext.S3.createBucket({}).promise()
        .then(() => {
          logger.log(`created S3 bucket ${s3Context.bucketName}`);
        });
    });
}

export function collectUploadInfo({ s3Context, skillContext, logger, md5Override }) {
  md5FileFn = md5Override ? md5Override : md5File;
  logger.log("scanning assets, preparing hashes");

  s3Context.assetCount = 0;
  s3Context.deployedIconAssets = {};

  const languageInfo = skillContext.skill.projectInfo.languages;
  findAndRegisterFilesToUpload({ s3Context, languageInfo });

  if (s3Context.deployedIconAssets) {
    skillContext.artifacts.save('deployedIconAssets', s3Context.deployedIconAssets);
  }

  // Clean up deprecated artifact key, to declutter old artifacts files.
  // @TODO: This can eventually be removed.
  skillContext.artifacts.delete('required-assets');

  return logger.log(`scanned ${s3Context.assetCount} assets in project`);
};

export function findAndRegisterFilesToUpload({ s3Context, languageInfo }) {
  const assetTypes = [ 'assets', 'convertedAssets' ];

  for (let language in languageInfo) {
    const languageSummary = languageInfo[language];
    for (let assetKey of assetTypes) {
      var fileDir, fileName;
      const assets = languageSummary[assetKey];
      if (assets == null) { return; }

      for (fileName of assets.files) {
        fileDir = assets.root;
        registerFileForUpload({ s3Context, fileDir, fileName, language });
      }

      if (language !== 'default') {
        const defaultAssets = languageInfo.default[assetKey];

        // If we find default assets that aren't overridden in this language,
        // upload duplicates of the default files to this language.
        for (fileName of defaultAssets.files) {
          if (!assets.files.includes(fileName)) {
            fileDir = defaultAssets.root;
            registerFileForUpload({ s3Context, fileDir, fileName, language });
          }
        }
      }
    }
  }
};

export function registerFileForUpload({ s3Context, fileDir, fileName, language }) {
  const sourceFilePath = `${fileDir}/${fileName}`;
  s3Context.assetCount += 1;
  const s3Key = `${s3Context.baseLocation}/${language}/${fileName}`;
  validateS3PathName(s3Key);
  const md5 = md5FileFn.sync(sourceFilePath);

  s3Context.assets[s3Key] = {
    name: fileName,
    sourceFilename: sourceFilePath,
    md5,
    md5Brief: md5.slice(md5.length - 8),
    needsUpload: true,
    firstTimeUpload: true
  };

  // If we're deploying icon asset files, track them so we can use them if the user doesn't
  // specify their own icon URIs in the manifest.
  const iconFileNames = [ 'icon-108.png', 'icon-512.png' ];
  if (iconFileNames.includes(fileName)) {
    s3Context.deployedIconAssets[language] = s3Context.deployedIconAssets[language] != null ? s3Context.deployedIconAssets[language] : {};
    return s3Context.deployedIconAssets[language][fileName] = {
      url: `${s3Context.RESTRoot}/${s3Key}`,
      md5
    };
  }
};

export function listBucketAndUploadAssets({ s3Context, skillContext, logger, startToken }) {
  // Start by listing all the objects in the bucket so we get their MD5 hashes.
  // Note: Since we might have to page, this function is recursive.
  const params = {
    Prefix: s3Context.baseLocation,
    ContinuationToken: startToken || undefined,
    MaxKeys: 1000
  };

  const rangeStart = s3Context.listPage * params.MaxKeys;
  const range = `[${rangeStart}-${rangeStart + params.MaxKeys}]`;
  logger.log(`fetching S3 object metadata ${range}`);
  s3Context.listPage += 1;

  return skillContext.S3.listObjectsV2(params).promise()
    .then(data => {
      // Now we can compare each file to upload against existing uploads, to avoid spending time on
      // redundant uploads.
      for (let obj of data.Contents) {
        if (!(obj.Key in s3Context.assets)) {
          continue;
        }
        const info = s3Context.assets[obj.Key];
        info.s3MD5 = JSON.parse(obj.ETag);
        info.needsUpload = info.s3MD5 !== info.md5;
        info.firstTimeUpload = false;
      }

      // If we've paged, then also add the next page step.
      if (data.IsTruncated) {
        startToken = data.NextContinuationToken;
        return listBucketAndUploadAssets({ s3Context, skillContext, logger, startToken });
      } else {
        return uploadAssets({ s3Context, skillContext, logger });
      }
    });
};

export async function uploadAssets({ s3Context, skillContext, logger }) {
  // collect the final work list
  s3Context.uploads = [];
  s3Context.uploadIndex = 0;

  for (let key in s3Context.assets) {
    const info = s3Context.assets[key];
    if (info.needsUpload) {
      info.key = key;
      s3Context.uploads.push(info);
    } else {
      logger.verbose(`skipping ${info.name} [${info.md5Brief}]`);
    }
  }

  logger.log(`${s3Context.uploads.length} assets need uploading`);

  const assetSets = createAssetSets({ s3Context, skillContext });

  await Promise.all(assetSets.map((assetSet, i, arr) => {
    logger.verbose(`Uploading asset set ${i + 1} of ${arr.length}`);
    return uploadAssetSet({ assetSet, s3Context, skillContext, logger, fs, mime });
  }));
  return endUploadAssets({ skillContext, logger });
};

export function createAssetSets({ s3Context, skillContext }) {
  // If object properties are not defined, just put all uploadable assets into a single generic set.
  if (!(skillContext.deploymentOptions.s3Configuration != null ? skillContext.deploymentOptions.s3Configuration.uploadParams : undefined)
    || (skillContext.deploymentOptions.s3Configuration.uploadParams.length === 0)) {
    return [{ params: undefined, assets: [...s3Context.uploads] }];
  }

  let assetSets = [];
  const assetsToUpload = [ ...s3Context.uploads ];
  let defaultParams = undefined;

  for (let uploadParam of skillContext.deploymentOptions.s3Configuration.uploadParams) {

    // @TODO: A config check like this should likely be done near the beginning of the Litexa deployment process.
    if (hasKeys(uploadParam.params, ['Key', 'Body', 'ContentType', 'ACL'])) {
      throw new Error(`An upload params element in s3Configuration.uploadParams is using \
one or more reserved keys. The 'Key', 'Body', 'ContentType', and 'ACL' keys are \
all reserved by Litexa.`
      );
    }

    if (!uploadParam.filter || (uploadParam.filter && uploadParam.filter.includes('*'))) {
      defaultParams = uploadParam.params;
    } else {
      let assetSet = { params: uploadParam.params, assets: [] };
      for (let assetIndex = assetsToUpload.length - 1; assetIndex >= 0; assetIndex--) {
        const asset = assetsToUpload[assetIndex];
        if (matchesGlobPatterns(asset.name, uploadParam.filter)) {
          const tmp = assetsToUpload.splice(assetIndex, 1)[0];
          assetSet.assets = assetSet.assets.concat(tmp);
        }
      }

      if (assetSet.assets.length > 0) {
        // If the filter matched any assets, add the asset set.
        assetSets = assetSets.concat(assetSet as any);
      }
    }
  }

  // Group any remaining assets in a final set, and use default object
  // properties, if non-file-specific ones were specified.
  if (assetsToUpload.length > 0) {
    const tmp = { params: defaultParams, assets: [ ...assetsToUpload ] };
    assetSets = assetSets.concat(tmp as any);
  }

  return assetSets;
};

export function uploadAssetSet({ assetSet, s3Context, skillContext, logger, fs, mime }) {
  if (!assetSet || (assetSet.assets.length === 0)) {
    return;
  }

  let segmentPromises = [];

  const maxUploads = 5;
  for (let i = 0, end = maxUploads, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
    if (assetSet.assets.length === 0) { break; }
    const job = assetSet.assets.pop();

    const params = Object.assign({
      Key: job.key,
      Body: fs.createReadStream(job.sourceFilename),
      ContentType: mime.getType(job.sourceFilename),
      ACL: "public-read"
    }, assetSet.params);

    logger.log(`uploading ${job.name} -> ${job.key} [${job.md5Brief}]`);
    const tmp = skillContext.S3.upload(params).promise();
    segmentPromises = segmentPromises.concat(tmp);
    s3Context.uploadIndex++;
  }

  logger.log(`${s3Context.uploads.length - s3Context.uploadIndex} assets remaining in queue`);
  const startTime = new Date().getTime();
  return Promise.all(segmentPromises).then(() => {
    const finishTime = new Date().getTime();
    logger.log(`segment uploaded in ${finishTime - startTime}ms`);
    return uploadAssetSet({ assetSet, s3Context, skillContext, logger, fs, mime });
  });
};

export function endUploadAssets({ skillContext, logger }): void {
  const deltaTime = (new Date()).getTime() - skillContext.assetDeploymentStart;
  logger.log(`asset deployment complete in ${deltaTime}ms`);
};

export default {
  createAssetSets,
  collectUploadInfo,
  listBucketAndUploadAssets,
  prepareBucket,
  uploadAssetSet,
  validateS3BucketName,
  validateS3PathName
};
