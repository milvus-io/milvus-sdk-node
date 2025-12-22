import { NextResponse } from 'next/server';
import { getTasks, updateTask } from '@/lib/kv';
import { insertData } from '@/lib/milvus-insert';

export async function GET(request: Request) {
  // Vercel Cron Jobs automatically add authorization header
  // For local testing, you can skip this check or set CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isManualExecution = !authHeader || !cronSecret || authHeader !== `Bearer ${cronSecret}`;
  
  if (
    cronSecret &&
    authHeader &&
    authHeader !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tasks = await getTasks();
    const runningTasks = tasks.filter((task) => task.status === 'running');
    const now = new Date();

    const results = await Promise.allSettled(
      runningTasks.map(async (task) => {
        const lastInsertAt =
          task.lastInsertAt instanceof Date
            ? task.lastInsertAt
            : task.lastInsertAt
              ? new Date(task.lastInsertAt)
              : null;

        const endTime =
          task.endTime instanceof Date
            ? task.endTime
            : task.endTime
              ? new Date(task.endTime)
              : null;

        const shouldExecute =
          isManualExecution ||
          task.intervalSeconds === null ||
          !lastInsertAt ||
          now.getTime() >=
            lastInsertAt.getTime() + task.intervalSeconds * 1000;

        const shouldStop = endTime && now.getTime() >= endTime.getTime();

        if (shouldStop) {
          await updateTask(task.id, { status: 'completed' });
          return { taskId: task.id, action: 'stopped' };
        }

        if (shouldExecute) {
          try {
            const countPerExecution = task.insertCountPerExecution || 1;
            await insertData(task.collectionName, countPerExecution);
            const newInsertCount = (task.insertCount || 0) + countPerExecution;
            await updateTask(task.id, {
              lastInsertAt: now,
              insertCount: newInsertCount,
            });

            if (task.intervalSeconds === null) {
              await updateTask(task.id, { status: 'completed' });
              return { taskId: task.id, action: 'completed', count: countPerExecution };
            }

            return { taskId: task.id, action: 'inserted', count: countPerExecution };
          } catch (error: any) {
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            return {
              taskId: task.id,
              action: 'failed',
              error: errorMessage,
              collectionName: task.collectionName,
            };
          }
        }

        return { taskId: task.id, action: 'skipped' };
      })
    );

    return NextResponse.json({
      processed: runningTasks.length,
      results: results.map((r) => {
        if (r.status === 'fulfilled') {
          return r.value;
        } else {
          return {
            action: 'failed',
            error: r.reason?.message || r.reason?.toString() || 'Unknown error',
          };
        }
      }),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to process tasks' },
      { status: 500 }
    );
  }
}

