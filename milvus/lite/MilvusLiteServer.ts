import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface MilvusLiteServerOptions {
  dataPath?: string;
  debug?: boolean;
}

export function startMilvusLiteServer(
  options: MilvusLiteServerOptions = {}
): Promise<string> {
  const dataPath = options.dataPath || '';
  const debug = options.debug ?? false;
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  let childProcess: ChildProcess | null = null;
  let localUri = '';
  let uriFilePath: string | null = null;

  return new Promise((resolve, reject) => {
    const startPy = path.join(__dirname, 'start.py');

    if (debug) {
      console.log('Starting Milvus Lite server with python script:', startPy);
      console.log('Data path:', dataPath);
    }

    const childProcess = spawn(pythonCmd, ['-u', startPy, dataPath], {
      detached: true,
    });

    process.on('SIGINT', () => {
      if (childProcess) {
        childProcess.kill('SIGINT');
      }
      process.exit();
    });

    process.on('SIGTERM', () => {
      if (childProcess) {
        childProcess.kill('SIGTERM');
      }
      process.exit();
    });

    process.on('exit', () => {
      if (childProcess) {
        childProcess.kill();
      }
    });

    childProcess.on('error', (err: Error) => {
      if (debug) {
        console.error('Error starting Milvus Lite server:', err);
      }
      reject(err);
    });

    childProcess.on('exit', (code: number) => {
      if (debug) {
        console.log('Milvus Lite server exited with code:', code);
      }
      if (code !== 0) {
        reject(new Error(`Milvus Lite server exited with code ${code}`));
      }
    });

    childProcess.stdout?.on('data', (data: Buffer) => {
      const message = data.toString();
      try {
        const parsed = JSON.parse(message);
        if (parsed.uri) {
          localUri = parsed.uri;
          uriFilePath = parsed.uri_file_path;

          if (debug) {
            console.log('Milvus Lite server started successfully:', localUri);
          }

          resolve(parsed.uri);
        }
      } catch (e) {
        // ignore JSON parse errors
      }
    });
  });
}
