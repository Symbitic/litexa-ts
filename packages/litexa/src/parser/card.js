/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const { ParserError } = require('./errors').lib;

class Card {
  constructor(location, title, content, imageAssetName) {
    this.location = location;
    this.title = title;
    this.content = content;
    this.imageAssetName = imageAssetName;
    this.isCard = true;
  }

  pushAttribute(location, key, value) {
    switch (key) {
      case 'repeatSpeech':
        if (value) {
          return this.repeatSpeech = true;
        }
        break;
      case 'content':
        return this.content = value;
      case 'image':
        if (!(value.isAssetName || value.isVariableReference)) {
          throw new ParserError(location, "the `image` key expects an asset name or variable reference value, e.g. something.jpg or myVariable");
        }
        return this.imageAssetName = value;
      default:
        throw new ParserError(location, `Unknown attribute name in ${key}:${value}, expected \`content\` or \`image\``);
    }
  }

  toString() {
    return `${this.title}: ${this.content}`;
  }

  toLambda(output, indent, options) {
    var i, len, name, ref, url, variant;
    output.push(`${indent}context.card = {`);
    if (this.title) {
      output.push(`${indent}  title: ${this.title.toExpression(options)},`);
    }
    if (this.content) {
      output.push(`${indent}  content: ${this.content.toExpression(options)},`);
    } else if (this.repeatSpeech) {
      output.push(`${indent}  repeatSpeech: true`);
    }
    output.push(`${indent}};`);
    if (this.imageAssetName != null) {
      output.push(`${indent}context.card.imageURLs = {`);
      url = null;
      ref = ["cardSmall", "cardLarge"];
      for (i = 0, len = ref.length; i < len; i++) {
        variant = ref[i];
        if (this.imageAssetName.isAssetName) {
          url = this.imageAssetName.toURLVariantFunction(options.language, variant);
        } else {
          name = this.imageAssetName.toExpression(options);
          url = `litexa.assetsRoot + \"${options.language}/\" + ${name}`;
        }
        output.push(`${indent}  ${variant}: ${url}, `);
      }
      return output.push(`${indent}};`);
    }
  }

  hasStatementsOfType(types) {
    return types.indexOf('card') >= 0;
  }
};

const lib = {
  Card
};

module.exports = {
  lib,
  ...lib
};
