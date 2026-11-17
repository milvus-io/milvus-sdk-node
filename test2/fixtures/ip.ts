// test IP
export const IP = process.env.MILVUS_ADDRESS || '127.0.0.1:29530';
export const ENDPOINT = process.env.MILVUS_HTTP_ENDPOINT || `http://${IP}`;
