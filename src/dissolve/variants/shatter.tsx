import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  FilterMode,
  MipmapMode,
  RadialGradient,
  Skia,
  TileMode,
  Vertices,
  vec,
  type SkPoint,
} from '@shopify/react-native-skia';
import { makeMutable, useAnimatedReaction, useSharedValue, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { CustomVariant, RendererProps } from '../types';

/**
 * GROUP E. shatter: glass shards drawn with Skia <Vertices mode="triangles">, textured
 * by the snapshot (docs/VARIANTS.md section 8).
 *
 * Mesh (JS, once): polar grid around the impact point (P.ox, P.oy, local), 10 to 14
 * jittered rays and rings that widen away from the impact. Each cell is split in two
 * triangles, every triangle is clipped to the view rect, and each clipped polygon is one
 * shard (fan triangulated). The shards tile the rect exactly, so at t = 0 the mesh is a
 * pixel perfect copy of the view.
 *
 * Frame (UI, one reaction): per shard, with t its local time
 *   gap = 1.5 * min(1, t / 0.08)                     cracks open
 *   T   = t * sec * life                             real seconds
 *   pos = g + u * gap + v0 * T + (0, 450 T^2)         gravity 900 pt/s^2
 *   ang = (r3 - 0.5) * 6 t,  fy = cos(r4 * 3 pi t)    pseudo 3D flip
 *   vertex = pos + R(ang) * (ax, ay * fy)
 *   light = 0.6 + 0.4 |fy|, a = 1 - ss((t - 0.6) / 0.4), glint = sin(phi)^6
 *
 * Shard count: opts.n[0] (P.n0), default 220, clamped to 60..400.
 * Direction 'in' plays the timeline backwards, so the last frame is the exact view.
 */

/**
 * Per shard floats:
 * 0 gx, 1 gy (centroid, local), 2 vx, 3 vy (launch velocity pt/s), 4 ux, 5 uy (crack
 * direction), 6 spin (r3 - 0.5), 7 flip (r4), 8 delay, 9 life, 10 vStart, 11 vCount.
 */
const SS = 12;
const DEFAULT_SHARDS = 220;
const GRAVITY_HALF = 450;
const PI3 = Math.PI * 3;

type Pt = { x: number; y: number };

type Mesh = {
  count: number;
  vcount: number;
  sd: number[];
  /** Per vertex offset from the shard centroid (local). */
  ax: number[];
  ay: number[];
  /** Per vertex rest position (local), for the exact t = 0 pose. */
  rx: number[];
  ry: number[];
  /** Texture coords in image pixels. */
  tex: SkPoint[];
  /** Impact point (local) and flash radius. */
  ox: number;
  oy: number;
  flashR: number;
};

// ---------------------------------------------------------------- mesh (JS only)

/** Sutherland-Hodgman clip of a convex polygon against the rect [0, w] x [0, h]. */
function clipRect(poly: Pt[], w: number, h: number): Pt[] {
  const planes: ((p: Pt) => number)[] = [(p) => p.x, (p) => w - p.x, (p) => p.y, (p) => h - p.y];
  let out = poly;
  for (const f of planes) {
    if (out.length === 0) break;
    const inp = out;
    out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i];
      const b = inp[(i + 1) % inp.length];
      const fa = f(a);
      const fb = f(b);
      if (fa >= 0) out.push(a);
      if (fa >= 0 !== fb >= 0) {
        const u = fa / (fa - fb);
        out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
      }
    }
  }
  return out;
}

/** Signed area and area weighted centroid of a polygon. */
function centroid(poly: Pt[]) {
  let A = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = a.x * b.y - b.x * a.y;
    A += c;
    cx += (a.x + b.x) * c;
    cy += (a.y + b.y) * c;
  }
  A /= 2;
  if (Math.abs(A) < 1e-9) return { A: 0, x: poly[0].x, y: poly[0].y };
  return { A, x: cx / (6 * A), y: cy / (6 * A) };
}

/**
 * Polar grid around (ox, oy) clipped to the rect: S jittered rays, geometric rings of
 * ratio q starting near 12 pt, up to an outer ring that covers every corner.
 *
 * Validity: rays jitter by +-15% of a sector, rings by +-6% of their radius. A cell is
 * simple (no fold, no hole) when the inner chord never reaches the outer one, i.e.
 * q * 0.94 * cos(1.3 * sector / 2) > 1.06. With S >= 10 and q >= 1.4 that holds
 * (1.4 * 0.94 * 0.918 = 1.21 > 1.06), so the shards always tile the rect exactly.
 */
