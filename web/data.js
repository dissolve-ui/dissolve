// Site content model. One entry per sidebar page.
// Variant page content (options, best practices) lives in variants-content.js.

export const GETTING_STARTED = [
  { id: 'introduction', title: 'Introduction' },
  { id: 'installation', title: 'Installation' },
  { id: 'agent-prompt', title: 'Agent prompt', badge: 'New' },
];

export const GROUPS = [
  { label: 'Exits', ids: ['dust', 'sand', 'ember', 'pixel', 'vortex', 'shatter', 'stream'] },
  { label: 'Entrances', ids: ['gather', 'rain', 'print'] },
  { label: 'Gestures', ids: ['snap', 'fling', 'charge'] },
  { label: 'Special', ids: ['pile', 'morph'] },
  { label: 'Casual', ids: ['peel', 'melt'] },
];

export const VARIANTS = {
  dust: { title: 'Dust', desc: 'Any view snapshots into grains that drift away on the wind, left edge first.', hook: 'useDissolve' },
  sand: { title: 'Sand', desc: 'Grains pour straight down with gravity and pile out of frame.', hook: 'useDissolve' },
  ember: { title: 'Ember', desc: 'Burns from the edge and rises as sparks tinted by the view itself.', hook: 'useDissolve' },
  pixel: { title: 'Pixel', desc: 'A blocky, stepped collapse for retro and game UIs.', hook: 'useDissolve' },
  vortex: { title: 'Vortex', desc: 'Grains spiral into the center and vanish.', hook: 'useDissolve' },
  shatter: { title: 'Shatter', desc: 'Glass shards break away from the point of impact.', hook: 'useDissolve' },
  stream: { title: 'Stream', desc: 'The view flies into a target, like a file dropped in the trash.', hook: 'useDissolve' },
  gather: { title: 'Gather', desc: 'Grains converge from a loose cloud into the view.', hook: 'DissolveIn' },
  rain: { title: 'Rain', desc: 'Grains fall and settle, bottom row first.', hook: 'DissolveIn' },
  print: { title: 'Print', desc: 'The view is printed in, line by line.', hook: 'useAppear' },
  snap: { title: 'Snap', desc: 'Bursts outward from the exact point you touched.', hook: 'useDissolve' },
  fling: { title: 'Fling', desc: 'Follows the velocity of the swipe that threw it away.', hook: 'useDissolve' },
  charge: { title: 'Charge', desc: 'Hold to heat the view up, it bursts at full charge.', hook: 'useDissolveHold' },
  pile: { title: 'Pile', desc: 'Grains fall and collect into a pile you can sweep later.', hook: 'usePile' },
  morph: { title: 'Morph', desc: 'View A breaks down and rebuilds itself as view B.', hook: 'useDissolveMorph' },
  peel: { title: 'Peel', desc: 'Peels off from the corner like a sticker, then flies away.', hook: 'useDissolvePeel' },
  melt: { title: 'Melt', desc: 'Melts down in drips, like wax under a lamp.', hook: 'useDissolve' },
};

export const ORDER = GROUPS.flatMap((g) => g.ids);
