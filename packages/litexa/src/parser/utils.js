/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

function replaceNewlineCharacters(str, replacementCharacter) {
  return str ? str.replace(/\n/g, replacementCharacter) : '';
}

const isEmptyContentString = str => str.trim().length === 0;

const isFirstOrLastItemOfArray = (idx, arr) => (0 === idx) || ((arr.length - 1) === idx);

const cleanLeadingSpaces = str => str.replace(/\n[ \t]+/g, '\n');

const cleanTrailingSpaces = str => str.replace(/[ \t]+\n/g, '\n');

const dedupeNonNewlineConsecutiveWhitespaces = str => str.replace(/[ \t][ \t]+/g, ' ');

// Method that stringifies a function and normalizes the indentation.
function stringifyFunction(func, indent) {
  const funcString = func.toString();
  return normalizeIndentForStringifiedFunction(funcString, indent || '');
}

function normalizeIndentForStringifiedFunction(funcString, indent) {
  // First, let's check our stringified function's indent.
  const indentMatch = funcString.match(/\n[ ]*/);
  if (indentMatch) {
    const callbackIndent = indentMatch[0].length - 3; // 3 = newline char (1) + second line indentation (2)

    // normalize the indent
    const indentRegex = new RegExp(`\n {${callbackIndent}}`, 'g');
    funcString = funcString.replace(indentRegex, `\n${indent}`);
    // normalize the function/parentheses spacing (varies between different OSs)
    return funcString = funcString.replace(/function\s+\(\)/, 'function()');
  } else {
    return funcString;
  }
}

const lib = {
  replaceNewlineCharacters,
  isEmptyContentString,
  isFirstOrLastItemOfArray,
  cleanLeadingSpaces,
  cleanTrailingSpaces,
  dedupeNonNewlineConsecutiveWhitespaces,
  stringifyFunction,
  normalizeIndentForStringifiedFunction
}

module.exports = {
  lib,
  ...lib
};
