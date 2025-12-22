'use client';

import { useState, useEffect } from 'react';
import { CreateTaskDialog } from '@/components/create-task-dialog';
import { TaskList } from '@/components/task-list';
import type { InsertionTask } from '@/types/task';

export default function Home() {
  const [tasks, setTasks] = useState<InsertionTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) {
        throw new Error('Failed to fetch tasks');
      }
      const data = await res.json();
      const tasks = (data.tasks || []).map((task: any) => ({
        ...task,
        createdAt: new Date(task.createdAt),
        endTime: task.endTime ? new Date(task.endTime) : null,
        lastInsertAt: task.lastInsertAt ? new Date(task.lastInsertAt) : null,
      }));
      setTasks(tasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    const initCollection = async () => {
      try {
        await fetch('/api/milvus/init-collection', { method: 'POST' });
      } catch (error) {
        console.error('Failed to initialize collection:', error);
      }
    };

    initCollection();
    fetchTasks();
    const fetchInterval = setInterval(fetchTasks, 10000);
    return () => clearInterval(fetchInterval);
  }, []);

  useEffect(() => {
    console.log('Browser session cron started - will run while page is open');
    const executeInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/tasks');
        const data = await res.json();
        const runningTasks = (data.tasks || []).filter(
          (t: any) => t.status === 'running'
        );

        if (runningTasks.length > 0) {
          await fetch('/api/cron/tasks');
          await fetchTasks();
        }
      } catch (error) {
        console.error('Auto-execution failed:', error);
      }
    }, 5000);

    return () => {
      console.log('Browser session cron stopped - page closed');
      clearInterval(executeInterval);
    };
  }, []);

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Insertion Tasks</h1>
          <p className="text-muted-foreground">
            Manage your Milvus data insertion tasks
          </p>
        </div>
        <div className="flex gap-2">
          <CreateTaskDialog onTaskCreated={fetchTasks} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <TaskList tasks={tasks} onTaskUpdate={fetchTasks} />
      )}
    </div>
  );
}
