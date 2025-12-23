'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface FieldSchema {
  name: string;
  type: string;
  description?: string;
  primary_key?: boolean;
  auto_id?: boolean;
  is_partition_key?: boolean;
  is_dynamic?: boolean;
  element_type?: string;
  max_length?: number;
  max_capacity?: number;
}

interface CollectionSchemaProps {
  dbName: string;
  collectionName: string;
}

export function CollectionSchema({
  dbName,
  collectionName,
}: CollectionSchemaProps) {
  const [schema, setSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      } finally {
        setLoading(false);
      }
    };

    fetchSchema();
  }, [dbName, collectionName]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading schema...</p>
        </CardContent>
      </Card>
    );
  }

  if (!schema) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Failed to load schema
          </p>
        </CardContent>
      </Card>
    );
  }

  // API returns schema with fields directly, not nested in schema.schema
  const fields: FieldSchema[] = schema.fields || schema.schema?.fields || [];
  
  console.log('Schema data:', schema);
  console.log('Fields:', fields);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collection Schema</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Primary Key</TableHead>
              <TableHead>Auto ID</TableHead>
              <TableHead>Partition Key</TableHead>
              <TableHead>Dynamic</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No fields found
                </TableCell>
              </TableRow>
            ) : (
              fields.map((field: any) => (
                <TableRow key={field.name || field.id}>
                  <TableCell className="font-medium">{field.name}</TableCell>
                  <TableCell>
                    {field.type}
                    {field.element_type && ` (${field.element_type})`}
                    {field.params && field.params.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {' '}
                        [{field.params.map((p: any) => `${p.key}=${p.value}`).join(', ')}]
                      </span>
                    )}
                    {field.max_length && ` [${field.max_length}]`}
                    {field.max_capacity && ` [${field.max_capacity}]`}
                  </TableCell>
                  <TableCell>
                    {field.primaryKey || field.primary_key ? 'Yes' : 'No'}
                  </TableCell>
                  <TableCell>
                    {field.autoId || field.auto_id ? 'Yes' : 'No'}
                  </TableCell>
                  <TableCell>
                    {field.partitionKey || field.is_partition_key ? 'Yes' : 'No'}
                  </TableCell>
                  <TableCell>
                    {field.enableDynamicField || field.is_dynamic ? 'Yes' : 'No'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {field.description || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

