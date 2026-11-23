'use client';
/**
 * PagerTabs for React on the web, from dissolve (dissolve-ui). This file is yours. Same props
 * as the React Native version; the pager itself lives in pager-tabs.core.ts.
 *
 * Tabs above swipeable pages. A soft pill follows the swipe the whole way behind the tabs, the
 * label on it turns to full ink, a click on a tab glides to its page, and the row scrolls to keep the active
 * tab in view. Arrow keys, Home and End on the tabs.
 *
 * <PagerTabs
 *   tabs={['For you', 'Following', 'Design']}
 *   renderPage={(tab, i) => <Feed topic={tab} />}
 *   onIndexChange={setTopic}
 *   style={{ height: 600 }}
 * />
 *
 * Give it a height: the pages fill it under the tabs, each scrolls on its own. Change the page
 * from code with a ref: ref.current?.select(2).
 */
import { useImperativeHandle, type CSSProperties, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { createPagerTabs, type PagerTabsProps as CoreProps } from './pager-tabs.core';
import { useDissolveCore } from './react';

export type PagerTabsHandle = {
  select: (index: number, animated?: boolean) => void;
};

export type PagerTabsProps = CoreProps & {
  ref?: Ref<PagerTabsHandle>;
  tabs: readonly string[];
  /** The page of tab i. */
  renderPage: (tab: string, index: number) => ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function PagerTabs({ ref, tabs, renderPage, className, style, ...props }: PagerTabsProps) {
  const { host, instance, current } = useDissolveCore(createPagerTabs, { ...props, tabs });
  useImperativeHandle(ref, () => ({ select: (i, animated) => current.current?.select(i, animated) }), [current]);
  return (
    <div ref={host} className={className} style={style}>
      {instance ? tabs.map((t, i) => (instance.pages[i] ? createPortal(renderPage(t, i), instance.pages[i], `${i}-${t}`) : null)) : null}
    </div>
  );
}
