# Milvus Node SDK - TLS Patch

This guide assumes you have already gone through the steps outlined on the [Milvus Documentation](https://milvus.io/docs/tls.md#Connect-to-the-Milvus-server-with-TLS).

This guide explains how to enable TLS based connections for the Milvus Node SDK. Support to this feature is coming soon, but in the mean time, in order to ensure secure connections you can use this patch. To achieve this, you need to execute a patch that modifies the installed `node_modules` package to support one-way and two-way TLS connections. If the packages are not present or are updated, the patch needs to be run again.

## Patch Arguments

The patch can accept the following arguments:

1. **Certificate Authority / Server Certificates (CA pem or Server Pem)**: Default value is `ca.pem`. The presence of this file is required.
2. **Client Certificates (Client Pem, and Client Key)**: Default value is `null`. The presence of both of these files is optional for one-way TLS (tlsMode 1) and required for two-way TLS (tlsMode 2).
3. **Common Name**: Default value is `localhost`.

The root of the JavaScript project is where the current working directory is set to. This means, for example, `/path/to/your/project/ca.pem` would be inputted as `ca.pem`.

## Updating Patch Arguments

### Node.js

If you are using Node.js, you can change these arguments through the main function in the `tls-patch.js` file.

### Bash Script

If you are using the bash script, you can provide the arguments as command-line options like this:

```bash
./tls-patch.sh -ca=myca.pem -key=./clientstuff/myclient.key -cert=mycert.pem -cn=mydomain.com
```

**Note:** Remember to make the bash script executable by running: `chmod +x tls-patch.sh`

## Running the Patch

You can run the patch using Node.js or bash.

### Node.js

```bash
node tls-patch.js
```

### Bash

```bash
./tls-patch.sh
```

Executing the patch script will modify the installed `node_modules` package in your project, enabling support for one-way and two-way TLS connections.

As for additional information, considering the knowledge gained from the provided code, it's important to note that this script modifies the installed `node_modules` package directly. Therefore, any updates or reinstallations of the package will necessitate re-running the patch. The patch operation is _idempotent_ - it can be executed safely multiple times.

This script is specifically designed to work with the Milvus Node SDK. Using it with other packages or in other contexts might result in unexpected behavior.

Remember to back up important files and data before running this script or similar ones that modify installed packages or software.
