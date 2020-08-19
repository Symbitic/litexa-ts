/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { expect } from 'chai';
import { testing } from '../../../../src/command-line/deploy/manifest';

describe('Skill manifest deployment', () => {
  let sampleManifestContext: any = undefined;

  beforeEach(() => {
    return sampleManifestContext = {
      skillInfo: {
        variant_a: {
          manifest: {
            publishingInformation: {
              locales: {
                'en-US': {
                  summary: 'variant a summary'
                }
              }
            }
          }
        },
        manifest: {
          publishingInformation: {
            locales: {
              'en-US': {
                summary: 'default summary'
              }
            }
          }
        }
      }
    };
  });

  it('errors on missing manifest', () => {
    const context = {
      projectInfo: {
        variant: 'nonexistent_variant'
      }
    };
    delete sampleManifestContext.skillInfo.manifest;

    expect(sampleManifestContext.fileManifest).to.equal(undefined);
    expect(sampleManifestContext.manifest).to.equal(undefined);
    const callGetManifestFromSkillInfo = () => testing.getManifestFromSkillInfo(context, sampleManifestContext);
    expect(callGetManifestFromSkillInfo).to.throw("Didn't find a 'manifest' property");
  });

  it('retrieves deployment target-overridden manifest', async () => {
    const context = {
      projectInfo: {
        variant: 'variant_a'
      }
    };
    expect(sampleManifestContext.fileManifest).to.equal(undefined);
    await testing.getManifestFromSkillInfo(context, sampleManifestContext);
    expect(sampleManifestContext.fileManifest).to.not.equal(undefined);
    expect(sampleManifestContext.fileManifest).to.deep.equal(sampleManifestContext.skillInfo.variant_a.manifest);
  });

  it('falls back to default manifest if no target', async () => {
    const context = {
      projectInfo: {
        variant: 'nonexistent_variant'
      }
    };
    expect(sampleManifestContext.fileManifest).to.equal(undefined);
    await testing.getManifestFromSkillInfo(context, sampleManifestContext);
    expect(sampleManifestContext.fileManifest).to.not.equal(undefined);
    expect(sampleManifestContext.fileManifest).to.deep.equal(sampleManifestContext.skillInfo.manifest);
  });

  it('errors on not finding a manifest with the expected Litexa manifest schema', () => {
    const context = {
      projectInfo: {
        variant: 'nonexistent_variant'
      }
    };
    sampleManifestContext.skillInfo.manifest = undefined;

    expect(sampleManifestContext.fileManifest).to.equal(undefined);
    expect(sampleManifestContext.manifest).to.equal(undefined);
    const callGetManifestFromSkillInfo = () => testing.getManifestFromSkillInfo(context, sampleManifestContext);
    expect(callGetManifestFromSkillInfo).to.throw('skill* is neither exporting');
  });
});
