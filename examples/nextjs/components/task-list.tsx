'use client';

import { TaskVisualization } from '@/components/task-visualization';
import type { InsertionTask } from '@/types/task';

interface TaskListProps {
  tasks: InsertionTask[];
  onTaskUpdate: () => void;
}

export function TaskList({ tasks, onTaskUpdate }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tasks yet. Create your first task to get started.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <TaskVisualization
          key={task.id}
          task={task}
          onTaskUpdate={onTaskUpdate}
        />
      ))}
    </div>
  );
}

