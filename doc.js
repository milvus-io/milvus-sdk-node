const fs = require("fs");

const formatDoc = async () => {
  fs.unlinkSync("./docs/index.html");
  fs.unlinkSync("./docs/modules.html");
  fs.mkdirSync("./docs/api");
  fs.renameSync(
    "./docs/modules/documentation.html",
    "./docs/api/documentation.html"
  );
  fs.rmdirSync("./docs/modules", { recursive: true });
};

formatDoc();
