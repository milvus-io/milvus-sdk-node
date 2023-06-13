# Using LangChain.js with Milvus

LangChain.js is a JavaScript library that provides LLMs capabilities. Milvus is an open-source vector database that enables efficient storage and retrieval of high-dimensional vectors. In this guide, we will walk you through the process of using LangChain.js with Milvus to get embeddings from OpenAI's embedding function and store the resulting vectors in Milvus for fast similarity search.

## Prerequisites

Before we begin, make sure you have the following prerequisites installed:

- Node.js: You can download and install Node.js from the official website: https://nodejs.org

## Installation

To use LangChain.js and Milvus in your project, follow these steps:

1. Create a new directory for your project:

```shell
mkdir langchain-milvus
cd langchain-milvus
```

2. Initialize a new Node.js project:

```shell
npm init -y
```

3. Install the required dependencies:

```shell
npm install langchain @zilliz/milvus2-sdk-node
```

4. Create a new JavaScript file, e.g., `index.js`, and open it in your favorite text editor.

## Usage

Now let's write the code to use LangChain.js and Milvus together.

```javascript
import { Milvus } from 'langchain/vectorstores/milvus';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';

const address = `localhost:19530`;
const username = `username`;
const password = `password`;
const ssl = false;
const openAIApiKey = `your open ai api key`;
const collectionName = 'books';

// text sample from Godel, Escher, Bach
const vectorStore = await Milvus.fromTexts(
  [
    'Tortoise: Labyrinth? Labyrinth? Could it Are we in the notorious Little\
            Harmonic Labyrinth of the dreaded Majotaur?',
    'Achilles: Yiikes! What is that?',
    'Tortoise: They say-although I person never believed it myself-that an I\
            Majotaur has created a tiny labyrinth sits in a pit in the middle of\
            it, waiting innocent victims to get lost in its fears complexity.\
            Then, when they wander and dazed into the center, he laughs and\
            laughs at them-so hard, that he laughs them to death!',
    'Achilles: Oh, no!',
    "Tortoise: But it's only a myth. Courage, Achilles.",
  ],
  [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
  new OpenAIEmbeddings({
    openAIApiKey,
  }),
  {
    collectionName,
    vectorField: 'vectors',
    url: address,
    ssl,
    username,
    password,
  }
);

const response = await vectorStore.similaritySearch('scared', 2);

console.log('response', response);
```

Save the file, and then you can run it with the following command:

```shell
node LangChain.js
```

You should see the similarity search result printed in the console.

```shell
response [
  Document {
    pageContent: 'Achilles: Oh, no!',
    metadata: { id: 442006163964035500 }
  },
  Document {
    pageContent: 'Achilles: Yiikes! What is that?',
    metadata: { id: 442006163964035460 }
  }
]
```

That's it! You have successfully used LangChain.js with Milvus to get embeddings from OpenAI's embedding function and store the resulting vectors in Milvus for similarity search.
