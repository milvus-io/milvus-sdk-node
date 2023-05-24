const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const os = require('os');

/**
 * Function to add lines to a file at the position of a certain string
 * @param {string} filename
 * @param {string} searchString
 * @param {string} linesToAdd
 */
async function addString(filename, searchString, linesToAdd) {
  // Read the file's content
  const fileContent = await fs.readFile(filename, 'utf-8');

  // Split the file content into lines
  const lines = fileContent.split(/\r?\n/);

  // Loop over each line to add
  for (let idx = 0; idx < linesToAdd.length; idx++) {
    // Find the index of the search string and the line to add
    let searchStringIdx = lines.findIndex(line => line.includes(searchString));
    let lineIdx = lines.findIndex(line => line.includes(linesToAdd[idx]));

    // If the search string is in the file and the line to add is not
    if (searchStringIdx !== -1 && lineIdx == -1) {
      // Add the line to add at line before the line index of the search string
      lines.splice(searchStringIdx - 1, 0, linesToAdd[idx]);

      // Write the new content back to the file
      await fs.writeFile(filename, lines.join(os.EOL), 'utf-8');
    }
  }
}

/**
 * Function to replace a string in a file
 * @param {string} filename
 * @param {string} searchString
 * @param {string} replacementString
 */
async function replaceString(filename, searchString, replacementString) {
  // Read the file's content
  const fileContent = await fs.readFile(filename, 'utf-8');

  // Replace all occurrences of the search string with the replacement string
  const updatedContent = fileContent.replace(
    new RegExp(searchString, 'g'),
    replacementString
  );

  // Write the updated content back to the file
  await fs.writeFile(filename, updatedContent, 'utf-8');
}

/**
 * Function to find a file in a folder
 * @param {string} folderPath
 * @param {string} targetFileName
 * @returns final path of the GrpcClient file in node_modules
 */
function findFile(folderPath, targetFileName) {
  // Get all files in the folder
  const files = fsSync.readdirSync(folderPath);

  // Loop over each file
  for (const file of files) {
    // Get the full path of the file
    const filePath = path.join(folderPath, file);

    // Get information about the file
    const fileStat = fsSync.statSync(filePath);

    // If the file is a directory, recursively search inside it
    if (fileStat.isDirectory()) {
      const foundFilePath = findFile(filePath, targetFileName);
      if (foundFilePath) {
        return foundFilePath;
      }
    } else if (file === targetFileName) {
      // If the file is the one we're looking for, return its path
      return filePath;
    }
  }

  // Return null if the file wasn't found
  return null;
}

/**
 *
 * @param {string} ca_file_path
 * @param {string} key_file_path
 * @param {string} pem_file_path
 * @param {string} common_name
 */
async function main(
  ca_file_path = 'ca.pem',
  key_file_path = null,
  pem_file_path = null,
  common_name = 'localhost'
) {
  // Find the GrpcClient file in node_modules
  const mod_file = findFile(
    './node_modules/@zilliz/milvus2-sdk-node/dist/milvus',
    'GrpcClient.js'
  );

  // Import fs to read files using it
  await addString(mod_file, `require("./User")`, [`var fs_1 = require("fs");`]);

  // Import the certificate files and key files content
  await addString(mod_file, 'this.client = new MilvusService', [
    `var ca = fs_1.readFileSync("${ca_file_path}");`,
    key_file_path && key_file_path != null
      ? `var key = fs_1.readFileSync("${key_file_path}");`
      : `var key = null;`,
    pem_file_path && pem_file_path != null
      ? `var cert = fs_1.readFileSync("${pem_file_path}");`
      : `var cert = null;`,
  ]);

  // Set the CommonName
  await addString(mod_file, 'this.config.channelOptions', [
    `"grpc.ssl_target_name_override": "${common_name}",`,
  ]);

  // Replace blank ssl creation with ssl creation function that uses the imported certificates
  await replaceString(
    mod_file,
    'credentials.createSsl\\(\\)',
    'credentials.createSsl(ca, key, cert, true)'
  );
}

//Main uses default values when blank.
main();
