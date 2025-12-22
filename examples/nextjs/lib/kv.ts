import { Redis } from '@upstash/redis';
import type { InsertionTask } from '@/types/task';

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

const redis =
  url && token && url.trim() !== '' && token.trim() !== ''
    ? new Redis({
        url: url.trim(),
        token: token.trim(),
      })
    : null;

if (!redis && process.env.NODE_ENV !== 'production') {
  console.warn(
    'Redis client not initialized. Missing environment variables:',
    {
      KV_REST_API_URL: url ? 'SET' : 'NOT SET',
      KV_REST_API_TOKEN: token ? 'SET' : 'NOT SET',
    }
  );
}

const TASKS_KEY = 'tasks:list';
const TASK_KEY_PREFIX = 'task:';

function getTaskKey(taskId: string): string {
  return `${TASK_KEY_PREFIX}${taskId}`;
}

export async function getTasks(): Promise<InsertionTask[]> {
  if (!redis) {
    const missing = [];
    if (!process.env.KV_REST_API_URL) missing.push('KV_REST_API_URL');
    if (!process.env.KV_REST_API_TOKEN) missing.push('KV_REST_API_TOKEN');
    throw new Error(
      `Redis client not initialized. Missing environment variables: ${missing.join(', ')}. Please check your .env.local file.`
    );
  }

  const taskIds = await redis.smembers<string[]>(TASKS_KEY);
  if (!taskIds || taskIds.length === 0) {
    return [];
  }

  const tasks = await Promise.all(
    taskIds.map(async (id) => {
      const taskData = await redis.get<InsertionTask>(getTaskKey(id));
      if (taskData) {
        return {
          ...taskData,
          insertCount: taskData.insertCount || 0,
          insertCountPerExecution: taskData.insertCountPerExecution || 1,
          createdAt: new Date(taskData.createdAt),
          endTime: taskData.endTime ? new Date(taskData.endTime) : null,
          lastInsertAt: taskData.lastInsertAt
            ? new Date(taskData.lastInsertAt)
            : null,
        };
      }
      return null;
    })
  );

  return tasks.filter((task): task is InsertionTask => task !== null);
}

export async function saveTask(task: InsertionTask): Promise<void> {
  if (!redis) {
    throw new Error('Redis client not initialized');
  }

  await Promise.all([
    redis.set(getTaskKey(task.id), {
      ...task,
      createdAt: task.createdAt.toISOString(),
      endTime: task.endTime?.toISOString() || null,
      lastInsertAt: task.lastInsertAt?.toISOString() || null,
    }),
    redis.sadd(TASKS_KEY, task.id),
  ]);
}

export async function deleteTask(taskId: string): Promise<void> {
  if (!redis) {
    throw new Error('Redis client not initialized');
  }

  await Promise.all([
    redis.del(getTaskKey(taskId)),
    redis.srem(TASKS_KEY, taskId),
  ]);
}

export async function updateTask(
  taskId: string,
  updates: Partial<InsertionTask>
): Promise<void> {
  if (!redis) {
    throw new Error('Redis client not initialized');
  }

  const existingTask = await redis.get<InsertionTask>(getTaskKey(taskId));
  if (!existingTask) {
    throw new Error(`Task ${taskId} not found`);
  }

  const updatedTask: InsertionTask = {
    ...existingTask,
    ...updates,
    createdAt: new Date(existingTask.createdAt),
    endTime: updates.endTime
      ? new Date(updates.endTime)
      : existingTask.endTime
        ? new Date(existingTask.endTime)
        : null,
    lastInsertAt: updates.lastInsertAt
      ? new Date(updates.lastInsertAt)
      : existingTask.lastInsertAt
        ? new Date(existingTask.lastInsertAt)
        : null,
    insertCountPerExecution: updates.insertCountPerExecution ?? existingTask.insertCountPerExecution ?? 1,
  };

  await redis.set(getTaskKey(taskId), {
    ...updatedTask,
    createdAt: updatedTask.createdAt.toISOString(),
    endTime: updatedTask.endTime?.toISOString() || null,
    lastInsertAt: updatedTask.lastInsertAt?.toISOString() || null,
  });
}

