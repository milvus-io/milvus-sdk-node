'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CollectionSelector } from '@/components/collection-selector';
import type { CreateTaskInput } from '@/types/task';

interface CreateTaskDialogProps {
  onTaskCreated: () => void;
}

export function CreateTaskDialog({ onTaskCreated }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionError, setCollectionError] = useState<string>('');
  const [insertType, setInsertType] = useState<'once' | 'interval'>('once');
  const [intervalSeconds, setIntervalSeconds] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [endTimeError, setEndTimeError] = useState<string>('');
  const [insertCountPerExecution, setInsertCountPerExecution] = useState<string>('1');

  const getMaxDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
    setEndTimeError('');

    if (value) {
      const selectedDate = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (selectedDate > today) {
        setEndTimeError('End time cannot exceed today');
        return;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!collectionName || collectionName.trim() === '') {
      setCollectionError('Please select a collection');
      return;
    }

    setCollectionError('');

    if (endTime) {
      const selectedDate = new Date(endTime);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (selectedDate > today) {
        setEndTimeError('End time cannot exceed today');
        return;
      }
    }

    setLoading(true);

    try {
      const parsedInterval = insertType === 'interval' && intervalSeconds
        ? parseInt(intervalSeconds, 10)
        : null;

      if (parsedInterval !== null && parsedInterval < 1) {
        alert('Interval must be at least 1 second');
        return;
      }

      const taskData: CreateTaskInput = {
        collectionName,
        intervalSeconds:
          insertType === 'interval' && intervalSeconds
            ? parseInt(intervalSeconds, 10)
            : null,
        endTime: endTime ? new Date(endTime).toISOString() : null,
        insertCountPerExecution: parseInt(insertCountPerExecution, 10) || 1,
      };

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create task');
      }

      setOpen(false);
      resetForm();
      onTaskCreated();
    } catch (error: any) {
      alert(error.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCollectionName('');
    setCollectionError('');
    setInsertType('once');
    setIntervalSeconds('');
    setEndTime('');
    setEndTimeError('');
    setInsertCountPerExecution('1');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Task</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Insertion Task</DialogTitle>
            <DialogDescription>
              Create a new data insertion task for a Milvus collection.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <CollectionSelector
                value={collectionName}
                onValueChange={(value) => {
                  setCollectionName(value);
                  if (value) {
                    setCollectionError('');
                  }
                }}
              />
              {collectionError && (
                <p className="text-sm text-destructive">{collectionError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Insert Type</Label>
              <RadioGroup
                value={insertType}
                onValueChange={(value) => setInsertType(value as 'once' | 'interval')}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="once" id="once" />
                  <Label htmlFor="once" className="font-normal cursor-pointer">
                    One-time
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="interval" id="interval" />
                  <Label htmlFor="interval" className="font-normal cursor-pointer">
                    Interval
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="insertCount">Rows per execution</Label>
              <Input
                id="insertCount"
                type="number"
                min="1"
                placeholder="1"
                value={insertCountPerExecution}
                onChange={(e) => setInsertCountPerExecution(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Number of rows to insert each time
              </p>
            </div>

            {insertType === 'interval' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="interval">Interval (seconds)</Label>
                  <Input
                    id="interval"
                    type="number"
                    min="1"
                    placeholder="60"
                    value={intervalSeconds}
                    onChange={(e) => setIntervalSeconds(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum interval is 1 second
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time (optional)</Label>
                  <Input
                    id="endTime"
                    type="datetime-local"
                    max={getMaxDateTime()}
                    value={endTime}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                  />
                  {endTimeError && (
                    <p className="text-sm text-destructive">{endTimeError}</p>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !collectionName}>
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

