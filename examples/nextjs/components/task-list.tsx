'use client';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TaskStatusBadge } from '@/components/task-status-badge';
import type { InsertionTask } from '@/types/task';
import { format } from 'date-fns';

interface TaskListProps {
  tasks: InsertionTask[];
  onTaskUpdate: () => void;
}

export function TaskList({ tasks, onTaskUpdate }: TaskListProps) {
  const handleStartStop = async (task: InsertionTask) => {
    const newStatus = task.status === 'running' ? 'stopped' : 'running';

    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: task.id,
          updates: { status: newStatus },
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update task');
      }

      onTaskUpdate();
    } catch (error) {
      alert('Failed to update task');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const res = await fetch(`/api/tasks?id=${taskId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete task');
      }

      onTaskUpdate();
    } catch (error) {
      alert('Failed to delete task');
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tasks yet. Create your first task to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Collection</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Interval</TableHead>
          <TableHead>Rows/Execution</TableHead>
          <TableHead>End Time</TableHead>
          <TableHead>Total Inserted</TableHead>
          <TableHead>Last Insert</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="font-medium">{task.collectionName}</TableCell>
            <TableCell>
              <TaskStatusBadge status={task.status} />
            </TableCell>
            <TableCell>
              {task.intervalSeconds
                ? `${task.intervalSeconds}s`
                : 'One-time'}
            </TableCell>
            <TableCell>{task.insertCountPerExecution || 1}</TableCell>
            <TableCell>
              {task.endTime ? format(new Date(task.endTime), 'PPp') : '-'}
            </TableCell>
            <TableCell>{task.insertCount}</TableCell>
            <TableCell>
              {task.lastInsertAt
                ? format(new Date(task.lastInsertAt), 'PPp')
                : '-'}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {task.status !== 'completed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStartStop(task)}
                  >
                    {task.status === 'running' ? 'Stop' : 'Start'}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(task.id)}
                >
                  Delete
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

