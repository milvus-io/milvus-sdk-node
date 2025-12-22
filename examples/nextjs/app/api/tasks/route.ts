import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getTasks, saveTask, deleteTask, updateTask } from '@/lib/kv';
import { insertData } from '@/lib/milvus-insert';
import type { CreateTaskInput, InsertionTask } from '@/types/task';

export async function GET() {
  try {
    const tasks = await getTasks();
    return NextResponse.json({ tasks });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: CreateTaskInput = await request.json();
    const {
      collectionName,
      intervalSeconds,
      endTime,
      insertCountPerExecution = 1,
    } = body;

    if (!collectionName || typeof collectionName !== 'string' || collectionName.trim() === '') {
      return NextResponse.json(
        { error: 'Collection name is required' },
        { status: 400 }
      );
    }

    if (insertCountPerExecution < 1 || !Number.isInteger(insertCountPerExecution)) {
      return NextResponse.json(
        { error: 'Rows per execution must be a positive integer' },
        { status: 400 }
      );
    }

    if (intervalSeconds !== null) {
      if (typeof intervalSeconds !== 'number' || intervalSeconds < 60) {
        return NextResponse.json(
          { error: 'Interval must be at least 60 seconds' },
          { status: 400 }
        );
      }
    }

    if (endTime && isNaN(new Date(endTime).getTime())) {
      return NextResponse.json(
        { error: 'Invalid end time format' },
        { status: 400 }
      );
    }

    const task: InsertionTask = {
      id: uuidv4(),
      collectionName,
      intervalSeconds,
      endTime: endTime ? new Date(endTime) : null,
      status: 'running',
      createdAt: new Date(),
      lastInsertAt: null,
      insertCount: 0,
      insertCountPerExecution: insertCountPerExecution || 1,
    };

    await saveTask(task);

    // Execute immediately for both one-time and interval tasks
    try {
      await insertData(collectionName, task.insertCountPerExecution);
      const now = new Date();
      const updates: Partial<InsertionTask> = {
        lastInsertAt: now,
        insertCount: task.insertCountPerExecution,
      };

      // Mark one-time tasks as completed
      if (intervalSeconds === null) {
        updates.status = 'completed';
        task.status = 'completed';
      }

      await updateTask(task.id, updates);
      task.lastInsertAt = now;
      task.insertCount = task.insertCountPerExecution;
    } catch (error: any) {
      // Log error but don't fail the request - task will be retried by cron job
      console.error(`Failed to execute initial insert for task ${task.id}:`, error);
    }

    return NextResponse.json({ task });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create task' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body: { id: string; updates: Partial<InsertionTask> } =
      await request.json();
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    await updateTask(id, updates);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update task' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    await deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete task' },
      { status: 500 }
    );
  }
}

