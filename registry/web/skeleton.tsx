'use client';
/**
 * Skeleton for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the placeholders and the handoff live in skeleton.core.ts.
 *
 * Loading placeholders that turn into the content grain by grain. Wrap each piece of content in a
 * SkeletonBlock with the shape it has while loading; its children only render once loading is
 * false, so they can read data that is not there yet.
 *
 * <Skeleton loading={!user}>
 *   <div className="flex items-center gap-4">
 *     <SkeletonBlock shape="circle" size={64}>
 *       <img src={user?.avatar} className="size-16 rounded-full object-cover" alt="" />
 *     </SkeletonBlock>
 *     <div className="flex flex-1 flex-col gap-1">
 *       <SkeletonBlock width={160} height={25}>
 *         <p className="text-xl font-semibold">{user?.name}</p>
 *       </SkeletonBlock>
 *       <SkeletonBlock width={96}>
 *         <p className="text-[15px] text-dissolve-muted">{user?.handle}</p>
 *       </SkeletonBlock>
 *     </div>
 *   </div>
 * </Skeleton>
 *
 * <Skeleton loading={loading} stagger={80} onReveal={() => track('feed_shown')}>
 *   <Skeleton.Block shape="rect" height={180} radius={20}>
 *     <Cover post={post} />
 *   </Skeleton.Block>
 *   <Skeleton.Block lines={3} height={22} className="mt-3">
 *     <p>{post?.body}</p>
 *   </Skeleton.Block>
 * </Skeleton>
 */
import { createContext, useCallback, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createSkeleton, type SkeletonBlockProps as CoreBlockProps, type SkeletonInstance, type SkeletonProps as CoreProps } from './skeleton.core';
import { useDissolveCore } from './react';

export type { SkeletonShape, SkeletonToken } from './skeleton.core';

export type SkeletonProps = CoreProps & {
  /** Any layout, with SkeletonBlocks anywhere inside it. */
  children: ReactNode;
  /** Root classes (padding, gap...). */
  className?: string;
  style?: CSSProperties;
};

export type SkeletonBlockProps = CoreBlockProps & {
  /** The real content. Rendered only once loading is false. */
  children?: ReactNode;
  /** Outer box style (margins, alignSelf, flex...). */
  style?: CSSProperties;
};

const Ctx = createContext<{ sk: SkeletonInstance | null; loading: boolean } | null>(null);

export function Skeleton({ children, className, style, ...props }: SkeletonProps) {
  const { host, instance } = useDissolveCore(createSkeleton, props);
  const ctx = useMemo(() => ({ sk: instance, loading: props.loading }), [instance, props.loading]);
  return (
    <Ctx.Provider value={ctx}>
      <div ref={host} className={className} style={style}>{children}</div>
    </Ctx.Provider>
  );
}

/**
 * One placeholder and the content it stands for. While loading it shows the placeholder (shape,
 * width, height); once loading is false its children render and the placeholder's grains
 * recompose them.
 */
export function SkeletonBlock(props: SkeletonBlockProps) {
  const ctx = useContext(Ctx);
  if (!ctx?.sk) return <div style={props.style} />;
  return <Block {...props} sk={ctx.sk} loading={ctx.loading} />;
}

function Block({ children, style, sk, loading, ...props }: SkeletonBlockProps & { sk: SkeletonInstance; loading: boolean }) {
  const create = useCallback((el: HTMLElement, p: CoreBlockProps) => sk.block(el, p), [sk]);
  const { host, instance } = useDissolveCore(create, props);
  return <div ref={host} style={style}>{instance && !loading ? createPortal(children, instance.slot) : null}</div>;
}

/** Skeleton.Block: the same SkeletonBlock, in the dotted form. */
Skeleton.Block = SkeletonBlock;
