import { promisify } from "../utils/index";

describe("Insert data Api", () => {
  it("Promisify should catch  obj[target] is not a function", async () => {
    let a = {};
    try {
      await promisify(a, "a", {});
      expect("a").toEqual("b");
    } catch (error) {
      expect(error.message).toContain("obj[target] is not a function");
    }
  });

  it("Promisify should catch error", async () => {
    let a = {
      a: () => {
        throw new Error("123");
      },
    };
    try {
      await promisify(a, "a", {});
      expect("a").toEqual("b");
    } catch (error) {
      expect(error.message).toContain("123");
    }
  });

  it("Promisify should reject", async () => {
    let a = {
      a: (params = {}, callback = (err: any) => {}) => {
        callback("123");
      },
    };
    try {
      await promisify(a, "a", {});
      expect("a").toEqual("b");
    } catch (error) {
      expect(error.message).toContain("123");
    }
  });
});
