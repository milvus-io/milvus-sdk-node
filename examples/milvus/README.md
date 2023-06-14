# Milvus SDK Node Examples

This folder contains code examples that demonstrate the usage of the Milvus SDK Node. These examples showcase various functionalities and features of the Milvus SDK.

## Prerequisites

Before running the examples, make sure you have the following prerequisites installed:

- [Node.js](https://nodejs.org) (version 12 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

## Installation

To install the Milvus SDK Node and its dependencies, run the following command in the terminal:

```shell
npm install
```

This will download and install all the required packages specified in the `package.json` file.

## Running the Examples

To run each example file, you can use [`ts-node`](https://github.com/TypeStrong/ts-node). The [`ts-node`](https://github.com/TypeStrong/ts-node) package allows you to execute TypeScript files directly without the need for manual compilation.

In the terminal, navigate to the directory containing the example file you want to run, and then execute the following command:

```shell
ts-node <example_file_name>.ts
```

Replace `<example_file_name>` with the name of the example file you want to run (e.g., `HelloMilvus.ts`).

Running the above command will execute the example and produce the corresponding output, demonstrating the functionality being showcased.

## List of Examples

Here is a list of some examples in this folder:

- `HellowMilvus.ts`: This example demonstrates the basic operations with Milvus, such as creating a collection, inserting vectors, and performing simple queries.
- `DataQuery.ts`: This example demonstrates how to query data from Milvus.
- `DynamicSchema.ts`: This example demonstrates how to use the dynamic schema feature of Milvus.
- `Database.ts`: This example demonstrates how to use the database feature of Milvus.
- `PartitionKey.ts`: This example demonstrates how to use the partition key feature of Milvus.

Feel free to explore the examples and modify them to suit your specific use cases.

## Troubleshooting

If you encounter any issues while running the examples or have any questions, please refer to the [Milvus SDK Node documentation](https://milvus.io/api-reference/node/v2.2.x/About.md) or [raise an issue](https://github.com/milvus-io/milvus-sdk-node/issues) in the official Milvus SDK Node repository.

## Contributing

If you would like to contribute to the Milvus SDK Node or report any bugs or feature requests, please refer to the [contribution guidelines](https://github.com/milvus-io/milvus-sdk-node/blob/main/CONTRIBUTING.md) in the official repository.

Happy coding with Milvus SDK Node!