function polarShards(w: number, h: number, ox: number, oy: number, maxD: number, q: number, S: number): Pt[][] {
  const base = Math.random() * Math.PI * 2;
  const sector = (Math.PI * 2) / S;
  const rMin = Math.min(14, Math.max(8, maxD * 0.04));
  // The last ring is never jittered and sits past maxD / cos(sector / 2), so its chords
  // stay outside the rect and the clipped mesh covers every corner.
  const rEnd = (maxD / Math.cos(sector / 2)) * 1.05;
  const radii: number[] = [0];
  for (let r = rMin; ; r *= q) {
    if (r >= rEnd) {
      radii.push(r);
      break;
    }
    radii.push(r);
  }
  const rings = radii.length;
  const grid: Pt[][] = [];
  for (let k = 0; k < rings; k++) {
    const row: Pt[] = [];
    const last = k === rings - 1;
    for (let j = 0; j < S; j++) {
      if (k === 0) {
        row.push({ x: ox, y: oy });
        continue;
      }
      // Every ring jitters the rays again so the cracks wander instead of being straight.
      const th = base + j * sector + (last ? 0 : (Math.random() - 0.5) * 0.3 * sector);
      const r = last ? radii[k] : radii[k] * (1 + (Math.random() - 0.5) * 0.12);
      row.push({ x: ox + Math.cos(th) * r, y: oy + Math.sin(th) * r });
    }
    grid.push(row);
  }
  const out: Pt[][] = [];
  const keep = (tri: Pt[]) => {
    const c = clipRect(tri, w, h);
    if (c.length >= 3 && Math.abs(centroid(c).A) > 1e-4) out.push(c);
  };
  for (let k = 0; k < rings - 1; k++) {
    for (let j = 0; j < S; j++) {
      const j2 = (j + 1) % S;
      const A = grid[k][j];
      const B = grid[k][j2];
      const C = grid[k + 1][j2];
      const D = grid[k + 1][j];
      // Pick a random diagonal, but only one that keeps both triangles inside the cell
      // (same winding), so a jitter-bent cell never leaves a hole or a fold.
      const cross = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
      const acOk = cross(A, B, C) * cross(A, C, D) > 0;
      const bdOk = cross(A, B, D) * cross(B, C, D) > 0;
      if (k === 0) {
        keep([A, C, D]);
      } else if (acOk && (!bdOk || Math.random() < 0.5)) {
        keep([A, B, C]);
        keep([A, C, D]);
      } else {
        keep([A, B, D]);
        keep([B, C, D]);
      }
    }
  }
  return out;
}

function buildMesh(
  w: number,
  h: number,
  ox: number,
  oy: number,
  target: number,
  prx: number,
  pry: number,
  fvx: number,
  fvy: number,
): Mesh {
  const cx = Math.min(w, Math.max(0, ox));
  const cy = Math.min(h, Math.max(0, oy));
  const maxD = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(w - cx, cy),
    Math.hypot(cx, h - cy),
    Math.hypot(w - cx, h - cy),
    1,
  );
  let S = 10 + Math.floor(Math.random() * 5);
  let q = 1.8;
  let polys = polarShards(w, h, cx, cy, maxD, q, S);
  // Tighten the rings, then add rays, until the clipped mesh reaches the target count.
  // Thin views lose most cells to the clip, so they end up with more rays.
  for (let guard = 0; polys.length < target && guard < 80; guard++) {
    if (q > 1.42) q -= 0.06;
    else if (S < 64) S += 2;
    else break;
    polys = polarShards(w, h, cx, cy, maxD, q, S);
  }

  const sd: number[] = [];
  const ax: number[] = [];
  const ay: number[] = [];
  const rx: number[] = [];
  const ry: number[] = [];
  const tex: SkPoint[] = [];
  for (const poly of polys) {
    const g = centroid(poly);
    let ux = g.x - cx;
    let uy = g.y - cy;
    const len = Math.hypot(ux, uy);
    if (len < 1e-3) {
      const a = Math.random() * Math.PI * 2;
      ux = Math.cos(a);
      uy = Math.sin(a);
    } else {
      ux /= len;
      uy /= len;
    }
    const dn = Math.min(1, len / maxD);
    const r1 = Math.random();
    const r2 = Math.random();
    const r3 = Math.random();
    const r4 = Math.random();
    // delay <= 0.2 and life 0.8: every shard reaches t = 1 exactly at the end of the
    // timeline (no pop when the overlay is removed, exact rest pose for entrances).
    const delay = dn * 0.15 + r1 * 0.05;
    const life = 0.8;
    const speed = (120 + r2 * 200) * (1 - 0.6 * dn);
    const vStart = ax.length;
    for (let i = 1; i < poly.length - 1; i++) {
      const tri = [poly[0], poly[i], poly[i + 1]];
      for (const p of tri) {
        ax.push(p.x - g.x);
        ay.push(p.y - g.y);
        rx.push(p.x);
        ry.push(p.y);
        tex.push({ x: p.x * prx, y: p.y * pry });
      }
    }
    sd.push(
      g.x,
      g.y,
      ux * speed + fvx * 0.3,
      uy * speed + fvy * 0.3,
      ux,
      uy,
      r3 - 0.5,
      r4,
      delay,
      life,
      vStart,
      ax.length - vStart,
    );
  }
  return {
    count: polys.length,
    vcount: ax.length,
    sd,
    ax,
    ay,
    rx,
    ry,
    tex,
    ox: cx,
    oy: cy,
    flashR: Math.min(170, Math.max(60, maxD * 0.55)),
  };
}

