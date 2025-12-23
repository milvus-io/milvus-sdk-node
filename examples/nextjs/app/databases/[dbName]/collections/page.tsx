'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CollectionsPage() {
  const router = useRouter();
  const params = useParams();
  const dbName = params?.dbName as string;
  const [collections, setCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!dbName) return;

    const fetchCollections = async () => {
      try {
        const response = await fetch(
          `/api/databases/${encodeURIComponent(dbName)}/collections`
        );
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch collections');
        }
        const data = await response.json();
        setCollections(data.collections || []);
      } catch (err: any) {
        console.error('Error fetching collections:', err);
        setError(err.message || 'Failed to fetch collections');
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, [dbName, router]);

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 space-y-2">
        <Link
          href="/databases"
          className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block transition-colors"
        >
          ← Back to Databases
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">Collections</h1>
        <p className="text-muted-foreground text-lg">
          Database: <span className="font-semibold text-foreground">{dbName}</span>
        </p>
      </div>

      {collections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-center text-muted-foreground text-sm">
                No collections found in this database
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {collections.map((collectionName: string) => (
            <Link
              key={collectionName}
              href={`/databases/${encodeURIComponent(dbName)}/collections/${encodeURIComponent(collectionName)}`}
            >
              <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-primary/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {collectionName}
                  </CardTitle>
                  <CardDescription>Collection</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    View Details
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

