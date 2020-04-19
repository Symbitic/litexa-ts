const LoggingChannel = require('../loggingChannel');
const { spawn } = require('child_process');

/*
 * Utility function to call a SMAPI command via the `ask api` CLI.
 * @param askProfile ... required ASK profile name
 * @param command    ... required ASK API command
 * @param params     ... optional flags to send with the command
 * @param logChannel ... optional caller's LoggingChannel (derived from for SMAPI logs)
 */
module.exports = {
  call(args) {
    let k, v;
    const { askProfile, command, params } = args;
    const logger = args.logChannel ? args.logChannel.derive('smapi') : new LoggingChannel({logPrefix: 'smapi'});

    if (!command) {
      throw new Error("SMAPI called without a command. Please provide one.");
    }

    const cmd = 'ask';
    args = [ 'api', command ];

    if (!askProfile) {
      throw new Error(`SMAPI called with command '${command}' is missing an ASK profile. Please make sure you've inserted a valid askProfile in your litexa.config file.`
      );
    }

    args.push('--profile');
    args.push(askProfile);

    for (k in params) {
      v = params[k];
      args.push(`--${k}`);
      args.push(`${v}`);
    }

    return this.spawnPromise(cmd, args)
    .then(function(data) {
      if (data.stdout.toLowerCase().indexOf("command not recognized") >= 0) {
        throw new Error(`SMAPI called with command '${command}', which was reported as an invalid \
ask-cli command. Please ensure you have the latest version installed and configured \
correctly.`
        );
      }

      logger.verbose(`SMAPI ${command} stdout: ${data.stdout}`);
      logger.verbose(`SMAPI stderr: ${data.stderr}`);

      if (data.stderr && (data.stderr.indexOf('ETag') < 0)) {
        throw data.stderr;
      }
      return Promise.resolve(data.stdout);
    }).catch(function(err) {
      if (typeof(err) !== 'string') {
        if (err.message && err.message.match(/\s*Cannot resolve profile/i)) {
          throw new Error(`ASK profile '${askProfile}' not found. Make sure the profile exists and \
was correctly configured with ask init.`
          );
        } else {
          throw err;
        }
      }

      // else, err was a string which means it's the SMAPI call's stderr output
      let code = undefined;
      let message = undefined;
      try {
        const lines = err.split('\n');
        for (let line of lines) {
          var left;
          k = (left = line.split(':')[0]) != null ? left : '';
          v = (line.replace(k, '')).slice(1).trim();
          k = k.trim();

          if (k.toLowerCase().indexOf('error code') === 0) {
            code = parseInt(v);
          } else if (k === '"message"') {
            message = v.trim();
          }
        }
      } catch (error) {
        err = error;
        logger.error("failed to extract failure code and message from SMAPI call");
      }

      if (!message) {
        message = `Unknown SMAPI error during command '${command}': ${err}`;
      }

      return Promise.reject({ code, message });
    });
  },

  spawnPromise(cmd, args) {
    return new Promise((resolve, reject) => {
      const spawnedProcess = spawn(cmd, args, {shell:true});

      let stdout = '';
      let stderr = '';

      spawnedProcess.on('error', function(err) {
        if (err.code === 'ENOENT') {
          reject(new Error(`Unable to run 'ask'. Is the ask-cli installed and configured correctly?`));
        } else {
          reject(err);
        }
      });
      spawnedProcess.stdout.on('data', data => stdout += data);
      spawnedProcess.stderr.on('data', data => stderr += data);

      const resolver = () => resolve({
        stdout,
        stderr
      });

      spawnedProcess.on('exit', resolver);
      return spawnedProcess.on('close', resolver);
    });
  }
};
