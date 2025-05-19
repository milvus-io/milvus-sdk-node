'use client';

import { useState, useEffect } from 'react';

// Fetch collections from API
async function fetchCollections() {
  const res = await fetch('/api/milvus/collections');
  const data = await res.json();
  return data.collections;
}

// Create collection via API
async function createCollection(collectionName?: string) {
  const res = await fetch('/api/milvus/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(collectionName ? { collectionName } : {}),
  });
  const data = await res.json();
  return data.result;
}

// Insert data via API
async function insertData(collectionName: string) {
  const res = await fetch('/api/milvus/collections/insert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collectionName }),
  });
  const data = await res.json();
  return data.result;
}

// Search data via API
async function searchData(collectionName: string) {
  const res = await fetch('/api/milvus/collections/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collectionName }),
  });
  const data = await res.json();
  return data.result;
}

// Delete collection via API
async function deleteCollection(collectionName: string) {
  const res = await fetch('/api/milvus/collections/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collectionName }),
  });
  const data = await res.json();
  return data.result;
}

export default function Home() {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputCollection, setInputCollection] = useState('');
  const [operationResult, setOperationResult] = useState<any>(null);

  // Fetch collections on mount and after creation
  const fetchData = async () => {
    const collections = await fetchCollections();
    setCollections(collections);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Use inputCollection if provided, otherwise use the latest collection
  const getTargetCollection = () => {
    if (inputCollection.trim()) return inputCollection.trim();
    if (collections.length === 0) return '';
    return (
      collections[collections.length - 1].name ||
      collections[collections.length - 1]
    );
  };

  // Handle create collection button click
  const handleCreate = async () => {
    setLoading(true);
    setOperationResult(null);
    try {
      const result = await createCollection(
        inputCollection.trim() || undefined
      );
      setOperationResult(result); // Save the full result for rendering
      await fetchData();
    } catch (e: any) {
      setOperationResult({ error: e.message });
    }
    setLoading(false);
  };

  // Handle insert data button click
  const handleInsert = async () => {
    setLoading(true);
    setOperationResult(null);
    try {
      const collectionName = getTargetCollection();
      if (!collectionName) {
        setOperationResult({ error: 'No collection found to insert data.' });
        setLoading(false);
        return;
      }
      const result = await insertData(collectionName);
      setOperationResult(result);
    } catch (e: any) {
      setOperationResult({ error: e.message });
    }
    setLoading(false);
  };

  // Handle search button click
  const handleSearch = async () => {
    setLoading(true);
    setOperationResult(null);
    try {
      const collectionName = getTargetCollection();
      if (!collectionName) {
        setOperationResult({ error: 'No collection found to search.' });
        setLoading(false);
        return;
      }
      const result = await searchData(collectionName);
      setOperationResult(result);
    } catch (e: any) {
      setOperationResult({ error: e.message });
    }
    setLoading(false);
  };

  // Handle delete collection button click
  const handleDelete = async () => {
    setLoading(true);
    setOperationResult(null);
    try {
      const collectionName = getTargetCollection();
      if (!collectionName) {
        setOperationResult({ error: 'No collection found to delete.' });
        setLoading(false);
        return;
      }
      const result = await deleteCollection(collectionName);
      setOperationResult(result);
      await fetchData();
    } catch (e: any) {
      setOperationResult({ error: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 text-white p-4">
      <div className="w-full max-w-5xl p-8 bg-slate-800 rounded-xl shadow-2xl space-y-8">
        <header className="text-center">
          <h1 className="text-5xl font-extrabold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500">
            Milvus next.js Demo
          </h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-4 p-6 bg-slate-700 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-sky-400">
              Controls
            </h2>
            <input
              type="text"
              className="w-full px-4 py-3 border border-slate-600 rounded-lg bg-slate-800 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
              placeholder="Enter collection name (optional)"
              value={inputCollection}
              onChange={e => setInputCollection(e.target.value)}
              disabled={loading}
            />
            <div className="grid grid-cols-2 gap-4">
              <button
                className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-60 transition-colors duration-150 ease-in-out flex items-center justify-center space-x-2"
                onClick={handleCreate}
                disabled={loading}
              >
                {/* SVG icon for create */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{loading ? 'Creating...' : 'Create Collection'}</span>
              </button>
              <button
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors duration-150 ease-in-out flex items-center justify-center space-x-2"
                onClick={handleInsert}
                disabled={loading}
              >
                {/* SVG icon for insert */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M5.5 13a3.5 3.5 0 01-.166-6.981l.006-.003L5.5 6h9l.16.016a3.5 3.5 0 01-.16 6.984l-.006.003-3.292.003a3.513 3.513 0 01-2.004 1.083A3.513 3.513 0 019.292 13H5.5zm1.07-5.462A2.502 2.502 0 005.5 7H4a1 1 0 000 2h1.5a2.5 2.5 0 001.07-.538zM14.5 7H13a1 1 0 100 2h1.5c.622 0 1.195-.23 1.624-.624A2.502 2.502 0 0014.5 7z" />
                  <path
                    fillRule="evenodd"
                    d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{loading ? 'Inserting...' : 'Insert Row'}</span>
              </button>
              <button
                className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-60 transition-colors duration-150 ease-in-out flex items-center justify-center space-x-2"
                onClick={handleSearch}
                disabled={loading}
              >
                {/* SVG icon for search */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{loading ? 'Searching...' : 'Vector Search'}</span>
              </button>
              <button
                className="px-6 py-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-60 transition-colors duration-150 ease-in-out flex items-center justify-center space-x-2"
                onClick={handleDelete}
                disabled={loading}
              >
                {/* SVG icon for delete */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{loading ? 'Deleting...' : 'Delete Collection'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-6 p-6 bg-slate-700 rounded-lg shadow-lg">
            <div className="bg-slate-800 p-6 rounded-lg shadow-inner">
              <h3 className="text-xl font-semibold mb-3 text-sky-400">
                Collections Count
              </h3>
              <pre className="whitespace-pre-wrap text-3xl font-bold text-slate-200">
                {collections.length}
              </pre>
            </div>
            {/* Removed tip display */}
            {operationResult && (
              <div className="bg-slate-800 p-6 rounded-lg shadow-inner">
                <h3 className="text-xl font-semibold mb-3 text-sky-400">
                  Last Operation Result:
                </h3>
                <pre className="whitespace-pre-wrap text-sm text-slate-300 bg-slate-900 p-4 rounded-md overflow-x-auto">
                  {JSON.stringify(operationResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
        <footer className="text-center text-slate-500 mt-12">
          <p>Milvus SDK Demo - &copy; {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
}
