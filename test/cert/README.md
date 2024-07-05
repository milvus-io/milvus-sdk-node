# Milvus TLS Guide

This guide describes how to enable TLS proxy in Milvus for the Milvus Node SDK.

## Step 1: Install Milvus in Docker and Identify the Mounted Folder

```bash
$ cd ~
$ curl -sfL https://raw.githubusercontent.com/milvus-io/milvus/master/scripts/standalone_embed.sh -o standalone_embed.sh

# Start the Docker container
$ bash standalone_embed.sh start

# Get mounted info
$ docker inspect -f '{{ json .Mounts }}' milvus-standalone | jq .
[
  {
    "Type": "bind",
    "Source": "/Users/zilliz/workspace/embedEtcd.yaml",
    "Destination": "/milvus/configs/embedEtcd.yaml",
    "Mode": "",
    "RW": true,
    "Propagation": "rprivate"
  },
  {
    "Type": "bind",
    "Source": "/Users/zilliz/workspace/user.yaml",
    "Destination": "/milvus/configs/user.yaml",
    "Mode": "",
    "RW": true,
    "Propagation": "rprivate"
  },
  {
    "Type": "bind",
    "Source": "/Users/zilliz/workspace/volumes/milvus",
    "Destination": "/var/lib/milvus",
    "Mode": "",
    "RW": true,
    "Propagation": "rprivate"
  }
]

```

Please remember these two mounts:

1. /Users/zilliz/workspace/user.yaml
2. /Users/zilliz/workspace/volumes/milvus

## Step 2: Generate Certificate Files

More detail please refer to [Create your own certificate](https://milvus.io/docs/tls.md#Create-your-own-certificate)

Or you can just clone this repo, and execute [this file](./gen.sh):

```bash
% ./gen.sh                                                                                           [0]
generate ca.key
generate ca.pem
generate server SAN certificate
....+.........+......+....+........+...+.+++++++++++++++++++++++++++++++++++++++*....+.....+.+............+..+....+..+.......+........+....+...+.....+++++++++++++++++++++++++++++++++++++++*.............+.+......+...+.....+......+.+..+...+.............+..........................+.........+......+.+..............+.+............+...+.....+...+....+..+....+..+.........+......+...+.+...+.....+......+.+...+...+..............+.+............+..+.+........+....+...+.................+..........+......+.....+.......+..+..........+..+.+.........+........+.............+..+...+.......+..+.+.................+.+..+.......+...........+..........+..+.......+......+...........+....+.....+.+...+..+......+....+.....+.+............+.....+.+..+....+...........+...+.+...+...+..+.+......+.....+.........+.+.........+...........+......+..................+....+..+.+............+..+...+...............+.+.....+..........+............+..+......+......+...+...+...............+.........+......+....+.........+.........+...+..+.......+...+..+..........+......+.................+......+........................+.+..+.........+......+....+........+......+.+.......................+...+..........+.....+.........+.........+......+.............+..+...+...+.......+......+......+.....+.+........+............+....+......+........+.+...+..+.............+...+..+.+......+..............+.......+..+...+...+.+...+......+......+...........+.........................+............+..+.+..+.......+........+.+..+.............+......+...+.....+.............+..+......+............+...+....+...+...+.....+......+.+...+.........+..+......+...+....+...+..+.+..+..................+.+.....+....+..+...+......+...+...+.......+...+...+..+...+............+....+...+............+...+...........+....+...........+.+.....+.+...+..+...+......+.+..............+..............................+...+.............+.........+.....+.+...+..............+.+.........+..+............................+........+....+.....+...+.+......+...+...+...+..+...+.........+.+.....+.......+............+...+...........................+..+.+..+...............+.............+........+.+...+..+...+.......+...............+.....+......+...+.+...+..+.+.....+.........+...+...+.............+......+......+..+......+......+.+..+.............+..+.++++++
.+..........+...+......+.....+...+.+..+.........+...+.......+..............+....+...+...+..+....+...+++++++++++++++++++++++++++++++++++++++*....+...+....+........+.......+...+..+++++++++++++++++++++++++++++++++++++++*......++++++
Ignoring -days without -x509; not generating a certificate
Certificate request self-signature ok
subject=C=CN, O=milvus, OU=milvus, CN=localhost
generate client SAN certificate
......+......+.....+++++++++++++++++++++++++++++++++++++++*..+.......+.....+.+..+...+....+..+++++++++++++++++++++++++++++++++++++++*...............+...+....+...+...+..+....+......+.........+......+..+...+...+................+...+........+...+......++++++
....+....+...+..+.+...+.....+.........+.+......+...+++++++++++++++++++++++++++++++++++++++*.+........+.+......+..+.+.........+...+..+......+.+++++++++++++++++++++++++++++++++++++++*...+...+..+.+.....+.......+.....+...+....+........+...+.......+......+......+...+............+......+............+...........+.+...+..+......+............+............+.........+............++++++
Ignoring -days without -x509; not generating a certificate
Certificate request self-signature ok
subject=C=CN, O=milvus, OU=milvus, CN=localhost
```

## Step 3: Copy the Generated Certificate Files to the Mounted Folder

```bash
# create a tls folder
mkdir -p /Users/zilliz/workspace/volumes/milvus/tls
# copy certs file
cp server.csr server.key server.pem ca.pem /Users/zilliz/workspace/volumes/milvus/tls/
```

## Step 4: Modify user.yaml to Override Milvus TLS Settings

```yaml
# Extra config to override default milvus.yaml
tls:
  serverPemPath: /var/lib/milvus/tls/server.pem
  serverKeyPath: /var/lib/milvus/tls/server.key
  caPemPath: /var/lib/milvus/tls/ca.pem

common:
  security:
    tlsMode: 2
```

## Step 5: Restart Your Milvus Container and Run the Tests

```bash
# restart milvus container
docker restart milvus-standalone
```

```javascript
const mc = new MilvusClient({
  address: 'https://localhost:19530',
  tls: {
    rootCertPath: `test/cert/ca.pem`,
    privateKeyPath: `test/cert/client.key`,
    certChainPath: `test/cert/client.pem`,
    serverName: `localhost`,
  },
  logLevel: `debug`, // optional
});

const healthy = await mc.checkHealth();
expect(healthy.isHealthy).toEqual(true);
```
