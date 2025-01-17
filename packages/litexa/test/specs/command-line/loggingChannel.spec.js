/*
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { assert } from 'chai';
import { assert as sinonAssert, match, spy, stub } from 'sinon';
import { sync } from 'rimraf';
import LoggingChannel from '../../../src/command-line/loggingChannel';

describe('LoggingChannel', () => {
  let logStream = undefined;
  let fileLogStream = undefined;
  let logSpy = undefined;
  let writeSpy = undefined;
  const logFile = 'test.log';

  const fileSystem = {
    createWriteStream() {}
  };

  beforeEach(() => {
    logStream = {
      log() {}
    };
    fileLogStream = {
      write() {}
    };
    logSpy = spy(logStream, 'log');
    writeSpy = spy(fileLogStream, 'write');
  });

  describe('#writeToOutStream', () => {
    it('writes to output', () => {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream
      });
      logger.write({ line: output });
      sinonAssert.calledWithMatch(logSpy, match(new RegExp(`^\\+[0-9]+ms ${output}$`)));
      assert(writeSpy.notCalled, 'only writes to logStream (does not write to file)');
    });

    it('writes to output with logPrefix', () => {
      const logPrefix = 'LoggingChannelTest';
      const output = 'informational';
      const logger = new LoggingChannel({
        logPrefix,
        logStream
      });
      logger.write({ line: output });
      sinonAssert.calledWithMatch(logSpy, match(new RegExp(`^\\[${logPrefix}\\] \\+[0-9]+ms ${output}$`)));
      assert(writeSpy.notCalled, 'only writes to logStream (does not write to file)');
    });

    it('applies format', () => {
      const format = spy();
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        format
      });
      logger.write({ line: output, format });
      sinonAssert.calledWithMatch(format, match.string);
    });

    it('it updates lastOutStreamTime', () => {
      const unixEpoch = Date.parse('01 Jan 1970 00:00:00 GMT');
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream
      });
      logger.write({ line: output, now: unixEpoch });
      const lastOutStreamTime = logger.lastOutStreamTime;
      assert(lastOutStreamTime === unixEpoch, 'updated lastOutStreamTime');
    });

    it('does not include a running time', () => {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        includeRunningTime: false
      });
      logger.write({ line: output });
      sinonAssert.calledWithMatch(logSpy, match(new RegExp(`^${output}$`)));
    });
  });

  describe('#writeToFile', () => {
    it('writes to a file', () => {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        logFile,
        fileSystem
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({ line: output });
      sinonAssert.calledWithMatch(writeSpy, match(new RegExp(`^\\+[0-9]+ms ${output}\\n$`)));
    });

    it('writes to a file with logPrefix', () => {
      const logPrefix = 'LoggingChannelTest';
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        logPrefix,
        logFile,
        fileSystem
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({ line: output });
      sinonAssert.calledWithMatch(writeSpy, match(new RegExp(`^\\[${logPrefix}\\] \\+[0-9]+ms ${output}\\n$`)));
    });

    it('does not write to the file when it does not have a file to write to', () => {
      let output = 'informational';
      let logger = new LoggingChannel({
        logStream,
        logFile: ' '
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({ line: output });
      assert(writeSpy.notCalled, 'does not write to file');
      writeSpy.resetHistory();

      output = 'informational';
      logger = new LoggingChannel({
        logStream,
        logFile: '',
        verbose: false
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({ line: output });
      assert(writeSpy.notCalled, 'does not write to file');
      writeSpy.resetHistory();

      output = 'informational';
      logger = new LoggingChannel({
        logStream,
        logFile: null,
        verbose: false
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({ line: output });
      assert(writeSpy.notCalled, 'does not write to file');
      writeSpy.resetHistory();

      output = 'informational';
      logger = new LoggingChannel({
        logStream,
        logFile: undefined,
        verbose: false
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({ line: output });
      assert(writeSpy.notCalled, 'does not write to file');
      writeSpy.resetHistory();
    });

    it('applies format', () => {
      const format = spy();
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        logFile,
        fileSystem
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({ line: output, format });
      sinonAssert.calledWithMatch(format, match.string);
    });

    it('updates lastFileTime', () => {
      const unixEpoch = Date.parse('01 Jan 1970 00:00:00 GMT');
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        logFile,
        fileSystem
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({ line: output, now: unixEpoch });
      const lastFileTime = logger['lastFileTime'];
      assert(lastFileTime === unixEpoch, 'updated lastFileTime');
    });

    it('does not include runningTime', () => {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        logFile,
        fileSystem,
        includeRunningTime: false
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({ line: output });
      sinonAssert.calledWithMatch(writeSpy, match(new RegExp(`^${output}\\n$`)));
    });

    it('allows for writing to a file, to be set at a later time', () => {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream
      });
      logger.write({ line: output });
      assert(writeSpy.notCalled, 'only writes to logStream (does not write to file)');

      logger.logFile = logFile;
      assert(logger['fileLogStream'], 'FileLogStream Created');
      sync(logFile);

      logger['fileLogStream'] = fileLogStream;
      logger.write({ line: output });
      sinonAssert.calledWithMatch(writeSpy, match(new RegExp(`^\\+[0-9]+ms ${output}\\n$`)));
    });
  });

  describe('#log', () => {
    it('calls write with the appropriate args', () => {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream
      });
      const writeStub = stub(LoggingChannel.prototype, 'write').callsFake(() => true);
      logger.log(output);
      writeStub.restore();
      sinonAssert.calledWithMatch(writeStub, { line: output });
    })
  });

  describe('#important', () => it('calls write with the appropriate args', () => {
    const output = 'informational';
    const logger = new LoggingChannel({
      logStream
    });
    const writeStub = stub(LoggingChannel.prototype, 'write').callsFake(() => true);
    logger.important(output);
    writeStub.restore();
    sinonAssert.calledWithMatch(writeStub, { line: output, format: match.func });
  }));

  describe('#verbose', () => {
    it('calls write with the appropriate args', () => {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream
      });
      const writeStub = stub(LoggingChannel.prototype, 'write').callsFake(() => true);
      logger.verbose(output);
      writeStub.restore();
      sinonAssert.calledWithMatch(writeStub, { line: output, format: match.func });
    });

    it('does not write to output in non-verbose mode', () => {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        verbose: false
      });
      logger.verbose({ line: output });
      assert(logSpy.notCalled, 'does not write to output stream in non-verbose mode');
    });

    it('does not write to the file in non-verbose mode', () => {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        logFile,
        fileSystem,
        verbose: false
      });
      logger['fileLogStream'] = fileLogStream;
      logger.verbose({ line: output });
      assert(writeSpy.notCalled, 'does not write to file in non-verbose mode');
    });
  });

  describe('#error', () => {
    it('calls write with the appropriate args', () => {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream
      });
      const writeStub = stub(LoggingChannel.prototype, 'write').callsFake(() => true);
      logger.error(output);
      writeStub.restore();
      sinonAssert.calledWithMatch(writeStub, { line: output, format: match.func });
    })
  });

  describe('#warning', () => {
    it('calls write with the appropriate args', () => {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream
      });
      const writeStub = stub(LoggingChannel.prototype, 'write').callsFake(() => true);
      logger.warning(output);
      sinonAssert.calledWithMatch(writeStub, { line: output, format: match.func });
      writeStub.restore();
    })
  });
});
