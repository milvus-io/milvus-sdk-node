'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DatabasesPage() {
  const router = useRouter();
  const [databases, setDatabases] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDatabases = async () => {
      try {
        const response = await fetch('/api/databases');
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch databases');
        }
        const data = await response.json();
        console.log('Received databases data:', data);
        
        let databases = data.databases || [];
        
        // Sort databases: 'default' first (if exists), then others alphabetically
        const defaultDb = databases.find((db: string) => db === 'default');
        const otherDbs = databases.filter((db: string) => db !== 'default').sort();
        databases = defaultDb ? [defaultDb, ...otherDbs] : otherDbs;
        
        setDatabases(databases);
      } catch (err: any) {
        console.error('Error fetching databases:', err);
        setError(err.message || 'Failed to fetch databases');
      } finally {
        setLoading(false);
      }
    };

    fetchDatabases();
  }, [router]);

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
        <h1 className="text-4xl font-bold tracking-tight">Databases</h1>
        <p className="text-muted-foreground text-lg">
          Select a database to view its collections
        </p>
      </div>

      {databases.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-center text-muted-foreground text-sm">
                No databases found
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {databases.map((dbName: string) => (
            <Link key={dbName} href={`/databases/${dbName}/collections`}>
              <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-primary/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {dbName}
                  </CardTitle>
                  <CardDescription>Database</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    View Collections
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