// ---------------------------------------------------------------- frame (worklet)

/**
 * Writes the pose of every shard for the normalised time tn (0..1, already reversed for
 * entrances) into pts / cols / glint, in place. Runs on the UI thread every frame and
 * once on the JS thread for the initial pose. Pure function of tn.
 */
function shardFrame(
  tn: number,
  count: number,
  sd: number[],
  ax: number[],
  ay: number[],
  rx: number[],
  ry: number[],
  X: number,
  Y: number,
  sec: number,
  pts: { x: number; y: number }[],
  cols: Float32Array[],
  glint: Float32Array[],
) {
  'worklet';
  for (let i = 0; i < count; i++) {
    const k = i * SS;
    const delay = sd[k + 8];
    const life = sd[k + 9];
    const vs = sd[k + 10];
    const ve = vs + sd[k + 11];
    let t = (tn - delay) / life;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    if (t === 0) {
      // Exact rest pose: same numbers as the textures, so the copy is pixel perfect.
      for (let v = vs; v < ve; v++) {
        const p = pts[v];
        p.x = X + rx[v];
        p.y = Y + ry[v];
        const c = cols[v];
        c[0] = 1;
        c[1] = 1;
        c[2] = 1;
        c[3] = 1;
        glint[v][3] = 0;
      }
      continue;
    }
    const gap = t < 0.08 ? (1.5 * t) / 0.08 : 1.5;
    const T = t * sec * life;
    const px = X + sd[k] + sd[k + 4] * gap + sd[k + 2] * T;
    const py = Y + sd[k + 1] + sd[k + 5] * gap + sd[k + 3] * T + GRAVITY_HALF * T * T;
    const ang = sd[k + 6] * 6 * t;
    const phi = sd[k + 7] * PI3 * t;
    const fy = Math.cos(phi);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const f = t <= 0.6 ? 0 : (t - 0.6) / 0.4;
    const a = t >= 1 ? 0 : 1 - f * f * (3 - 2 * f);
    const light = 0.6 + 0.4 * Math.abs(fy);
    const sp = Math.sin(phi);
    const s2 = sp * sp;
    const gl = sp > 0 ? 0.55 * s2 * s2 * s2 * a : 0;
    for (let v = vs; v < ve; v++) {
      const lx = ax[v];
      const ly = ay[v] * fy;
      const p = pts[v];
      p.x = px + ca * lx - sa * ly;
      p.y = py + sa * lx + ca * ly;
      const c = cols[v];
      c[0] = light;
      c[1] = light;
      c[2] = light;
      c[3] = a;
      glint[v][3] = gl;
    }
  }
}

/** White impact flash: radius and opacity for the normalised time tn (exits only). */
function flashAt(tn: number, R: number) {
  'worklet';
  const g = tn / 0.22;
  const u = 1 - (g > 1 ? 1 : g);
  const r = R * (1 - u * u * u);
  const fd = tn / 0.3;
  const fc = fd > 1 ? 1 : fd;
  const fin = tn / 0.015;
  const op = tn <= 0 ? 0 : 0.85 * (1 - fc * fc * (3 - 2 * fc)) * (fin > 1 ? 1 : fin);
  return { r: r < 0.5 ? 0.5 : r, op };
}

// ---------------------------------------------------------------- renderer

