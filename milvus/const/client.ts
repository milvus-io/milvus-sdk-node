export enum METADATA {
  DATABASE = 'dbname',
  AUTH = 'authorization',
  CLIENT_ID = 'identifier',
}

export enum CONNECT_STATUS {
  NOT_CONNECTED,
  CONNECTING,
  CONNECTED,
  UNIMPLEMENTED,
}

export enum TLS_MODE {
  DISABLED,
  ONE_WAY,
  TWO_WAY,
}
