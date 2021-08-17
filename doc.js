const fs = require("fs");
const path = require("path");
/**
 * Remove modules folder , modules.html, index.html
 * Move documentation.html to api reference folder
 *
 */
const formatDoc = async () => {
  fs.unlinkSync("./docs/modules.html");
  fs.mkdirSync("./docs/Api Reference");
  fs.renameSync("./docs/index.html", "./docs/tutorial.html");

  fs.rmdirSync("./docs/modules", { recursive: true });

  const source = "./docs/classes";
  let files = fs.readdirSync(source);
  files.forEach(function (file) {
    let curSource = path.join(source, file);
    const name = file
      .split(".")
      .filter((v, i) => i !== 1)
      .join(".");
    fs.renameSync(
      curSource,
      `./docs/APi Reference/${
        name === "milvusindex.html" ? "index.html" : name
      }`
    );
  });
  fs.rmdirSync("./docs/classes", { recursive: true });
};

formatDoc();
