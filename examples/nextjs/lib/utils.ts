import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { InsertionTask } from '@/types/task';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeTaskDates(task: any): InsertionTask {
  return {
    ...task,
    createdAt: new Date(task.createdAt),
    endTime: task.endTime ? new Date(task.endTime) : null,
    lastInsertAt: task.lastInsertAt ? new Date(task.lastInsertAt) : null,
    insertCount: task.insertCount || 0,
    insertCountPerExecution: task.insertCountPerExecution || 1,
  };
}

export function normalizeTaskDatesArray(tasks: any[]): InsertionTask[] {
  return tasks.map(normalizeTaskDates);
}

export function parseDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  try {
    return new Date(date);
  } catch {
    return null;
  }
}
