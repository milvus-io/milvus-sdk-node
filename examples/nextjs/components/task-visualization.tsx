'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Button } from '@/components/ui/button';
import { TaskStatusBadge } from '@/components/task-status-badge';
import type { InsertionTask } from '@/types/task';
import { format, formatDistanceToNow } from 'date-fns';

interface TaskVisualizationProps {
  task: InsertionTask;
  onTaskUpdate: () => void;
  onInsertAnimation?: () => void;
}

export function TaskVisualization({
  task,
  onTaskUpdate,
  onInsertAnimation,
}: TaskVisualizationProps) {
  const countdownRef = useRef<SVGSVGElement>(null);
  const timelineRef = useRef<SVGSVGElement>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [insertHistory, setInsertHistory] = useState<Date[]>([]);
  const [isInserting, setIsInserting] = useState(false);
  const prevLastInsertRef = useRef<Date | null>(null);

  useEffect(() => {
    if (task.lastInsertAt) {
      const lastInsertTime = task.lastInsertAt.getTime();
      const prevTime = prevLastInsertRef.current?.getTime();

      if (!prevTime || Math.abs(lastInsertTime - prevTime) > 500) {
        setIsInserting(true);
        onInsertAnimation?.();
        setTimeout(() => setIsInserting(false), 1000);

        setInsertHistory((prev) => {
          const newHistory = [...prev, task.lastInsertAt!];
          return newHistory
            .filter((time, index, arr) => {
              if (index === 0) return true;
              return time.getTime() !== arr[index - 1].getTime();
            })
            .slice(-20);
        });

        prevLastInsertRef.current = task.lastInsertAt;
      }
    }
  }, [task.lastInsertAt, onInsertAnimation]);

  useEffect(() => {
    if (!countdownRef.current) {
      return;
    }

    if (task.status !== 'running' || !task.intervalSeconds) {
      return;
    }

    const updateCountdown = () => {
      if (!task.lastInsertAt || !task.intervalSeconds) {
        setCountdown(task.intervalSeconds);
        return;
      }

      const now = Date.now();
      const lastInsert = new Date(task.lastInsertAt).getTime();
      const elapsed = (now - lastInsert) / 1000;
      const remaining = Math.max(0, task.intervalSeconds - elapsed);
      setCountdown(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => clearInterval(interval);
  }, [task.status, task.lastInsertAt, task.intervalSeconds]);

  useEffect(() => {
    if (!countdownRef.current) {
      return;
    }

    const svg = d3.select(countdownRef.current);
    const width = 120;
    const height = 120;
    const radius = Math.min(width, height) / 2 - 10;

    svg.attr('width', width).attr('height', height);

    let g = svg.select('g.countdown-group');
    if (g.empty()) {
      g = svg.append('g').attr('class', 'countdown-group').attr('transform', `translate(${width / 2},${height / 2})`);
    }

    if (task.status !== 'running' || !task.intervalSeconds) {
      g.selectAll('*').remove();
      return;
    }

    const progress = task.intervalSeconds
      ? Math.max(0, Math.min(1, 1 - countdown / task.intervalSeconds))
      : 0;

    const backgroundArc = d3
      .arc()
      .innerRadius(radius - 12)
      .outerRadius(radius)
      .startAngle(0)
      .endAngle(2 * Math.PI);

    let background = g.select('.background-arc');
    if (background.empty()) {
      background = g.append('path').attr('class', 'background-arc').attr('fill', '#e5e7eb');
      background.attr('d', backgroundArc() as string);
    }

    const progressArc = d3
      .arc()
      .innerRadius(radius - 12)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(-Math.PI / 2 + progress * 2 * Math.PI);

    let progressPath = g.select('.progress-arc');
    let previousProgress = progressPath.empty() ? 0 : ((progressPath.datum() as number) || 0);

    if (progressPath.empty()) {
      progressPath = g.append('path').attr('class', 'progress-arc').attr('fill', '#60a5fa');
      progressPath.datum(0);
      progressPath.attr('d', progressArc.endAngle(-Math.PI / 2)() as string);
    }

    const needsReset = previousProgress > 0.9 && progress < 0.1;

    if (needsReset) {
      progressPath
        .datum(1)
        .transition()
        .duration(50)
        .ease(d3.easeLinear)
        .attrTween('d', function () {
          const interpolate = d3.interpolate(previousProgress, 1);
          return (t: number) => {
            const currentProgress = interpolate(t);
            return progressArc
              .endAngle(-Math.PI / 2 + currentProgress * 2 * Math.PI)() as string;
          };
        })
        .on('end', function () {
          progressPath.datum(0).attr('d', progressArc.endAngle(-Math.PI / 2)() as string);
          progressPath
            .datum(progress)
            .transition()
            .duration(50)
            .ease(d3.easeLinear)
            .attrTween('d', function () {
              const interpolate = d3.interpolate(0, progress);
              return (t: number) => {
                const currentProgress = interpolate(t);
                return progressArc
                  .endAngle(-Math.PI / 2 + currentProgress * 2 * Math.PI)() as string;
              };
            });
        });
    } else if (Math.abs(previousProgress - progress) > 0.001) {
      progressPath
        .datum(progress)
        .transition()
        .duration(100)
        .ease(d3.easeLinear)
        .attrTween('d', function () {
          const interpolate = d3.interpolate(previousProgress, progress);
          return (t: number) => {
            const currentProgress = interpolate(t);
            return progressArc
              .endAngle(-Math.PI / 2 + currentProgress * 2 * Math.PI)() as string;
          };
        });
    }

    let textGroup = g.select('.countdown-text');
    if (textGroup.empty()) {
      textGroup = g.append('g').attr('class', 'countdown-text');
      textGroup
        .append('text')
        .attr('class', 'countdown-number')
        .attr('text-anchor', 'middle')
        .attr('dy', '-12')
        .attr('font-size', '18')
        .attr('font-weight', '700')
        .attr('fill', '#1f2937');

      textGroup
        .append('text')
        .attr('class', 'countdown-label')
        .attr('text-anchor', 'middle')
        .attr('dy', '8')
        .attr('font-size', '11')
        .attr('fill', '#6b7280')
        .text('inserted');

      textGroup
        .append('text')
        .attr('class', 'inserting-text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0')
        .attr('font-size', '12')
        .attr('font-weight', '600')
        .attr('fill', '#3b82f6')
        .style('opacity', 0)
        .text('Inserting...');
    }

    if (isInserting) {
      textGroup.select('.countdown-number').transition().duration(200).style('opacity', 0);
      textGroup.select('.countdown-label').transition().duration(200).style('opacity', 0);
      textGroup.select('.inserting-text').transition().duration(200).style('opacity', 1);
    } else {
      textGroup.select('.countdown-number').transition().duration(200).style('opacity', 1);
      textGroup.select('.countdown-label').transition().duration(200).style('opacity', 1);
      textGroup.select('.inserting-text').transition().duration(200).style('opacity', 0);
    }

    textGroup
      .select('.countdown-number')
      .text(task.insertCount || 0);
  }, [countdown, task.status, task.intervalSeconds, task.insertCount, isInserting]);

  useEffect(() => {
    if (!timelineRef.current) {
      return;
    }

    const svg = d3.select(timelineRef.current);
    svg.selectAll('*').remove();

    const width = 400;
    const height = 60;
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };

    svg.attr('width', width).attr('height', height);

    if (insertHistory.length === 0) {
      return;
    }

    const now = new Date();
    const timeRange = 5 * 60 * 1000;
    const startTime = now.getTime() - timeRange;

    const xScale = d3
      .scaleTime()
      .domain([new Date(startTime), now])
      .range([margin.left, width - margin.right]);

    const line = svg
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', height / 2)
      .attr('y2', height / 2)
      .attr('stroke', '#d1d5db')
      .attr('stroke-width', 2);

    const filteredHistory = insertHistory.filter(
      (insertTime) => insertTime.getTime() >= startTime
    );

    let tooltip = d3.select('body').select('.timeline-tooltip').empty()
      ? d3
          .select('body')
          .append('div')
          .attr('class', 'timeline-tooltip')
          .style('position', 'absolute')
          .style('pointer-events', 'none')
          .style('opacity', 0)
          .style('background-color', 'rgba(0, 0, 0, 0.8)')
          .style('color', 'white')
          .style('font-size', '12px')
          .style('padding', '4px 8px')
          .style('border-radius', '4px')
          .style('z-index', 1000)
      : d3.select('body').select('.timeline-tooltip');

    filteredHistory.forEach((insertTime) => {
      const x = xScale(insertTime);
      const isLatest =
        task.lastInsertAt &&
        Math.abs(insertTime.getTime() - task.lastInsertAt.getTime()) < 1000;

      const circle = svg
        .append('circle')
        .attr('cx', x)
        .attr('cy', height / 2)
        .attr('r', isLatest ? 8 : 6)
        .attr('fill', isLatest ? '#3b82f6' : '#60a5fa')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function (event) {
          tooltip
            .style('opacity', 1)
            .html(format(insertTime, 'PPpp'))
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`);
        })
        .on('mousemove', function (event) {
          tooltip
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`);
        })
        .on('mouseout', function () {
          tooltip.style('opacity', 0);
        });

      if (isLatest) {
        circle
          .transition()
          .duration(500)
          .attr('r', 6)
          .attr('fill', '#60a5fa');
      }
    });
  }, [insertHistory, task.lastInsertAt]);

  const handleStartStop = async () => {
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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const res = await fetch(`/api/tasks?id=${task.id}`, {
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

  return (
    <div className="relative rounded-lg border bg-card p-6 shadow-sm transition-all">
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0">
          {task.status === 'running' && task.intervalSeconds ? (
            <div className="relative">
              <svg ref={countdownRef} />
            </div>
          ) : (
            <div className="w-[120px] h-[120px] rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-600">
                  {task.status === 'completed' ? '✓' : '—'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {task.status === 'completed' ? 'Done' : 'Stopped'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {task.collectionName}
              </h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <TaskStatusBadge status={task.status} />
                <span>
                  {task.intervalSeconds
                    ? `Every ${task.intervalSeconds}s`
                    : 'One-time'}
                </span>
                <span>•</span>
                <span>{task.insertCountPerExecution || 1} rows/exec</span>
              </div>
            </div>
            <div className="flex gap-2">
              {task.status !== 'completed' && (
                <Button variant="outline" size="sm" onClick={handleStartStop}>
                  {task.status === 'running' ? 'Stop' : 'Start'}
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {task.lastInsertAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Insert</span>
                <span className="font-medium text-foreground">
                  {formatDistanceToNow(task.lastInsertAt, { addSuffix: true })}
                </span>
              </div>
            )}

            {task.endTime && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">End Time</span>
                <span className="font-medium text-foreground">
                  {format(task.endTime, 'PPp')}
                </span>
              </div>
            )}

            {insertHistory.length > 0 && task.status === 'running' && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-xs text-muted-foreground mb-2">
                  Recent Insert History (last 5 minutes)
                </div>
                <div className="overflow-hidden rounded-md bg-gray-50 p-2">
                  <svg ref={timelineRef} className="w-full" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

