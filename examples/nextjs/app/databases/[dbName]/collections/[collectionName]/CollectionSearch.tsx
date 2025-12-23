'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

interface FieldSchema {
  name: string;
  type: string;
  params?: { key: string; value: string }[];
}

interface CollectionSearchProps {
  dbName: string;
  collectionName: string;
}

export function CollectionSearch({
  dbName,
  collectionName,
}: CollectionSearchProps) {
  const [schema, setSchema] = useState<any>(null);
  const [vectorFields, setVectorFields] = useState<FieldSchema[]>([]);
  const [selectedVectorField, setSelectedVectorField] = useState<string>('');
  const [vectorInput, setVectorInput] = useState<string>('');
  const [limit, setLimit] = useState<number>(10);
  const [outputFields, setOutputFields] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [metricType, setMetricType] = useState<string>('L2');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const response = await fetch(
          `/api/databases/${encodeURIComponent(dbName)}/collections/${encodeURIComponent(collectionName)}/schema`
        );
        if (response.ok) {
          const data = await response.json();
          setSchema(data.schema);

          // Extract vector fields
          const fields: FieldSchema[] = data.schema.fields || [];
          const vectors = fields.filter(
            (f: FieldSchema) =>
              f.type === 'FloatVector' ||
              f.type === 'BinaryVector' ||
              f.type === 'SparseFloatVector'
          );
          setVectorFields(vectors);

          // Auto-select first vector field
          if (vectors.length > 0 && !selectedVectorField) {
            setSelectedVectorField(vectors[0].name);
          }

          // Get all non-vector fields for outputFields
          const nonVectorFields = fields
            .filter(
              (f: FieldSchema) =>
                f.type !== 'FloatVector' &&
                f.type !== 'BinaryVector' &&
                f.type !== 'SparseFloatVector'
            )
            .map((f: FieldSchema) => f.name);
          setOutputFields(nonVectorFields);
        }
      } catch (error) {
        console.error('Error fetching schema:', error);
      }
    };

    fetchSchema();
  }, [dbName, collectionName]);

  const parseVectorInput = (input: string): number[][] => {
    try {
      // Try parsing as JSON array
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        // Check if it's a single vector or array of vectors
        if (parsed.length > 0 && typeof parsed[0] === 'number') {
          // Single vector
          return [parsed];
        } else if (
          Array.isArray(parsed[0]) &&
          typeof parsed[0][0] === 'number'
        ) {
          // Array of vectors
          return parsed;
        }
      }
      throw new Error('Invalid vector format');
    } catch (e) {
      // Try parsing as comma-separated values
      const lines = input.trim().split('\n');
      return lines.map((line) => {
        const values = line
          .split(',')
          .map((v) => parseFloat(v.trim()))
          .filter((v) => !isNaN(v));
        if (values.length === 0) {
          throw new Error('Invalid vector format');
        }
        return values;
      });
    }
  };

  const handleSearch = async () => {
    if (!selectedVectorField) {
      setError('Please select a vector field');
      return;
    }

    if (!vectorInput.trim()) {
      setError('Please enter vector data');
      return;
    }

    setLoading(true);
    setError('');
    setSearchResults([]);

    try {
      const vectors = parseVectorInput(vectorInput);

      const response = await fetch(
        `/api/databases/${encodeURIComponent(dbName)}/collections/${encodeURIComponent(collectionName)}/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: vectors,
            annsField: selectedVectorField,
            limit,
            outputFields: outputFields.length > 0 ? outputFields : undefined,
            filter: filter.trim() || undefined,
            metricType: metricType || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to perform search');
    } finally {
      setLoading(false);
    }
  };

  const getVectorDimension = (fieldName: string): number | null => {
    const field = vectorFields.find((f) => f.name === fieldName);
    if (field?.params) {
      const dimParam = field.params.find((p) => p.key === 'dim');
      if (dimParam) {
        return parseInt(dimParam.value, 10);
      }
    }
    return null;
  };

  const getVectorFieldType = (fieldName: string): string | null => {
    const field = vectorFields.find((f) => f.name === fieldName);
    return field?.type || null;
  };

  const generateRandomVector = () => {
    if (!selectedVectorField) {
      setError('Please select a vector field first');
      return;
    }

    const dim = getVectorDimension(selectedVectorField);
    if (!dim) {
      setError('Cannot determine vector dimension');
      return;
    }

    const fieldType = getVectorFieldType(selectedVectorField);
    let vector: number[];

    if (fieldType === 'BinaryVector') {
      // Generate binary vector (0 or 1)
      vector = Array.from({ length: dim }, () =>
        Math.random() > 0.5 ? 1 : 0
      );
    } else if (fieldType === 'SparseFloatVector') {
      // Generate sparse vector (only a few non-zero values)
      const numNonZero = Math.min(10, Math.floor(dim * 0.1)); // 10% non-zero or max 10
      vector = Array.from({ length: dim }, () => 0);
      const indices = new Set<number>();
      while (indices.size < numNonZero) {
        indices.add(Math.floor(Math.random() * dim));
      }
      indices.forEach((idx) => {
        vector[idx] = Math.random() * 2 - 1; // Random value between -1 and 1
      });
    } else {
      // FloatVector - generate normalized random vector
      // Generate random values and normalize for better search results
      vector = Array.from({ length: dim }, () => Math.random() * 2 - 1);
      
      // Normalize the vector (L2 normalization)
      const magnitude = Math.sqrt(
        vector.reduce((sum, val) => sum + val * val, 0)
      );
      if (magnitude > 0) {
        vector = vector.map((val) => val / magnitude);
      }
    }

    // Format as JSON array string
    setVectorInput(JSON.stringify(vector));
    setError('');
  };

  if (!schema) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading schema...</p>
        </CardContent>
      </Card>
    );
  }

  if (vectorFields.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No vector fields found in this collection
          </p>
        </CardContent>
      </Card>
    );
  }

  const resultColumns =
    searchResults.length > 0 ? Object.keys(searchResults[0]) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Panel - Input Form */}
      <div className="flex flex-col min-w-0">
        <Card className="flex flex-col shadow-sm border-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">Vector Search</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vectorField">Vector Field</Label>
                <Select
                  value={selectedVectorField}
                  onValueChange={setSelectedVectorField}
                >
                  <SelectTrigger id="vectorField">
                    <SelectValue placeholder="Select vector field" />
                  </SelectTrigger>
                  <SelectContent>
                    {vectorFields.map((field) => {
                      const dim = getVectorDimension(field.name);
                      return (
                        <SelectItem key={field.name} value={field.name}>
                          {field.name}
                          {dim && ` (dim: ${dim})`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="limit">Limit</Label>
                <Input
                  id="limit"
                  type="number"
                  min="1"
                  max="16384"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value, 10) || 10)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="vectorInput">Vector Data</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateRandomVector}
                  disabled={!selectedVectorField}
                >
                  Generate Random Vector
                </Button>
              </div>
              <Textarea
                id="vectorInput"
                placeholder='Enter vector as JSON array, e.g., [0.1, 0.2, 0.3] or multiple vectors: [[0.1, 0.2], [0.3, 0.4]]'
                value={vectorInput}
                onChange={(e) => setVectorInput(e.target.value)}
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter vector(s) as JSON array or comma-separated values (one per
                line). Click "Generate Random Vector" to auto-generate a vector
                based on the selected field dimension.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="metricType">Metric Type</Label>
                <Select value={metricType} onValueChange={setMetricType}>
                  <SelectTrigger id="metricType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L2">L2</SelectItem>
                    <SelectItem value="IP">IP</SelectItem>
                    <SelectItem value="COSINE">COSINE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="outputFields">Output Fields (comma-separated)</Label>
                <Input
                  id="outputFields"
                  placeholder="e.g., id, name, description"
                  value={outputFields.join(', ')}
                  onChange={(e) =>
                    setOutputFields(
                      e.target.value
                        .split(',')
                        .map((f) => f.trim())
                        .filter((f) => f.length > 0)
                    )
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter">Filter Expression (optional)</Label>
              <Input
                id="filter"
                placeholder='e.g., id > 100'
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button onClick={handleSearch} disabled={loading} className="w-full">
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Results */}
      <div className="flex flex-col min-w-0">
        <Card className="flex flex-col shadow-sm border-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">
              Search Results
              {searchResults.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({searchResults.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[600px] overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Searching...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {resultColumns.map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((result, idx) => (
                      <TableRow key={idx}>
                        {resultColumns.map((col) => (
                          <TableCell key={col}>
                            {Array.isArray(result[col]) ? (
                              <span className="text-xs text-muted-foreground">
                                [Vector (dim: {result[col].length}){' '}
                                {result[col]
                                  .slice(0, 3)
                                  .map((v: number) => v.toFixed(2))
                                  .join(', ')}
                                ...]
                              </span>
                            ) : typeof result[col] === 'object' ? (
                              JSON.stringify(result[col])
                            ) : (
                              String(result[col] || '-')
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground text-sm">
                    No results yet. Enter search parameters and click Search to
                    see results here.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

