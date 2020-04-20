/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */
const chalk = require('chalk');
const fs = require('fs');
require('../getter.polyfill');
require('../setter.polyfill');

let identity = undefined;

class LoggingChannel {
  static initClass() {
    // Getters
    this.getter('hasPrefix', function () {
      if (this._hasPrefix) { return this._hasPrefix; }
      return this._hasPrefix = (this.options.logPrefix != null) && (typeof this.options.logPrefix === 'string') && !!(this.options.logPrefix.trim());
    });

    this.getter('canWriteToFileStream', function () {
      if (this._canWriteToFileStream && (this._canWriteToFileStreamValid != null ? this._canWriteToFileStreamValid : true)) { return this._canWriteToFileStream; }
      this._canWriteToFileStreamValid = true;
      return this._canWriteToFileStream = (this.logFile != null) && !!(this.logFile.trim());
    });

    this.getter('canWriteToLogStream', function () {
      if (this._canWriteToLogStream) { return this._canWriteToLogStream; }
      return this._canWriteToLogStream = (this.logStream != null) &&
        this.logStream.hasOwnProperty('log') &&
        (typeof this.logStream.log === 'function');
    });

    this.getter('logFile', function () {
      return this._logFile;
    });

    // Setters
    this.setter('logFile', function (logFile) {
      this._canWriteToFileStreamValid = false;
      this._logFile = logFile;
      if (!!this.canWriteToFileStream) { return this._createFileLogStream(); }
    });

    // Helper Methods
    identity = x => x;
  }

  constructor(options) {
    this.options = options;
    const {
      logStream,
      fileSystem,
      logPrefix,
      verbose,
      includeRunningTime,
      lastOutStreamTime,
      lastFileTime,
      startTime,
      logFile
    } = this.options;

    this.logStream = logStream != null ? logStream : console;
    this.fs = fileSystem || fs;

    this.logPrefix = this.hasPrefix ? `[${logPrefix}] ` : '';
    this._verbose = verbose != null ? verbose : false;
    this.includeRunningTime = includeRunningTime != null ? includeRunningTime : true;

    if (this.includeRunningTime) {
      this.lastOutStreamTime = lastOutStreamTime || new Date();
      this.lastFileTime = lastFileTime || new Date();
      this.startTime = startTime || new Date();
    }

    this.logFile = logFile;
  }

  // Public Interface
  write({ format, line, now, writeCondition }) {
    if (writeCondition == null) { writeCondition = true; }

    const args = {
      format,
      data: line,
      timeNow: now
    };

    this._write(Object.assign({
      writer: this.logStream,
      method: 'log',
      writeCondition: writeCondition && this.canWriteToLogStream,
      timeUpdated: 'lastOutStreamTime'
    }, args));

    return this._write(Object.assign({
      writer: this.fileLogStream,
      method: 'write',
      writeCondition: writeCondition && this.canWriteToFileStream,
      timeUpdated: 'lastFileTime',
      appendNewLine: true
    }, args));
  }

  log(line) {
    return this.write({
      line
    });
  }

  important(line) {
    return this.write({
      line,
      format: chalk.inverse
    });
  }

  verbose(line, obj) {
    if (obj) { line = `${line}: ${JSON.stringify(obj, null, 2)}`; }
    return this.write({
      line,
      writeCondition: this._verbose,
      format: chalk.gray
    });
  }

  error(line) {
    return this.write({
      line,
      format: chalk.red
    });
  }

  warning(line) {
    return this.write({
      line,
      format: chalk.yellow
    });
  }

  // legacy interface (are these really the responsibility of the logger?)
  derive(newPrefix) {
    const shallowCopy = Object.assign({}, this.options);
    shallowCopy.logPrefix = newPrefix;
    return new LoggingChannel(shallowCopy);
  }

  runningTime() {
    return new Date() - this.startTime;
  }

  // Private Methods
  _write({ writer, method, writeCondition, timeUpdated, format, data, timeNow, appendNewLine }) {
    if (format == null) { format = identity; }
    if (timeNow == null) { timeNow = new Date(); }

    if (writeCondition) {
      let deltaTime = undefined;

      if (this.includeRunningTime) {
        deltaTime = timeNow - this[timeUpdated];
        this[timeUpdated] = timeNow;
      }

      const formattedOutput = this._format({
        format,
        logPrefix: this.logPrefix,
        time: deltaTime,
        data,
        appendNewLine
      });
      return writer[method](formattedOutput);
    }
  }

  _format({ format, logPrefix, time, data, appendNewLine }) {
    let result = `${logPrefix}`;
    if (time != null) { result += `+${time}ms `; }
    result += `${data}`;
    result = format(result);
    if (appendNewLine) { result += '\n'; }

    return result;
  }

  _createFileLogStream() {
    return this.fileLogStream = this.fs.createWriteStream(this.logFile, { flags: 'w', encoding: 'utf8' });
  }
};

LoggingChannel.initClass();

module.exports = LoggingChannel;
