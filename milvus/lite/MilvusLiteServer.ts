import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface MilvusLiteServerOptions {
  dataPath?: string;
  debug?: boolean;
}

export interface MilvusLiteServerInstance {
  stop: () => Promise<void>;
  getUri: () => string;
}

export function startMilvusLiteServer(
  options: MilvusLiteServerOptions = {}
): Promise<MilvusLiteServerInstance> {
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

    childProcess = spawn(pythonCmd, ['-u', startPy, dataPath], {
      detached: true,
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
      if (debug) {
        console.log('Milvus Lite server stdout:', message);
      }
    });

    let uriFileFound = false;

    const checkUriFile = () => {
      const possiblePaths = [path.join(os.homedir(), 'milvus_lite_uri.json')];

      for (const filePath of possiblePaths) {
        try {
          if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(data);
            if (parsed.uri) {
              uriFilePath = filePath;
              localUri = parsed.uri;

              try {
                // check if the uri is valid
                fs.accessSync(localUri.replace('unix:', ''), fs.constants.R_OK);

                if (debug) {
                  console.log(`Found URI file at ${filePath}:`, localUri);
                  console.log('Full content:', parsed);
                  console.log('Server started successfully');
                }

                resolve({
                  stop: () => stopServer(childProcess, uriFilePath, debug),
                  getUri: () => localUri,
                });
                uriFileFound = true;
              } catch (e) {
                if (debug) {
                  console.error(`Error accessing URI file ${filePath}:`, e);
                }
                continue;
              }
            }
          }
        } catch (e) {
          if (debug) {
            console.error(`Error reading URI file ${filePath}:`, e);
          }
        }
      }

      if (!uriFileFound) {
        setTimeout(checkUriFile, 500);
      }
    };

    checkUriFile();
  });
}

async function stopServer(
  childProcess: ChildProcess | null,
  uriFilePath: string | null,
  debug: boolean
): Promise<void> {
  if (!childProcess) return;

  return new Promise(resolve => {
    childProcess.kill('SIGTERM');

    if (uriFilePath) {
      try {
        fs.unlinkSync(uriFilePath);
        if (debug) {
          console.log(`Removed URI file: ${uriFilePath}`);
        }
      } catch (e) {
        if (debug) {
          console.error(`Failed to remove URI file: ${e}`);
        }
      }
    }

    resolve();
  });
}
