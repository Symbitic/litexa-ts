/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

/*

 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * Copyright 2019 Amazon.com (http://amazon.com/), Inc. or its affiliates. All Rights Reserved.
 * These materials are licensed as 'Restricted Program Materials' under the Program Materials
 * License Agreement (the 'Agreement') in connection with the Amazon Alexa voice service.
 * The Agreement is available at https://developer.amazon.com/public/support/pml.html.
 * See the Agreement for the specific terms and conditions of the Agreement. Capitalized
 * terms not defined in this file have the meanings given to them in the Agreement.
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

*/

const {assert} = require('chai');
const {assert: sinonAssert, match, spy, stub} = require('sinon');
const rimraf = require('rimraf');

const LoggingChannel = require('@src/command-line/loggingChannel');

describe('LoggingChannel', function() {
  let logStream = undefined;
  let fileLogStream = undefined;
  let logSpy = undefined;
  let writeSpy = undefined;
  const logFile = 'test.log';
  const fileSystem = {
    createWriteStream() {}
  };

  beforeEach(function() {
    logStream = {
      log() {}
    };
    fileLogStream = {
      write() {}
    };
    logSpy = spy(logStream, 'log');
    return writeSpy = spy(fileLogStream, 'write');
  });

  describe('#writeToOutStream', function() {
    it('writes to output', function() {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream
      });
      logger.write({line:output});
      sinonAssert.calledWithMatch(logSpy, match(new RegExp(`^\\+[0-9]+ms ${output}$`)));
      return assert(writeSpy.notCalled, 'only writes to logStream (does not write to file)');
    });

    it('writes to output with logPrefix', function() {
      const logPrefix = 'LoggingChannelTest';
      const output = 'informational';
      const logger = new LoggingChannel({
        logPrefix,
        logStream
      });
      logger.write({line:output});
      sinonAssert.calledWithMatch(logSpy, match(new RegExp(`^\\[${logPrefix}\\] \\+[0-9]+ms ${output}$`)));
      return assert(writeSpy.notCalled, 'only writes to logStream (does not write to file)');
    });


    it('applies format', function() {
      const format = spy();
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        format
      });
      logger.write({line:output, format});
      return sinonAssert.calledWithMatch(format, match.string);
    });

    it('it updates lastOutStreamTime', function() {
      const unixEpoch = Date.parse('01 Jan 1970 00:00:00 GMT');
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream
      });
      logger.write({line:output, now: unixEpoch});
      const lastOutStreamTime = logger['lastOutStreamTime'];
      return assert(lastOutStreamTime === unixEpoch, 'updated lastOutStreamTime');
    });

    return it('does not include a running time', function() {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        includeRunningTime: false
      });
      logger.write({line:output});
      return sinonAssert.calledWithMatch(logSpy, match(new RegExp(`^${output}$`)));
    });
  });

  describe('#writeToFile', function() {
    it('writes to a file', function() {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        logFile,
        fileSystem
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({line:output});
      return sinonAssert.calledWithMatch(writeSpy, match(new RegExp(`^\\+[0-9]+ms ${output}\\n$`)));
    });

    it('writes to a file with logPrefix', function() {
      const logPrefix = 'LoggingChannelTest';
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        logPrefix,
        logFile,
        fileSystem
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({line:output});
      return sinonAssert.calledWithMatch(writeSpy, match(new RegExp(`^\\[${logPrefix}\\] \\+[0-9]+ms ${output}\\n$`)));
    });

    it('does not write to the file when it does not have a file to write to', function() {
      let output = 'informational';
      let logger = new LoggingChannel({
        logStream,
        logFile: ' '
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({line:output});
      assert(writeSpy.notCalled, 'does not write to file');
      writeSpy.resetHistory();

      output = 'informational';
      logger = new LoggingChannel({
        logStream,
        logFile: '',
        verbose: false
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({line:output});
      assert(writeSpy.notCalled, 'does not write to file');
      writeSpy.resetHistory();

      output = 'informational';
      logger = new LoggingChannel({
        logStream,
        logFile: null,
        verbose: false
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({line:output});
      assert(writeSpy.notCalled, 'does not write to file');
      writeSpy.resetHistory();

      output = 'informational';
      logger = new LoggingChannel({
        logStream,
        logFile: undefined,
        verbose: false
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({line:output});
      assert(writeSpy.notCalled, 'does not write to file');
      return writeSpy.resetHistory();
    });

    it('applies format', function() {
      const format = spy();
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        logFile,
        fileSystem
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({line:output, format});
      return sinonAssert.calledWithMatch(format, match.string);
    });

    it('updates lastFileTime', function() {
      const unixEpoch = Date.parse('01 Jan 1970 00:00:00 GMT');
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        logFile,
        fileSystem
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({line:output, now: unixEpoch});
      const lastFileTime = logger['lastFileTime'];
      return assert(lastFileTime === unixEpoch, 'updated lastFileTime');
    });

    it('does not include runningTime', function() {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        logFile,
        fileSystem,
        includeRunningTime: false
      });
      logger['fileLogStream'] = fileLogStream;
      logger.write({line:output});
      return sinonAssert.calledWithMatch(writeSpy, match(new RegExp(`^${output}\\n$`)));
    });

    return it('allows for writing to a file, to be set at a later time', function() {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream
      });
      logger.write({line:output});
      assert(writeSpy.notCalled, 'only writes to logStream (does not write to file)');

      logger.logFile = logFile;
      assert(logger['fileLogStream'], 'FileLogStream Created');
      rimraf.sync(logFile);

      logger['fileLogStream'] = fileLogStream;
      logger.write({line:output});
      return sinonAssert.calledWithMatch(writeSpy, match(new RegExp(`^\\+[0-9]+ms ${output}\\n$`)));
    });
  });

  describe('#log', () => it('calls write with the appropriate args', function() {
    const output = 'informational';
    const logger = new LoggingChannel({
      logStream
    });
    const writeStub = stub(LoggingChannel.prototype, 'write').callsFake(() => true);
    logger.log(output);
    writeStub.restore();
    return sinonAssert.calledWithMatch(writeStub, {line: output});
  }));

  describe('#important', () => it('calls write with the appropriate args', function() {
    const output = 'informational';
    const logger = new LoggingChannel({
      logStream
    });
    const writeStub = stub(LoggingChannel.prototype, 'write').callsFake(() => true);
    logger.important(output);
    writeStub.restore();
    return sinonAssert.calledWithMatch(writeStub, {line: output, format: match.func});
  }));

  describe('#verbose', function() {
    it('calls write with the appropriate args', function() {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream
      });
      const writeStub = stub(LoggingChannel.prototype, 'write').callsFake(() => true);
      logger.verbose(output);
      writeStub.restore();
      return sinonAssert.calledWithMatch(writeStub, {line: output, format: match.func});
    });

    it('does not write to output in non-verbose mode', function() {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        verbose: false
      });
      logger.verbose({line:output});
      return assert(logSpy.notCalled, 'does not write to output stream in non-verbose mode');
    });

    return it('does not write to the file in non-verbose mode', function() {
      const output = 'informational';
      const logger = new LoggingChannel({
        logStream,
        logFile,
        fileSystem,
        verbose: false
      });
      logger['fileLogStream'] = fileLogStream;
      logger.verbose({line:output});
      return assert(writeSpy.notCalled, 'does not write to file in non-verbose mode');
    });
  });

  describe('#error', () => it('calls write with the appropriate args', function() {
    const output = 'informational';
    const logger = new LoggingChannel({
      logStream
    });
    const writeStub = stub(LoggingChannel.prototype, 'write').callsFake(() => true);
    logger.error(output);
    writeStub.restore();
    return sinonAssert.calledWithMatch(writeStub, {line: output, format: match.func});
  }));

  return describe('#warning', () => it('calls write with the appropriate args', function() {
    const output = 'informational';
    const logger = new LoggingChannel({
      logStream
    });
    const writeStub = stub(LoggingChannel.prototype, 'write').callsFake(() => true);
    logger.warning(output);
    sinonAssert.calledWithMatch(writeStub, {line: output, format: match.func});
    return writeStub.restore();
  }));
});
