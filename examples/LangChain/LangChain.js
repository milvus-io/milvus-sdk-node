import { Milvus } from '@langchain/community/vectorstores/milvus';
import { Embeddings } from '@langchain/core/embeddings';

// Mock Embeddings class that generates fixed-dimension vectors without calling OpenAI API
class MockEmbeddings extends Embeddings {
  constructor(dimension = 1536) {
    super();
    this.dimension = dimension;
  }

  // Generate a simple hash-based embedding from text
  _generateEmbedding(text) {
    const hash = this._simpleHash(text);
    const vector = new Array(this.dimension).fill(0);

    // Use hash to seed random-like values for each dimension
    for (let i = 0; i < this.dimension; i++) {
      const seed = (hash + i) % 1000;
      vector[i] = (seed / 1000) * 2 - 1; // Normalize to [-1, 1]
    }

    // Normalize the vector
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );
    return vector.map(val => val / magnitude);
  }

  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async embedDocuments(texts) {
    return texts.map(text => this._generateEmbedding(text));
  }

  async embedQuery(text) {
    return this._generateEmbedding(text);
  }
}

// Use MockEmbeddings instead of OpenAIEmbeddings (no API key needed)
const embeddings = new MockEmbeddings(1536); // 1536 is the dimension for text-embedding-3-small

// Option 1: Auto-create collection using fromTexts (recommended)
// This will automatically create the collection if it doesn't exist
async function createVectorStoreWithAutoCreate() {
  const vectorStore = await Milvus.fromTexts(
    ['Sample text 1', 'Sample text 2'],
    [{ id: 1 }, { id: 2 }],
    embeddings,
    {
      url: 'your url',
      collectionName: 'books',
      textField: 'text',
      vectorField: 'vector',
      indexCreateOptions: {
        index_type: 'HNSW',
        metric_type: 'COSINE',
      },
      clientConfig: {
        token: 'your-token',
      },
    }
  );
  return vectorStore;
}

// Example usage
async function main() {
  // Use Option 1 to auto-create collection
  const vs = await createVectorStoreWithAutoCreate();
}

main().catch(console.error);
