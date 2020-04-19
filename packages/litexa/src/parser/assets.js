/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const path = require('path');
const { ParserError } = require('./errors').lib;

class AssetName {
  constructor(location, name, type, skill, localFile) {
    this.location = location;
    this.name = name;
    this.type = type;
    this.skill = skill;
    if (localFile == null) { localFile = true; }
    this.localFile = localFile;
    this.isAssetName = true;
  }

  localizedFilename(language, filename) {
    if (!this.skill.projectInfo) {
      throw new Error("assetName cannot be localized because skill has no project info");
    }
    if (language == null) {
      if (this.skill.strictMode) {
        throw new Error("missing language in localizedFilename");
      } else {
        console.error("missing language in localizedFilename");
      }
      language = 'default';
    }
    const lang = this.skill.projectInfo.languages[language];
    const { assets, convertedAssets } = lang;
    const files = assets && assets.files;
    const convertedFiles = convertedAssets && convertedAssets.files;
    if (files || convertedFiles) {
      if (this.skill.projectInfo.disableAssetReferenceValidation) {
        return `${language}/${filename}`;
      }

      if (files && files.includes(filename)) {
        return `${language}/${filename}`;
      }

      if (convertedFiles && convertedFiles.includes(filename)) {
        return `${language}/${filename}`;
      }

      if (language === 'default') {
        throw new ParserError(this.location, `couldn't find an asset with the name ${filename} in the project info`);
      } else {
        return this.localizedFilename('default', filename);
      }
    } else {
      // unsupported language?
      if (language === 'default') {
        throw new Error(`no file list available somehow, while looking for ${filename}`);
      } else {
        return this.localizedFilename('default', filename);
      }
    }
  }

  toURL(language) {
    if (!this.localFile) {
      return `${this.name}`;
    }
    return this.localizedFilename(language, `${this.name}.${this.type}`);
  }

  toURLFunction(language) {
    if (!this.localFile) {
      return `${this.name}`;
    }

    const filename = this.localizedFilename(language, `${this.name}.${this.type}`);
    return ` litexa.assetsRoot + "${filename}" `;
  }

  toURLVariant(language, variant) {
    let filename;
    if (!this.localFile) {
      return `${this.name}`;
    }

    try {
      filename = this.localizedFilename(language, `${this.name}-${variant}.${this.type}`);
    } catch (error) {
      filename = null;
    }
    if (filename == null) {
      // support fallback to non-variant
      try {
        filename = this.localizedFilename(language, `${this.name}.${this.type}`);
      } catch (error1) {
        console.log(this.skill.projectInfo.languages.default);
        throw new Error(`Couldn't find variant file, nor the common version of ${this.name}.${this.type}, ${variant}`);
      }
    }
    return `${filename}`;
  }

  toURLVariantFunction(language, variant) {
    let filename;
    if (!this.localFile) {
      return ` "${this.name}" `;
    }

    try {
      filename = this.localizedFilename(language, `${this.name}-${variant}.${this.type}`);
    } catch (error) {
      filename = this.localizedFilename(language, `${this.name}.${this.type}`);
    }
    return ` litexa.assetsRoot + "${filename}" `;
  }


  hasVariant(language, variant) {
    if (!this.localFile) {
      return true;
    }

    try {
      this.localizedFilename(language, `${this.name}-${variant}.${this.type}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  toString() {
    if (!this.localFile) {
      return `${this.name}`;
    }

    return `${this.name}.${this.type}`;
  }

  toSSMLFunction(language) {
    switch (this.type) {
      case 'mp3':
        if (this.localFile) {
          return ` "<audio src='" + litexa.assetsRoot + "${this.toURL(language)}'/>" `;
        } else {
          return ` "<audio src='${this.toURL(language)}'/>" `;
        }
      default:
        throw new ParserError(this.location, `Asset type ${this.toString()} had no \
obvious way of being expressed in SSML`
        );
    }
  }

  toSSML(language) {
    switch (this.type) {
      case 'mp3':
        return `<audio src='${this.toURL(language)}'/>`;
      default:
        throw new ParserError(this.location, `Asset type ${this.toString()} had no \
obvious way of being expressed in SSML`
        );
    }
  }

  toRegex() {
    switch (this.type) {
      case 'mp3':
        //line = literalRegex("<audio src='#{@toURL()}'/>")
        var line = literalRegex(`<${this.toString()}>`);
        return line;
      default:
        throw new ParserError(this.location, `Asset type ${this.toString()} had no \
obvious way of being expressed in SSML, and so can't be tested`
        );
    }
  }
};

class FileFunctionReference {
  constructor(location, filename, functionName) {
    this.location = location;
    this.filename = filename;
    this.functionName = functionName;
    this.isFileFunctionReference = true;
  }
};

function parseJsonFile(location, filename, skill) {
  const lang = (location != null ? location.language : undefined) != null ? (location != null ? location.language : undefined) : 'default';
  const jsonPath = path.join(skill.projectInfo.languages[`${lang}`].code.root, filename);

  try {
    return require(jsonPath);
  } catch (error) {
    throw new ParserError(location, `Unable to find ${filename} at ${jsonPath}. Make sure to specify \
a path relative to the litexa folder.`
    );
  }
};

const lib = {
  AssetName,
  FileFunctionReference,
  parseJsonFile
};

module.exports = {
  lib
};
