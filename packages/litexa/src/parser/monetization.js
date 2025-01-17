/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { ParserError } from './errors';

export class BuyInSkillProductStatement {
  constructor(referenceName) {
    this.referenceName = referenceName;
  }

  toLambda(output, indent, options) {
    // @TODO: add warning if context.directives is not empty
    // purchase directive must be the only directive in the response
    return output.push(`${indent}buildBuyInSkillProductDirective(context, \"${this.referenceName}\");`);
  }
};

export class CancelInSkillProductStatement {
  constructor(referenceName) {
    this.referenceName = referenceName;
  }

  toLambda(output, indent, options) {
    // @TODO: add warning if context.directives is not empty
    // purchase directive must be the only directive in the response
    return output.push(`${indent}buildCancelInSkillProductDirective(context, \"${this.referenceName}\");`);
  }
};

export class UpsellInSkillProductStatement {
  constructor(referenceName) {
    this.referenceName = referenceName;
    this.attributes = { message: '' };
  }

  toLambda(output, indent, options) {
    // @TODO: add warning if context.directives is not empty
    // purchase directive must be the only directive in the response
    return output.push(`${indent}buildUpsellInSkillProductDirective(context, \"${this.referenceName}\", \"${this.attributes.message}\");`);
  }

  pushAttribute(location, key, value) {
    const supportedKeys = [ 'message' ];

    if (!Array.from(supportedKeys).includes(key)) {
      throw new ParserError(location, `Attribute '${key}' not supported > supported keys are: ${JSON.stringify(supportedKeys)}`);
    }

    return this.attributes[key] = value;
  }
};
