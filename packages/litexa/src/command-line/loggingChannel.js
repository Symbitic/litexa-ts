/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */
import chalk from 'chalk';
import fs from 'fs';

export default class LoggingChannel {
  get hasPrefix() {
    if (this._hasPrefix) {
      return this._hasPrefix;
    }
    return this._hasPrefix = (typeof this.options.logPrefix === 'string' && !!this.options.logPrefix.trim());
  }

  get canWriteToFileStream() {
    if (this._canWriteToFileStream && (this._canWriteToFileStreamValid != null ? this._canWriteToFileStreamValid : true)) {
      return this._canWriteToFileStream;
    }
    this._canWriteToFileStreamValid = true;
    return this._canWriteToFileStream = (this.logFile != null && !!this.logFile.trim());
  }

  get canWriteToLogStream() {
    if (this._canWriteToLogStream) {
      return this._canWriteToLogStream;
    }
    return this._canWriteToLogStream = (this.logStream &&
      this.logStream.hasOwnProperty('log') &&
      typeof this.logStream.log === 'function');
  }

  get logFile() {
    return this._logFile;
  }

  set logFile(file) {
    this._canWriteToFileStreamValid = false;
    this._logFile = file;
    if (!!this.canWriteToFileStream) {
      this._createFileLogStream();
    }
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
    if (writeCondition == null) {
      writeCondition = true;
    }

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
    if (format == null) { format = x => x; }
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