function ShatterRenderer({ burst, progress, end }: RendererProps) {
  const { image, params: P } = burst;
  const rev = burst.direction === 'in';
  const X = P.x;
  const Y = P.y;
  const sec = P.sec;

  const M = useMemo(() => {
    const target = Math.round(Math.min(400, Math.max(60, P.n0 > 0 ? P.n0 : DEFAULT_SHARDS)));
    const prx = image.width() / P.w;
    const pry = image.height() / P.h;
    const mesh = buildMesh(P.w, P.h, P.ox, P.oy, target, prx, pry, P.vx, P.vy);

    // Initial pose with the same worklet, so the first frame is already correct
    // (exact copy for exits, everything gone for entrances).
    const p0 = burst.start.p;
    const tn0 = (rev ? end - p0 : p0) / end;
    const pts0: { x: number; y: number }[] = [];
    const cols0: Float32Array[] = [];
    const glint0: Float32Array[] = [];
    for (let v = 0; v < mesh.vcount; v++) {
      pts0.push({ x: X + mesh.rx[v], y: Y + mesh.ry[v] });
      cols0.push(new Float32Array([1, 1, 1, 1]));
      glint0.push(new Float32Array([0.94, 0.97, 1, 0]));
    }
    shardFrame(tn0, mesh.count, mesh.sd, mesh.ax, mesh.ay, mesh.rx, mesh.ry, X, Y, sec, pts0, cols0, glint0);
    const f0 = rev ? { r: 0.5, op: 0 } : flashAt(tn0, mesh.flashR);

    // Paints passed by reference: the Vertices blendMode prop then only sets the
    // vertex color / shader blend (modulate), not the paint blend on the canvas.
    const shardPaint = Skia.Paint();
    shardPaint.setShader(image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None));
    const glintPaint = Skia.Paint();
    glintPaint.setColor(Skia.Color('white'));

    return {
      ...mesh,
      pts: makeMutable(pts0),
      cols: makeMutable(cols0),
      glint: makeMutable(glint0),
      fr0: f0.r,
      fo0: f0.op,
      shardPaint,
      glintPaint,
    };
    // The burst is immutable for the lifetime of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flashR = useSharedValue(M.fr0);
  const flashO = useSharedValue(M.fo0);
  const { count, sd, ax, ay, rx, ry, pts, cols, glint, flashR: FR } = M;

  useAnimatedReaction(
    // progress is read HERE, directly, so the mapper tracks it.
    () => progress.value,
    (p, prev) => {
      if (p === prev) return;
      const tn = (rev ? end - p : p) / end;
      const PT = pts.value;
      const C = cols.value;
      const G = glint.value;
      shardFrame(tn, count, sd, ax, ay, rx, ry, X, Y, sec, PT, C, G);
      // Same in place notify trick as Particles.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pts as any)._value = PT;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cols as any)._value = C;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (glint as any)._value = G;
      if (!rev) {
        const f = flashAt(tn, FR);
        flashR.value = f.r;
        flashO.value = f.op;
      }
    },
  );

  const center = vec(X + M.ox, Y + M.oy);
  // Skia types colors as string[], it also accepts Float32Array colors at runtime.
  const colsProp = cols as unknown as SharedValue<string[]>;
  const glintProp = glint as unknown as SharedValue<string[]>;

  return (
    <>
      {/* Each Vertices drawn with a paint reference is the LAST node of its canvas. */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Vertices
          vertices={pts}
          textures={M.tex}
          colors={colsProp}
          mode="triangles"
          blendMode="modulate"
          paint={M.shardPaint}
        />
      </Canvas>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {!rev && (
          <Circle c={center} r={flashR} opacity={flashO}>
            <RadialGradient c={center} r={flashR} colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']} />
          </Circle>
        )}
        <Vertices vertices={pts} colors={glintProp} mode="triangles" blendMode="modulate" paint={M.glintPaint} />
      </Canvas>
    </>
  );
}

export const shatter: CustomVariant = {
  kind: 'custom',
  name: 'shatter',
  info: 'Breaks like glass into spinning triangular shards.',
  defaultGrain: 3,
  end: 1,
  resolve: ({ opts, duration }) => ({
    // One sharp impact when the glass breaks, then light ticks as shards fly.
    // For an entrance the impact lands when the pieces lock back together.
    haptics: () => {
      if (opts.direction === 'in') {
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid), duration * 0.97);
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      [0.07, 0.16, 0.26].forEach((f) => setTimeout(() => Haptics.selectionAsync(), duration * f));
    },
  }),
  Renderer: ShatterRenderer,
};
