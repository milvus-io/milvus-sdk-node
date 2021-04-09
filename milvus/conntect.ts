const path = require("path");
const protoLoader = require("@grpc/proto-loader");
const { loadPackageDefinition, credentials } = require("@grpc/grpc-js");
// import path from "path";
// import * as protoLoader from "@grpc/proto-loader";
// import { loadPackageDefinition, credentials } from "@grpc/grpc-js";

const protoPath = path.resolve(__dirname, "../grpc-proto/milvus.proto");

class MilvusNode {
  private milvusClient: any;

  /**
   * set grpc client here
   * but we not use it now, may be can use it in future.
   * @param ip milvus ip address
   */
  async setClient(ip: string) {
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const grpcObject = loadPackageDefinition(packageDefinition);
    const milvusProto = (grpcObject.milvus as any).grpc;
    const client = await new milvusProto.MilvusService(
      ip,
      credentials.createInsecure()
    );
    this.milvusClient = client;
    console.log(client);
  }
}

const instance = new MilvusNode();
instance.setClient("http://127.0.0.1:19121");
