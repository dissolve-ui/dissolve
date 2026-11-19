'use client';
/**
 * TaskCheck for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the row itself lives in task-check.core.ts.
 *
 * A to-do row. Tap it: the box fills with a crisp press, the check draws itself, then a line
 * strikes the label left to right across every wrapped line and the text greys out. After a short
 * pause the task settles: it stays, it tells you to move it to a Done section, or it blows away as
 * dust and the list closes up. Tap again before the pause to undo.
 *
 * <TaskCheck label="Oat milk" checked={item.done} onCheckedChange={(v) => toggle(item.id, v)} />
 *
 * <TaskCheck
 *   label={task.title}
 *   checked={task.done}
 *   onCheckedChange={(done) => update(task.id, { done })}
 *   after="dissolve"
 *   onSettled={() => drop(task.id)}
 * />
 */
import type { CSSProperties } from 'react';
import { createTaskCheck, type TaskCheckProps as CoreProps } from './task-check.core';
import { useDissolveCore } from './react';

export type TaskCheckProps = CoreProps & {
  /** Outer wrapper classes (margins, separators). This is the part that closes up. */
  className?: string;
  style?: CSSProperties;
};

export function TaskCheck({ className, style, ...props }: TaskCheckProps) {
  const { host } = useDissolveCore(createTaskCheck, props);
  return <div ref={host} className={className} style={style} />;
}
