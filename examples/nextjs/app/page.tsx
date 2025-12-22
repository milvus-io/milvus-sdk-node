'use client';

import { useState, useEffect } from 'react';
import { CreateTaskDialog } from '@/components/create-task-dialog';
import { TaskList } from '@/components/task-list';
import { Button } from '@/components/ui/button';
import type { InsertionTask } from '@/types/task';

export default function Home() {
  const [tasks, setTasks] = useState<InsertionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

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

  const executeTasks = async () => {
    setExecuting(true);
    try {
      const res = await fetch('/api/cron/tasks');
      const data = await res.json();
      console.log('Cron execution result:', data);

      if (data.results) {
        const inserted = data.results.filter(
          (r: any) => r.action === 'inserted' || r.action === 'completed'
        );
        const failed = data.results.filter((r: any) => r.action === 'failed');
        const skipped = data.results.filter((r: any) => r.action === 'skipped');

        console.log(
          `Executed: ${inserted.length} inserted, ${failed.length} failed, ${skipped.length} skipped`
        );

        if (failed.length > 0) {
          console.error('Failed tasks:', JSON.stringify(failed, null, 2));
          failed.forEach((f: any) => {
            console.error(`Task ${f.taskId} failed:`, f.error || f);
          });
        }

        if (inserted.length > 0) {
          console.log('Successfully executed tasks:', inserted);
        }
      }

      await fetchTasks();
    } catch (error) {
      console.error('Failed to execute tasks:', error);
      alert('Failed to execute tasks. Check console for details.');
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const fetchInterval = setInterval(fetchTasks, 5000);
    return () => clearInterval(fetchInterval);
  }, []);

  // Auto-execute tasks every 60 seconds in development
  // In production, Vercel Cron Jobs handle this automatically
  useEffect(() => {
    // Check if we're in development (local) or production (Vercel)
    // Vercel sets VERCEL_ENV to 'production', 'preview', or 'development'
    // In local dev, window.location.hostname is usually 'localhost' or '127.0.0.1'
    const isDevelopment =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('localhost'));

    if (!isDevelopment) {
      // In production, Vercel Cron Jobs handle task execution
      console.log(
        'Running in production - Vercel Cron Jobs will handle task execution'
      );
      return;
    }

    // Only run auto-execution in development
    console.log(
      'Running in development - auto-executing tasks every 60 seconds'
    );
    const executeInterval = setInterval(async () => {
      // Check if there are any running tasks
      const res = await fetch('/api/tasks');
      const data = await res.json();
      const runningTasks = (data.tasks || []).filter(
        (t: any) => t.status === 'running'
      );

      if (runningTasks.length > 0) {
        console.log(`Auto-executing ${runningTasks.length} running task(s)...`);
        try {
          await fetch('/api/cron/tasks');
          await fetchTasks();
        } catch (error) {
          console.error('Auto-execution failed:', error);
        }
      }
    }, 60000); // 60 seconds

    return () => clearInterval(executeInterval);
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
          <Button variant="outline" onClick={executeTasks} disabled={executing}>
            {executing ? 'Executing...' : 'Execute Tasks'}
          </Button>
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
