/* istanbul ignore file */
import { spawn } from 'child_process';
import * as path from 'path';
import { logger } from '../utils/logger';

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
  const dataPath = options.dataPath || '';
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  logger.level = options.logLevel || 'info';

  return new Promise((resolve, reject) => {
    const startPy = path.join(__dirname, 'start.py');

    logger.debug(`Starting Milvus Lite server with python script: ${startPy}`);

    const childProcess = spawn(pythonCmd, ['-u', startPy, dataPath], {});

    process.on('SIGINT', () => {
      if (childProcess) {
        logger.debug('SIGINT received, killing milvus lite server process');
        childProcess.kill('SIGINT');
      }
      process.exit();
    });

    process.on('SIGTERM', () => {
      if (childProcess) {
        logger.debug('SIGTERM received, killing milvus lite server process');
        childProcess.kill('SIGTERM');
      }
      process.exit();
    });

    process.on('exit', () => {
      if (childProcess) {
        logger.debug('Process exit, killing milvus lite server process');
        childProcess.kill();
      }
    });

    childProcess.on('error', (err: Error) => {
      logger.error(`Error starting Milvus Lite server: ${err}`);
      reject(err);
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const message = data.toString();
      logger.error(`Milvus Lite server stderr: ${message}`);
      if (message.includes("No module named 'milvus_lite'")) {
        reject(
          new Error(
            'Milvus Lite is not installed. Please install it using "pip install milvus-lite".'
          )
        );
      }
    });

    childProcess.on('exit', (code: number) => {
      logger.debug(`Milvus Lite server exited with code: ${code}`);
      if (code !== 0) {
        reject(new Error(`Milvus Lite server exited with code ${code}`));
      }
    });

    childProcess.stdout?.on('data', (data: Buffer) => {
      const message = data.toString();
      try {
        const parsed = JSON.parse(message);
        if (parsed.uri) {
          logger.debug(`Milvus Lite server started successfully:${message}}`);

          resolve({
            uri: parsed.uri,
            version: parsed.version,
            stopServer: async () => {
              if (childProcess) {
                logger.debug('Stopping Milvus Lite server');
                childProcess.kill();
              }
            },
          });
        }
      } catch (e) {
        // ignore JSON parse errors
      }
    });
  });
}
