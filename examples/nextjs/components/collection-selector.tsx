'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface CollectionSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
}

export function CollectionSelector({
  value,
  onValueChange,
}: CollectionSelectorProps) {
  const [collections, setCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCollections() {
      try {
        const res = await fetch('/api/milvus/collections');
        const data = await res.json();
        const collectionNames = data.collections.map(
          (c: any) => c.name || c
        );
        setCollections(collectionNames);
      } catch (error) {
        console.error('Failed to fetch collections:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCollections();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Collection</Label>
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Loading..." />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>
        Collection <span className="text-destructive">*</span>
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a collection" />
        </SelectTrigger>
        <SelectContent>
          {collections.length === 0 ? (
            <SelectItem value="none" disabled>
              No collections found
            </SelectItem>
          ) : (
            collections.map((collection) => (
              <SelectItem key={collection} value={collection}>
                {collection}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

