/* istanbul ignore file */
import { spawn } from 'child_process';
import * as path from 'path';
import { logger } from '../utils/logger'; // Assuming logger is correctly set up

export interface MilvusLiteServerOptions {
  dataPath?: string;
  logLevel?: string;
}

type MilvusLiteServerResponse = {
  uri: string;
  version: string;
  stopServer: () => Promise<void>;
};

export function startMilvusLiteServer(
  options: MilvusLiteServerOptions = {}
): Promise<MilvusLiteServerResponse> {
  const dataPath = options.dataPath || ''; // Python script defaults to 'test.db' if this is empty
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  // Ensure logger level is set if provided
  if (options.logLevel) {
    logger.level = options.logLevel;
  } else {
    // Default logger level if not set (optional, depends on your logger's default)
    // logger.level = 'info';
  }

  return new Promise((resolve, reject) => {
    const startPy = path.join(__dirname, 'start.py'); // Ensure 'start.py' is in the same directory or adjust path

    logger.debug(
      `Starting Milvus Lite server with python script: ${startPy} using ${pythonCmd}`
    );
    if (dataPath) {
      logger.debug(`Data path for Milvus Lite: ${dataPath}`);
    } else {
      logger.debug(`No data path specified, Milvus Lite will use its default.`);
    }

    const childProcess = spawn(pythonCmd, ['-u', startPy, dataPath], {
      // stdio: ['pipe', 'pipe', 'pipe'] // Default, but can be explicit
    });

    let promiseSettled = false;

    const settlePromise = (settler: () => void) => {
      if (!promiseSettled) {
        promiseSettled = true;
        settler();
      }
    };

    // Graceful shutdown signal handling for the parent Node.js process
    const signalHandler = (signal: string) => {
      logger.debug(
        `${signal} received for parent process, attempting to stop Milvus Lite server.`
      );
      if (childProcess && !childProcess.killed) {
        childProcess.kill(signal === 'SIGINT' ? 'SIGINT' : 'SIGTERM'); // Forward the signal
      }
      // process.exit(); // Exiting the parent process should be handled by the caller or signal default behavior
    };

    process.on('SIGINT', () => signalHandler('SIGINT'));
    process.on('SIGTERM', () => signalHandler('SIGTERM'));
    // The 'exit' handler for the parent process might be too late or might not run for all exit types.
    // It's generally better to ensure resources are cleaned up on signals or before explicit exit.
    process.on('exit', () => {
      if (childProcess && !childProcess.killed) {
        logger.debug(
          'Node.js process exiting, ensuring Milvus Lite server process is killed.'
        );
        childProcess.kill(); // Default SIGTERM
      }
    });

    childProcess.on('error', (err: Error) => {
      logger.error(
        `Failed to start Milvus Lite server process: ${err.message}`
      );
      settlePromise(() => reject(err)); // e.g., python command not found
    });

    childProcess.stdout?.on('data', (data: Buffer) => {
      const messages = data
        .toString()
        .split('\n')
        .filter(msg => msg.trim() !== '');
      messages.forEach(message => {
        logger.debug(`Milvus Lite stdout: ${message}`);
        try {
          const parsed = JSON.parse(message);

          if (parsed.error) {
            logger.error(`Error from Milvus Lite script: ${parsed.error}`);
            settlePromise(() => reject(new Error(parsed.error)));
            if (childProcess && !childProcess.killed) {
              childProcess.kill(); // Kill the process as it reported a fatal error
            }
          } else if (parsed.uri && parsed.version) {
            logger.debug(
              `Milvus Lite server started. URI: ${parsed.uri}, Version: ${parsed.version}`
            );
            settlePromise(() =>
              resolve({
                uri: parsed.uri,
                version: parsed.version,
                stopServer: async () => {
                  return new Promise<void>(resolveStop => {
                    if (childProcess && !childProcess.killed) {
                      logger.debug(
                        'StopServer: Sending SIGINT to Milvus Lite server...'
                      );
                      // Handle stop confirmation
                      let stopTimeout: NodeJS.Timeout | null = null;
                      const onStopExit = (
                        code: number | null,
                        signal: NodeJS.Signals | null
                      ) => {
                        if (stopTimeout) clearTimeout(stopTimeout);
                        logger.debug(
                          `Milvus Lite server process stopped. Code: ${code}, Signal: ${signal}`
                        );
                        resolveStop();
                      };
                      childProcess.once('exit', onStopExit);
                      childProcess.kill('SIGINT'); // Python script handles SIGINT to stop server_manager_instance

                      // Timeout to force kill if SIGINT doesn't work
                      stopTimeout = setTimeout(() => {
                        if (childProcess && !childProcess.killed) {
                          logger.warn(
                            'Milvus Lite server did not stop with SIGINT in 5s, sending SIGKILL.'
                          );
                          childProcess.kill('SIGKILL');
                          // Resolve a bit later to allow SIGKILL to process, though 'exit' should still fire
                          setTimeout(resolveStop, 200);
                        }
                      }, 5000);
                    } else {
                      logger.debug(
                        'StopServer: Milvus Lite server already stopped or not running.'
                      );
                      resolveStop();
                    }
                  });
                },
              })
            );
          } else if (parsed.info) {
            logger.info(`Info from Milvus Lite script: ${parsed.info}`);
          }
          // Ignore other JSON messages if any, or add more specific handling
        } catch (e) {
          // This means the line was not JSON. It might be other debug output from Python.
          logger.debug(`Non-JSON stdout from Milvus Lite script: ${message}`);
        }
      });
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const errMessage = data.toString().trim();
      logger.error(`Milvus Lite stderr: ${errMessage}`);
      // Generally, errors from Python script that cause it to exit will also result in a non-zero exit code.
      // You could choose to reject here if stderr always indicates a fatal error for your script.
      // However, be cautious not to reject twice if stdout or exit handler already does.
      // For now, just logging it. The exit handler will catch failures.
    });

    childProcess.on(
      'exit',
      (code: number | null, signal: NodeJS.Signals | null) => {
        logger.debug(
          `Milvus Lite server process exited with code: ${code}, signal: ${signal}`
        );
        if (!promiseSettled) {
          // If promise hasn't been resolved (e.g. with URI) or rejected (e.g. by JSON error)
          let exitErrorMsg = 'Milvus Lite server process exited prematurely.';
          if (signal) {
            exitErrorMsg = `Milvus Lite server process was terminated by signal: ${signal}.`;
          } else if (code !== null && code !== 0) {
            exitErrorMsg = `Milvus Lite server process exited with error code: ${code}.`;
          } else if (code === 0) {
            // Exited cleanly but didn't resolve the promise (e.g. no URI sent)
            exitErrorMsg =
              'Milvus Lite server process exited cleanly but did not report a URI.';
          }
          logger.error(exitErrorMsg + ' Check logs for more details.');
          settlePromise(() => reject(new Error(exitErrorMsg)));
        }
      }
    );
  });
}
