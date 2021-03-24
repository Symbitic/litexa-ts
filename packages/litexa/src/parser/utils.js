/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

export function replaceNewlineCharacters(str, replacementCharacter) {
  return str ? str.replace(/\n/g, replacementCharacter) : '';
}

export const isEmptyContentString = str => str.trim().length === 0;

export const isFirstOrLastItemOfArray = (idx, arr) => (0 === idx) || ((arr.length - 1) === idx);

export const cleanLeadingSpaces = str => str.replace(/\n[ \t]+/g, '\n');

export const cleanTrailingSpaces = str => str.replace(/[ \t]+\n/g, '\n');

export const dedupeNonNewlineConsecutiveWhitespaces = str => str.replace(/[ \t][ \t]+/g, ' ');

// Method that stringifies a function and normalizes the indentation.
export function stringifyFunction(func, indent) {
  const funcString = func.toString();
  return normalizeIndentForStringifiedFunction(funcString, indent || '');
}

export function normalizeIndentForStringifiedFunction(funcString, indent) {
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
