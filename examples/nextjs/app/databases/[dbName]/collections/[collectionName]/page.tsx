'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CollectionSchema } from './CollectionSchema';
import { CollectionData } from './CollectionData';
import { CollectionSearch } from './CollectionSearch';

export default function CollectionDetailPage() {
  const params = useParams();
  const dbName = params?.dbName as string;
  const collectionName = params?.collectionName as string;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 space-y-2">
        <Link
          href={`/databases/${encodeURIComponent(dbName)}/collections`}
          className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block transition-colors"
        >
          ← Back to Collections
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">{collectionName}</h1>
        <p className="text-muted-foreground text-lg">
          Database: <span className="font-semibold text-foreground">{dbName}</span>
        </p>
      </div>

      <Tabs defaultValue="schema" className="w-full">
        <TabsList>
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>
        <TabsContent value="schema">
          <CollectionSchema
            dbName={dbName}
            collectionName={collectionName}
          />
        </TabsContent>
        <TabsContent value="data">
          <CollectionData dbName={dbName} collectionName={collectionName} />
        </TabsContent>
        <TabsContent value="search">
          <CollectionSearch dbName={dbName} collectionName={collectionName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

