import { Badge } from '@/components/ui/badge';
import type { TaskStatus } from '@/types/task';

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const variants: Record<TaskStatus, 'default' | 'secondary' | 'destructive'> =
    {
      running: 'default',
      stopped: 'secondary',
      completed: 'destructive',
    };

  return (
    <Badge variant={variants[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

