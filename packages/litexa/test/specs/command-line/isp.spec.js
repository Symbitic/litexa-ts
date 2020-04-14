/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const { expect } = require('chai');
const { assert, match, stub } = require('sinon');

const {
  Artifacts
} = require('../../../src/deployment/artifacts');
const isp = require('@src/command-line/isp');

describe('ISP', function() {
  isp.artifacts = undefined;
  isp.skillId = undefined;
  let mockArtifactSummary = undefined;
  let mockProduct = undefined;
  let smapiStub = undefined;

  beforeEach(function() {
    mockArtifactSummary = {};
    const mockArtifacts = new Artifacts(null, {
      versions: [
        {}
      ]
    });
    mockArtifacts.setVariant('development');
    mockArtifacts.save('monetization', {});

    isp.init({
      artifacts: mockArtifacts,
      logger: { log() { return undefined; } },
      root: '.',
      skillId: 'mockSkillId',
      stage: 'development'
    });

    mockProduct = {
      productId: 'mockProductId',
      referenceName: 'mockReferenceName',
      filePath: 'mockFilePath'
    };

    const fakeSmapiCall = args => Promise.resolve('{}');
    return smapiStub = stub(isp.smapi, 'call').callsFake(fakeSmapiCall);
  });

  afterEach(() => smapiStub.restore());

  it('successfully checks a list for a specific product', function() {
    const mockList = [
      {
        productId: 'otherId'
      }
    ];
    expect(isp.listContainsProduct(mockList, mockProduct)).to.be.false;

    mockList.push({
      productId: 'mockProductId'
    });
    return expect(isp.listContainsProduct(mockList, mockProduct)).to.be.true;
  });

  it('provides correct CLI args for pulling a list of remote products', async () => {
    await isp.pullRemoteProductList(mockProduct, mockArtifactSummary);

    expect(smapiStub.callCount).to.equal(1);
    return assert.calledWithMatch(smapiStub, {
      command: 'list-isp-for-skill',
      params: {
        'skill-id': isp.skillId,
        'stage': isp.stage
      }
    });
  });

  it('provides correct CLI args for retrieving definition for a product', async () => {
    await isp.getProductDefinition(mockProduct);

    expect(smapiStub.callCount).to.equal(1);
    return assert.calledWithMatch(smapiStub, {
      command: 'get-isp',
      params: {
        'isp-id': mockProduct.productId,
        'stage': isp.stage
      }
    });
  });

  it('provides correct CLI args for creating a remote product', async () => {
    isp.artifacts.save('monetization', {
      mockReferenceName: {
        productId: 'mockProductId'
      }
    });

    await isp.createRemoteProduct(mockProduct, mockArtifactSummary);

    expect(smapiStub.callCount).to.equal(2);
    assert.calledWithMatch(smapiStub.firstCall, {
      command: 'create-isp',
      params: {
        file: mockProduct.filePath
      }
    });

    return assert.calledWithMatch(smapiStub.secondCall, {
      command: 'associate-isp',
      params: {
        'isp-id': mockProduct.productId,
        'skill-id': isp.skillId
      }
    });
  });

  it('provides correct CLI args for updating a remote product', async () => {
    isp.artifacts.save('monetization', {
      mockReferenceName: {
        productId: 'mockProductId'
      }
    });

    await isp.updateRemoteProduct(mockProduct, mockArtifactSummary);

    expect(smapiStub.callCount).to.equal(1);
    assert.calledWithMatch(smapiStub, {
      command: 'update-isp',
      params: {
        'isp-id': mockProduct.productId,
        file: mockProduct.filePath,
        stage: isp.stage
      }
    });

    return expect(mockArtifactSummary).to.deep.equal({
      [mockProduct.referenceName]: {
        productId: mockProduct.productId
        }
      });
  });

  it('provides correct CLI args for disassociating and deleting a remote product', async () => {
    await isp.deleteRemoteProduct(mockProduct);

    expect(smapiStub.callCount).to.equal(2);
    assert.calledWithMatch(smapiStub.firstCall, {
      command: 'disassociate-isp',
      params: {
        'isp-id': mockProduct.productId,
        'skill-id': isp.skillId
      }
    });

    return assert.calledWithMatch(smapiStub.secondCall, {
      command: 'delete-isp',
      params: {
        'isp-id': mockProduct.productId,
        stage: isp.stage
      }
    });
  });

  return it('provides correct CLI args for associating a product', async () => {
    await isp.associateProduct(mockProduct);

    expect(smapiStub.callCount).to.equal(1);
    return assert.calledWithMatch(smapiStub, {
      command: 'associate-isp',
      params: {
        'isp-id': mockProduct.productId,
        'skill-id': isp.skillId
      }
    });
  });
});
