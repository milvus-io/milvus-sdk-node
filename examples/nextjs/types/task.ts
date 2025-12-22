export type TaskStatus = 'running' | 'stopped' | 'completed';

export interface InsertionTask {
  id: string;
  collectionName: string;
  intervalSeconds: number | null;
  endTime: Date | null;
  status: TaskStatus;
  createdAt: Date;
  lastInsertAt: Date | null;
  insertCount: number;
  insertCountPerExecution: number;
}

export interface CreateTaskInput {
  collectionName: string;
  intervalSeconds: number | null;
  endTime: string | null;
  insertCountPerExecution?: number;
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  lastInsertAt?: Date;
  insertCount?: number;
}

