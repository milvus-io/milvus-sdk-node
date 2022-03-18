const fs = require("fs");
const path = require("path");
const packageJson = require("./package.json");

function copyFileSync(source, target) {
  let targetFile = target;

  // If target is a directory, a new file with the same name will be created
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source));
    }
  }

  fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync(source, target) {
  let files = [];
  if (!fs.existsSync(target)){
    fs.mkdirSync(target, { recursive: true });
}
  // Check if folder needs to be created or integrated
  let targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder);
  }

  // Copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach(function (file) {
      let curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        copyFileSync(curSource, targetFolder);
      }
    });
  }
}

function removeDistPackageJson(source) {
  try {
    if (fs.existsSync(source)) {
      fs.unlinkSync(source);
    }
    //file removed
  } catch (err) {
    console.error(err);
  }
}

function writeSdkJson(path) {
  try {
    const version = packageJson.version;
    const milvusVersion = packageJson.milvusVersion;

    const content = {
      version,
      milvusVersion,
    };
    let data = JSON.stringify(content);
    fs.writeFileSync(path, data);
  } catch (err) {
    throw new Error(err);
  }
}

copyFolderRecursiveSync("./proto/proto", "./dist/proto");

// if dist has package.json need delete it.
// otherwise npm publish will use package.json inside dist then will missing files.
removeDistPackageJson("./dist/package.json");

// Because of we dont need package.json in dist folder, so we can write sdk info into sdk.json file.
writeSdkJson("./dist/sdk.json");
