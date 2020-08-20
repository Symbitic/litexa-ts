/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { exec } from 'child_process';

const execPromise = command => new Promise((resolve, reject) => exec(command, {}, (err, stdout, stderr) => {
  if (stderr) {
    return reject(stderr.toString());
  }
  if (err) {
    return reject(err.toString());
  }
  return resolve(stdout);
}));

export function getCurrentState() {
  const info = {};

  return execPromise('git rev-parse HEAD')
  .then(data => {
    info.currentCommitHash = data.trim();
    return execPromise('git log --format=%B  -n 1  HEAD');
  })
  .then(data => {
    // convert multiline comment into array for readability in a JSON file
    const comment = data.trim().split('\n').filter(l => l);
    info.currentCommitComment = comment;
    return execPromise('git diff --name-status HEAD');
  })
  .then(data => {
    let lines = data.split('\n');
    const typeMap = {
      D: 'deleted',
      M: 'modified',
      A: 'added'
    };

    lines = lines.map(l => {
      if (l.length > 0) {
        const parts = l.split('\t');
        const type = typeMap[parts[0]] != null ? typeMap[parts[0]] : parts[0];
        return `[${type}] ${parts[1]}`;
      }
    }).filter(l => l && l.length > 0);

    info.uncommittedChanges = lines;
    return Promise.resolve(info);
  })
  .catch(err => {
    info.currentCommit = "could not retrieve git info";
    return info.gitError = "" + err;
  });
}
