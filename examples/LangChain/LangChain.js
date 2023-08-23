import { Milvus } from 'langchain/vectorstores/milvus';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';

const address = `localhot:19530`; // or your zilliz cloud endpoint
const ssl = false; // set it to true if you are using zilliz cloud
const token = 'username:passowrd or apikey'; // your zilliz cloud apikey or username:password

const openAIApiKey = ``;
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
    clientConfig: {
      address,
      ssl,
      token,
    },
  }
);

const response = await vectorStore.similaritySearch('scared', 2);

console.log('response', response);
/*
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
*/
