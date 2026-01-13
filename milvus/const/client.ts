export enum METADATA {
  DATABASE = 'dbname',
  AUTH = 'authorization',
  CLIENT_ID = 'identifier',
  CLIENT_REQUEST_ID = 'client-request-id',
  CLIENT_REQUEST_UNIXMSEC = 'client-request-unixmsec',
}

export enum CONNECT_STATUS {
  NOT_CONNECTED,
  CONNECTING = 0, // GRPC channel state connecting
  CONNECTED = 1, // GRPC channel state ready
  UNIMPLEMENTED,
  SHUTDOWN = 5, // GRPC channel state shutdown
}

export enum TLS_MODE {
  DISABLED,
  ONE_WAY,
  TWO_WAY,
  UNAUTHORIZED
}
