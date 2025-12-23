'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CollectionDataProps {
  dbName: string;
  collectionName: string;
}

function isVectorField(fieldName: string, schema: any): boolean {
  if (!schema || !schema.fields) return false;
  const field = schema.fields.find((f: any) => f.name === fieldName);
  if (!field) return false;
  return (
    field.type === 'FloatVector' ||
    field.type === 'BinaryVector' ||
    field.type === 'SparseFloatVector' ||
    field.type === 'Float16Vector' ||
    field.type === 'BFloat16Vector'
  );
}

function getVectorLength(value: any): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === 'object' && Array.isArray(value.data)) {
    return value.data.length;
  }
  return 0;
}

function VectorCell({ value, fieldName }: { value: any; fieldName: string }) {
  const [open, setOpen] = useState(false);
  const vectorLength = getVectorLength(value);
  const vectorData = Array.isArray(value) ? value : value?.data || [];

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Vector[{vectorLength}]
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className="h-6 px-2 text-xs"
        >
          View
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vector Data: {fieldName}</DialogTitle>
            <DialogDescription>
              Dimension: {vectorLength} values
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
              {JSON.stringify(vectorData, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CollectionData({ dbName, collectionName }: CollectionDataProps) {
  const [data, setData] = useState<any[]>([]);
  const [schema, setSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const response = await fetch(
          `/api/databases/${encodeURIComponent(dbName)}/collections/${encodeURIComponent(collectionName)}/schema`
        );
        if (response.ok) {
          const data = await response.json();
          setSchema(data.schema);
        }
      } catch (error) {
        console.error('Error fetching schema:', error);
      }
    };

    fetchSchema();
  }, [dbName, collectionName]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/databases/${encodeURIComponent(dbName)}/collections/${encodeURIComponent(collectionName)}/data?limit=${limit}&offset=${offset}`
      );
      if (response.ok) {
        const result = await response.json();
        console.log('Data API response:', result);
        setData(result.data || []);
        setTotal(result.total || 0);
        console.log('Set data:', result.data);
        console.log('Set total:', result.total);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dbName, collectionName, offset]);

  const handlePrevious = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleNext = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading data...</p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No data found</p>
        </CardContent>
      </Card>
    );
  }

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collection Data</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, idx) => (
                  <TableRow key={idx}>
                    {columns.map((col) => {
                      const value = row[col];
                      const isVector = isVectorField(col, schema);

                      if (isVector) {
                        return (
                          <TableCell key={col}>
                            <VectorCell value={value} fieldName={col} />
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell key={col}>
                          {typeof value === 'object' && value !== null
                            ? JSON.stringify(value)
                            : String(value || '-')}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of{' '}
              {total} results
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={offset === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={handleNext}
                disabled={offset + limit >= total}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

