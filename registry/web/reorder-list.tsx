'use client';
/**
 * ReorderList for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the drag, the slides and the grains live in reorder-list.core.ts.
 *
 * A list you reorder by drag, like Reminders or Things. Long press a row (or grab its handle): it
 * lifts, leans with the pointer and follows it, the other rows slide out of the way, and the list
 * scrolls by itself near its edges. On release the row settles, then onReorder runs. With
 * onDelete, drag a row far to the side to turn it to dust. Give the list a height to scroll it.
 *
 * <ReorderList
 *   data={tasks}
 *   keyExtractor={(t) => t.id}
 *   renderItem={({ item }) => <TaskRow task={item} />}
 *   onReorder={(next) => setTasks(next)}
 *   itemClassName="rounded-2xl bg-dissolve-surface"
 *   gap={8}
 *   className="h-[420px]"
 * />
 *
 * <ReorderList handle data={tasks} keyExtractor={(t) => t.id} onReorder={setTasks} renderItem={({ item }) => (
 *   <TaskRow task={item}>
 *     <ReorderHandle />
 *   </TaskRow>
 * )} />
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createReorderList, type ReorderListProps as CoreProps } from './reorder-list.core';
import { useDissolveCore } from './react';

export type ReorderListRenderInfo<T> = { item: T; index: number; dragging: boolean };

export type ReorderListProps<T> = Omit<CoreProps<T>, 'onReorder' | 'contentContainerStyle' | 'onDragChange'> & {
  /** A row. dragging is true while it is lifted. */
  renderItem: (info: ReorderListRenderInfo<T>) => ReactNode;
  /** Called once the dropped row has settled, with the reordered copy of data. */
  onReorder: (data: T[], from: number, to: number) => void;
  /** Scroll above and below the rows. */
  header?: ReactNode;
  footer?: ReactNode;
  /** Root classes. Give the list a height (or a max height): it scrolls by itself. */
  className?: string;
  style?: CSSProperties;
  /** Scroll content padding and the like. */
  contentContainerStyle?: CSSProperties;
};

export function ReorderList<T>({ renderItem, header, footer, className, style, contentContainerStyle, ...props }: ReorderListProps<T>) {
  const [dragging, setDragging] = useState<string | null>(null);
  const { host, instance } = useDissolveCore(createReorderList<T>, {
    ...props,
    contentContainerStyle: contentContainerStyle as CoreProps<T>['contentContainerStyle'],
    onDragChange: setDragging,
  });
  return (
    <div ref={host} className={className} style={style}>
      {instance ? (
        <>
          {createPortal(header, instance.header)}
          {props.data.map((item, index) => {
            const key = props.keyExtractor(item, index);
            return createPortal(renderItem({ item, index, dragging: dragging === key }), instance.row(key), key);
          })}
          {createPortal(footer, instance.footer)}
        </>
      ) : null}
    </div>
  );
}

/** Drag handle: three bars, or your own children. Inside a `handle` list only the handle lifts a row; in any list it lifts at once. */
export function ReorderHandle({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div data-reorder-handle="" aria-hidden="true" className={className}>
      {children ?? [0, 1, 2].map((i) => <span key={i} className="dissolve-reorder-bar" />)}
    </div>
  );
}
