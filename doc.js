const fs = require("fs");

const formatDoc = async () => {
  fs.unlinkSync("./docs/index.html");
  fs.unlinkSync("./docs/modules.html");
  fs.mkdirSync("./docs/Api Reference");
  fs.renameSync(
    "./docs/modules/documentation.html",
    "./docs/Api Reference/documentation.html"
  );
  fs.rmdirSync("./docs/modules", { recursive: true });
};

formatDoc();
