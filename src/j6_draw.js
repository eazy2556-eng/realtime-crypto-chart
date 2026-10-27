
// ───────── 작도 도구 ─────────
const svgI = (d, extra = '') => `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra}</svg>`;
const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="1.7" style="fill:var(--bg)"/>`;
const DW_TOOLS = {
  cursor: { name: '십자선', icon: svgI('<path d="M9 2v5M9 11v5M2 9h5M11 9h5"/>'), key: 'Esc' },
  trend: { name: '추세선', n: 2, icon: svgI('<path d="M3.5 14.5l11-11"/>', dot(3.5, 14.5) + dot(14.5, 3.5)), key: 'Alt+T', steps: ['시작점을 클릭하세요', '끝점을 클릭하세요'] },
  ray: { name: '레이', n: 2, icon: svgI('<path d="M3.5 14.5L17 1"/>', dot(3.5, 14.5) + dot(9, 9)), steps: ['시작점을 클릭하세요', '방향을 정할 점을 클릭하세요'] },
  ext: { name: '연장선', n: 2, icon: svgI('<path d="M1 17L17 1"/>', dot(6, 12) + dot(12, 6)), steps: ['첫 점을 클릭하세요', '둘째 점을 클릭하세요'] },
  arrow: { name: '화살표', n: 2, icon: svgI('<path d="M3 15L15 3M9 3h6v6"/>'), steps: ['시작점을 클릭하세요', '화살표 끝을 클릭하세요'] },
  hline: { name: '수평선 · 가격 알림', n: 1, icon: svgI('<path d="M2 9h14"/>', dot(9, 9)), key: 'Alt+H', steps: ['수평선을 그릴 가격을 클릭하세요'] },
  hray: { name: '수평 레이', n: 1, icon: svgI('<path d="M4 9h13"/>', dot(4, 9)), steps: ['시작점을 클릭하세요'] },
  vline: { name: '수직선', n: 1, icon: svgI('<path d="M9 1v16"/>', dot(9, 9)), key: 'Alt+V', steps: ['시점을 클릭하세요'] },
  channel: { name: '평행 채널', n: 3, icon: svgI('<path d="M2 11L11 2M7 16l9-9"/>'), steps: ['첫 점을 클릭하세요', '둘째 점을 클릭하세요', '채널 폭을 정할 점을 클릭하세요'] },
  pitchfork: { name: '피치포크', n: 3, icon: svgI('<path d="M2 9h15M8 4h9M8 14h9M2 9l6-5M2 9l6 5"/>'), steps: ['손잡이(시작점)를 클릭하세요', '위쪽 점을 클릭하세요', '아래쪽 점을 클릭하세요'] },
  fib: { name: '피보나치 되돌림', n: 2, icon: svgI('<path d="M2 3h14M2 7h14M2 11h14M2 15h14"/>'), key: 'Alt+F', steps: ['시작점(1)을 클릭하세요', '끝점(0)을 클릭하세요'] },
  fibext: { name: '피보나치 확장', n: 3, icon: svgI('<path d="M8 3h9M8 7h9M8 11h9M1 16l3-9 3 5"/>'), steps: ['추세 시작점을 클릭하세요', '추세 끝점을 클릭하세요', '되돌림 지점을 클릭하세요'] },
  rect: { name: '사각형', n: 2, icon: svgI('<rect x="3" y="4" width="12" height="10" rx="1"/>'), steps: ['한 모서리를 클릭하세요', '반대 모서리를 클릭하세요'] },
  ellipse: { name: '원', n: 2, icon: svgI('<ellipse cx="9" cy="9" rx="7" ry="5.5"/>'), steps: ['한 모서리를 클릭하세요', '반대 모서리를 클릭하세요'] },
  text: { name: '텍스트', n: 1, icon: svgI('<path d="M4 4h10M9 4v11"/>'), steps: ['글자를 넣을 자리를 클릭하세요'] },
  crossline: { name: '교차선', n: 1, icon: svgI('<path d="M9 1v16M1 9h16"/>', dot(9, 9)), steps: ['교차점을 클릭하세요'] },
  regression: { name: '회귀 추세 (±2σ)', n: 2, icon: svgI('<path d="M2 11L16 5"/><path d="M2 7.5l14-6M2 14.5l14-6" stroke-dasharray="2 2"/>'), steps: ['계산을 시작할 봉을 클릭하세요', '계산을 끝낼 봉을 클릭하세요'] },
  fibtime: { name: '피보나치 시간대', n: 2, icon: svgI('<path d="M2 2v14M4.5 2v14M7 2v14M10.5 2v14M16 2v14"/>'), steps: ['기준 시점(0)을 클릭하세요', '한 칸(1)이 될 시점을 클릭하세요'] },
  triangle: { name: '삼각형', n: 3, icon: svgI('<path d="M9 3l7 12H2z"/>'), steps: ['첫 꼭짓점을 클릭하세요', '둘째 꼭짓점을 클릭하세요', '셋째 꼭짓점을 클릭하세요'] },
  elliott: { name: '엘리엇 충격파 (0-5)', n: 6, icon: svgI('<path d="M1.5 15l3-6 2.5 3 3.5-8 2 4.5 4-5"/>'), steps: ['0 지점을 클릭하세요', '1 지점을 클릭하세요', '2 지점을 클릭하세요', '3 지점을 클릭하세요', '4 지점을 클릭하세요', '5 지점을 클릭하세요'] },
  pricelabel: { name: '가격 라벨', n: 1, icon: svgI('<path d="M2 9l4-4.5h10v9H6z"/>'), steps: ['가격을 표시할 자리를 클릭하세요'] },
  arrowup: { name: '위 화살표 표시', n: 1, icon: svgI('<path d="M9 2.5l5 6h-3v7H7v-7H4z"/>'), steps: ['표시할 자리를 클릭하세요 (화살표 끝이 그 자리)'] },
  arrowdown: { name: '아래 화살표 표시', n: 1, icon: svgI('<path d="M9 15.5l5-6h-3v-7H7v7H4z"/>'), steps: ['표시할 자리를 클릭하세요 (화살표 끝이 그 자리)'] },
  brush: { name: '브러시', n: 0, icon: svgI('<path d="M2.5 14c2-1 2.5-4 4.5-4s1.5 3 3.5 3 2.5-5 5-6"/>'), steps: ['누른 채로 끌어서 그리세요'] },
  highlighter: { name: '형광펜', n: 0, icon: svgI('<path d="M2.5 13.5c3-2.5 6-1 9-4" stroke-width="4" opacity=".45"/><path d="M11.5 3.5l3 3-5 5H6.5v-3z"/>'), steps: ['누른 채로 끌어서 칠하세요'] },
  measure: { name: '측정 (가격·기간)', n: 2, icon: svgI('<path d="M2 13L13 2l3 3L5 16z"/><path d="M5.5 9.5l1.5 1.5M8 7l1.5 1.5M10.5 4.5L12 6"/>'), key: 'Alt+M', steps: ['시작점을 클릭하세요', '끝점을 클릭하세요'] },
  long: { name: '롱 포지션', n: 2, icon: svgI('<path d="M3 9h12"/>', '<rect x="3" y="3" width="12" height="6" style="fill:var(--up-soft)" stroke="none"/><rect x="3" y="9" width="12" height="5" style="fill:var(--down-soft)" stroke="none"/>'), steps: ['진입 가격을 클릭하세요', '목표 가격과 끝 시점을 클릭하세요'] },
  short: { name: '숏 포지션', n: 2, icon: svgI('<path d="M3 9h12"/>', '<rect x="3" y="3" width="12" height="6" style="fill:var(--down-soft)" stroke="none"/><rect x="3" y="9" width="12" height="5" style="fill:var(--up-soft)" stroke="none"/>'), steps: ['진입 가격을 클릭하세요', '목표 가격과 끝 시점을 클릭하세요'] },
};
const DW_GROUPS = [
  { id: 'line', label: '선', tools: ['trend', 'ray', 'ext', 'arrow', 'hline', 'hray', 'vline', 'crossline'] },
  { id: 'chan', label: '채널', tools: ['channel', 'regression', 'pitchfork'] },
  { id: 'fib', label: '피보나치', tools: ['fib', 'fibext', 'fibtime'] },
  { id: 'shape', label: '도형', tools: ['rect', 'ellipse', 'triangle'] },
  { id: 'wave', label: '파동', tools: ['elliott'] },
  { id: 'brush', label: '브러시', tools: ['brush', 'highlighter'] },
  { id: 'text', label: '텍스트·표시', tools: ['text', 'pricelabel', 'arrowup', 'arrowdown'] },
  { id: 'measure', label: '측정·포지션', tools: ['measure', 'long', 'short'] },
];
const DW_DEFAULT_COLOR = { rect: '#ab47bc', ellipse: '#ab47bc', triangle: '#ab47bc', text: 'fg', arrowup: '#089981', arrowdown: '#f23645', highlighter: '#f0b90b' };
const FREE = ['brush', 'highlighter']; // 손으로 그리는 도구 (점이 많다)
const FIBT = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const ICON_LOCK = svgI('<rect x="4" y="8" width="10" height="7.5" rx="1.2"/><path d="M6 8V5.5a3 3 0 0 1 6 0V8"/>');
const ICON_UNLOCK = svgI('<rect x="4" y="8" width="10" height="7.5" rx="1.2"/><path d="M6 8V5.5a3 3 0 0 1 5.8-1"/>');
const SWATCHES = ['#2962ff', '#f23645', '#089981', '#f0b90b', '#ab47bc', '#00bcd4', 'fg'];
const FIB = [[0, '#787b86'], [0.236, '#f23645'], [0.382, '#ff9800'], [0.5, '#4caf50'], [0.618, '#089981'], [0.786, '#00bcd4'], [1, '#787b86'], [1.618, '#2962ff'], [2.618, '#f23645']];
const FIBX = [[0, '#787b86'], [0.382, '#f23645'], [0.618, '#ff9800'], [1, '#089981'], [1.272, '#00bcd4'], [1.618, '#2962ff'], [2, '#ab47bc'], [2.618, '#f23645']];
const FONT = '11px "IBM Plex Sans KR", -apple-system, "Segoe UI", "Malgun Gothic", sans-serif';
const EXT = 1e5;
const DW = { list: [], sel: null, draft: null, drag: null, undo: [], justDragged: false, qm: null }; // qm: Shift+클릭 임시 측정

// 시간(ms) ↔ 차트 칸 번호. 봉이 없는 미래·과거는 봉 길이로 늘려서 계산
function tToLogical(t) {
  const b = S.bars, n = b.length;
  if (!n) return null;
  if (t <= b[0].t) return (t - b[0].t) / barMs();
  if (t >= b[n - 1].t) return n - 1 + (t - b[n - 1].t) / barMs();
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (b[m].t <= t) lo = m; else hi = m; }
  return lo + (t - b[lo].t) / (b[hi].t - b[lo].t);
}
function logicalToT(l) {
  const b = S.bars, n = b.length, i = Math.round(l);
  if (i < 0) return b[0].t + i * barMs();
  if (i < n) return b[i].t;
  let t = b[n - 1].t;
  for (let k = n; k <= i && k - n < 5000; k++) t = nextBucket(t, spec);
  return t;
}
const colorOf = c => c === 'fg' ? C.fg : c;
function xyOf(pt) {
  const l = tToLogical(pt.t);
  return { x: l == null ? null : chart.timeScale().logicalToCoordinate(l), y: mainSeries ? mainSeries.priceToCoordinate(pt.p) : null };
}
const ptsOf = d => d.ghost ? d.pts.concat([d.ghost]) : d.pts;
function anchorAt(x, y) {
  const l = chart.timeScale().coordinateToLogical(x);
  let p = mainSeries.coordinateToPrice(y);
  if (l == null || p == null) return null;
  const i = Math.round(l), b = S.bars[i];
  if (prefs.magnet && b) { // 자석: 가장 가까운 시가·고가·저가·종가에 붙이기
    let best = p, bd = Infinity;
    for (const v of [b.open, b.high, b.low, b.close]) { const yy = mainSeries.priceToCoordinate(v); if (yy != null && Math.abs(yy - y) < bd) { bd = Math.abs(yy - y); best = v; } }
    p = best;
  }
  return { t: logicalToT(l), p: roundTick(p) };
}
function extendPt(a, b, len = EXT) { const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1; return { x: a.x + dx / L * len, y: a.y + dy / L * len }; }
function regOf(pts) { // 두 시점 사이 종가의 선형 회귀와 표준편차 (위아래 선은 ±2σ)
  const n = S.bars.length;
  if (pts.length < 2 || !n) return null;
  const la = tToLogical(pts[0].t), lb = tToLogical(pts[1].t);
  if (la == null || lb == null) return null;
  const i0 = Math.max(0, Math.round(Math.min(la, lb))), i1 = Math.min(n - 1, Math.round(Math.max(la, lb))), m = i1 - i0 + 1;
  if (m < 3) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0, ss = 0;
  for (let i = i0; i <= i1; i++) { const x = i - i0, y = S.bars[i].close; sx += x; sy += y; sxy += x * y; sxx += x * x; }
  const b = (m * sxy - sx * sy) / (m * sxx - sx * sx), a = (sy - b * sx) / m;
  for (let i = i0; i <= i1; i++) { const r = S.bars[i].close - (a + b * (i - i0)); ss += r * r; }
  return { i0, i1, y0: a, y1: a + b * (m - 1), dev: 2 * Math.sqrt(ss / m), rev: la > lb };
}
function regSegs(g) {
  const ts = chart.timeScale(), x0 = ts.logicalToCoordinate(g.i0), x1 = ts.logicalToCoordinate(g.i1), Y = v => mainSeries.priceToCoordinate(v);
  if (x0 == null || x1 == null) return [];
  return [0, g.dev, -g.dev].map(o => [{ x: x0, y: Y(g.y0 + o) }, { x: x1, y: Y(g.y1 + o) }]).filter(([a, b]) => a.y != null && b.y != null);
}
const tTag = t => { const z = zDate(t); return `${pad(z.getUTCMonth() + 1)}.${pad(z.getUTCDate())} ${pad(z.getUTCHours())}:${pad(z.getUTCMinutes())}`; };
function chanOffset(P) { const [a, b, c] = P; const yb = b.x === a.x ? a.y : a.y + (b.y - a.y) * (c.x - a.x) / (b.x - a.x); return c.y - yb; }
function lineSegs(d, P) {
  switch (d.type) {
    case 'trend': case 'arrow': return P.length > 1 ? [[P[0], P[1]]] : [];
    case 'ray': return P.length > 1 ? [[P[0], extendPt(P[0], P[1])]] : [];
    case 'ext': return P.length > 1 ? [[extendPt(P[1], P[0]), extendPt(P[0], P[1])]] : [];
    case 'hray': return [[P[0], { x: EXT, y: P[0].y }]];
    case 'vline': return [[{ x: P[0].x, y: -EXT }, { x: P[0].x, y: EXT }]];
    case 'channel': {
      if (P.length < 2) return [];
      const s = [[P[0], P[1]]];
      if (P.length > 2) { const dy = chanOffset(P); s.push([{ x: P[0].x, y: P[0].y + dy }, { x: P[1].x, y: P[1].y + dy }]); }
      return s;
    }
    case 'pitchfork': {
      if (P.length < 3) return P.length > 1 ? [[P[0], P[1]]] : [];
      const m = { x: (P[1].x + P[2].x) / 2, y: (P[1].y + P[2].y) / 2 }, dx = m.x - P[0].x, dy = m.y - P[0].y;
      const far = q => extendPt(q, { x: q.x + dx, y: q.y + dy });
      return [[P[0], far(P[0])], [P[1], far(P[1])], [P[2], far(P[2])], [P[1], P[2]]];
    }
    case 'fibext': return P.length > 1 ? [[P[0], P[1]]].concat(P.length > 2 ? [[P[1], P[2]]] : []) : [];
    case 'crossline': return [[{ x: P[0].x, y: -EXT }, { x: P[0].x, y: EXT }], [{ x: -EXT, y: P[0].y }, { x: EXT, y: P[0].y }]];
    case 'fibtime': return (P.length > 1 ? FIBT : [0]).map(k => { const x = P[0].x + (P.length > 1 ? (P[1].x - P[0].x) * k : 0); return [{ x, y: -EXT }, { x, y: EXT }]; });
    case 'regression': { const g = regOf(ptsOf(d)); return g ? regSegs(g) : P.length > 1 ? [[P[0], P[1]]] : []; }
    case 'triangle': return P.length > 1 ? [[P[0], P[1]]].concat(P.length > 2 ? [[P[1], P[2]], [P[2], P[0]]] : []) : [];
    case 'elliott': case 'brush': case 'highlighter': return P.slice(1).map((q, k) => [P[k], q]);
  }
  return [];
}
const rectOf = (a, b) => ({ x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) });
function posGeom(d, P, pts) { // 롱·숏 포지션 상자
  const e = pts[0].p, tg = pts[1].p, st = pts[2] ? pts[2].p : 2 * e - tg;
  const x1 = Math.min(P[0].x, P[1].x), x2 = Math.max(P[1].x, P[0].x + 40);
  return { e, tg, st, x1, x2, yE: mainSeries.priceToCoordinate(e), yT: mainSeries.priceToCoordinate(tg), yS: mainSeries.priceToCoordinate(st) };
}
function areaOf(d, P, pts) {
  switch (d.type) {
    case 'rect': case 'ellipse': case 'measure': case 'fib': return P.length > 1 ? rectOf(P[0], P[1]) : null;
    case 'long': case 'short': { if (P.length < 2) return null; const g = posGeom(d, P, pts); if (g.yT == null || g.yS == null) return null; return { x1: g.x1, x2: g.x2, y1: Math.min(g.yT, g.yS), y2: Math.max(g.yT, g.yS) }; }
    case 'channel': { if (P.length < 3) return null; const dy = chanOffset(P); return { poly: [P[0], P[1], { x: P[1].x, y: P[1].y + dy }, { x: P[0].x, y: P[0].y + dy }] }; }
    case 'triangle': return P.length > 2 ? { poly: P.slice(0, 3) } : null;
    case 'arrowup': case 'arrowdown': { const s = 8 + 3 * d.w, up = d.type === 'arrowup'; return { x1: P[0].x - s, x2: P[0].x + s, y1: up ? P[0].y : P[0].y - 2.6 * s, y2: up ? P[0].y + 2.6 * s : P[0].y }; }
    case 'pricelabel': return { x1: P[0].x - 3, x2: P[0].x + 20 + fp(pts[0].p).length * 7, y1: P[0].y - 26, y2: P[0].y + 3 };
  }
  return null;
}
function inArea(a, x, y) {
  if (!a.poly) return x >= a.x1 && x <= a.x2 && y >= a.y1 && y <= a.y2;
  let inside = false;
  for (let i = 0, j = a.poly.length - 1; i < a.poly.length; j = i++) {
    const p = a.poly[i], q = a.poly[j];
    if ((p.y > y) !== (q.y > y) && x < (q.x - p.x) * (y - p.y) / (q.y - p.y) + p.x) inside = !inside;
  }
  return inside;
}
function segDist(x, y, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L)) : 0;
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
}
const fsz = d => 10 + 2 * d.w;
function dwHit(x, y) {
  if (prefs.hideDw || !mainSeries) return null;
  for (let k = DW.list.length - 1; k >= 0; k--) {
    const d = DW.list[k], P = d.pts.map(xyOf);
    if (P.some(q => q.x == null || q.y == null)) continue;
    if (!FREE.includes(d.type)) for (let i = 0; i < P.length; i++) if (Math.hypot(P[i].x - x, P[i].y - y) <= 7) return { d, mode: 'anchor', idx: i };
    const tol = d.type === 'highlighter' ? 5 + 3 * d.w : 5;
    for (const [a, b] of lineSegs(d, P)) if (segDist(x, y, a, b) <= tol) return { d, mode: 'body' };
    const ar = areaOf(d, P, d.pts);
    if (ar && inArea(ar, x, y)) return { d, mode: 'body' };
    if (d.type === 'text') { const w = (d.text || '').length * fsz(d) * 0.62 + 8; if (x >= P[0].x - 4 && x <= P[0].x + w && y >= P[0].y - fsz(d) - 6 && y <= P[0].y + 4) return { d, mode: 'body' }; }
  }
  return null;
}

// ── 그리기 ──
function strokeLine(ctx, a, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function tag(ctx, text, x, y, bg, align = 'left') { // 색 배경 라벨
  ctx.font = FONT;
  const w = ctx.measureText(text).width + 10, lx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  ctx.fillStyle = bg; rr(ctx, lx, y - 9, w, 18, 3); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, lx + 5, y);
}
function txt(ctx, text, x, y, color, align = 'left') { ctx.font = FONT; ctx.textAlign = align; ctx.textBaseline = 'bottom'; ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.textAlign = 'left'; }
function fmtDur(ms) {
  ms = Math.abs(ms);
  const u = [['일', DAY], ['시간', 36e5], ['분', 6e4], ['초', 1e3]], out = [];
  for (const [l, v] of u) { const k = Math.floor(ms / v); if (k) { out.push(k + l); ms -= k * v; } if (out.length === 2) break; }
  return out.join(' ') || '0초';
}
function drawOne(ctx, d, size, sel) {
  const pts = ptsOf(d), P = pts.map(xyOf);
  if (!P.length || P.some(q => q.x == null || q.y == null)) return;
  const col = colorOf(d.color);
  ctx.save();
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = d.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (d.type) {
    case 'trend': case 'ray': case 'ext': case 'hray': case 'vline': case 'pitchfork': case 'crossline': case 'elliott':
      for (const [a, b] of lineSegs(d, P)) strokeLine(ctx, a, b);
      if (d.type === 'hray') tag(ctx, fp(pts[0].p), Math.min(P[0].x + 6, size.width - 90), P[0].y - 12, col);
      if (d.type === 'vline' || d.type === 'crossline') tag(ctx, tTag(pts[0].t), P[0].x, size.height - 14, col, 'center');
      if (d.type === 'crossline') tag(ctx, fp(pts[0].p), size.width - 4, P[0].y, col, 'right');
      if (d.type === 'elliott') P.forEach((q, k) => { // 꼭대기는 위에, 바닥은 아래에 번호
        const nb = [P[k - 1], P[k + 1]].filter(Boolean), peak = !nb.length || nb.every(o => q.y <= o.y);
        tag(ctx, String(k), q.x, q.y + (peak ? -14 : 14), col, 'center');
      });
      break;
    case 'fibtime': {
      lineSegs(d, P).forEach(([a, b], k) => { strokeLine(ctx, a, b); if (P.length > 1) txt(ctx, String(FIBT[k]), a.x + 4, 16, col); });
      if (P.length > 1) { ctx.save(); ctx.setLineDash([4, 4]); ctx.lineWidth = 1; strokeLine(ctx, P[0], P[1]); ctx.restore(); }
      break;
    }
    case 'regression': {
      const g = regOf(pts);
      if (!g) { if (P.length > 1) { ctx.setLineDash([4, 4]); strokeLine(ctx, P[0], P[1]); } break; }
      const segs = regSegs(g);
      if (segs.length === 3) {
        const [, u, l] = segs;
        ctx.fillStyle = hexA(col, .08); ctx.beginPath(); ctx.moveTo(u[0].x, u[0].y); ctx.lineTo(u[1].x, u[1].y); ctx.lineTo(l[1].x, l[1].y); ctx.lineTo(l[0].x, l[0].y); ctx.closePath(); ctx.fill();
      }
      segs.forEach(([a, b], k) => { ctx.save(); if (k) { ctx.setLineDash([6, 4]); ctx.lineWidth = 1; } strokeLine(ctx, a, b); ctx.restore(); });
      if (!d.ghost && d.pts.length === 2) { d.pts[g.rev ? 1 : 0].p = roundTick(g.y0); d.pts[g.rev ? 0 : 1].p = roundTick(g.y1); } // 손잡이를 회귀선 끝에 맞춤
      break;
    }
    case 'brush': case 'highlighter': { // 점 사이를 부드럽게 잇는다
      if (P.length < 2) break;
      if (d.type === 'highlighter') { ctx.globalAlpha = .38; ctx.lineWidth = 6 + 4 * d.w; }
      ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
      for (let i = 1; i < P.length - 1; i++) ctx.quadraticCurveTo(P[i].x, P[i].y, (P[i].x + P[i + 1].x) / 2, (P[i].y + P[i + 1].y) / 2);
      ctx.lineTo(P[P.length - 1].x, P[P.length - 1].y); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'triangle': {
      if (P.length > 2) { ctx.fillStyle = hexA(col, .12); ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); ctx.lineTo(P[1].x, P[1].y); ctx.lineTo(P[2].x, P[2].y); ctx.closePath(); ctx.fill(); }
      for (const [a, b] of lineSegs(d, P)) strokeLine(ctx, a, b);
      break;
    }
    case 'pricelabel': {
      ctx.lineWidth = 1; strokeLine(ctx, P[0], { x: P[0].x + 8, y: P[0].y - 14 });
      ctx.beginPath(); ctx.arc(P[0].x, P[0].y, 2.5, 0, Math.PI * 2); ctx.fill();
      tag(ctx, fp(pts[0].p), P[0].x + 8, P[0].y - 14, col);
      break;
    }
    case 'arrowup': case 'arrowdown': { // 화살표 끝이 클릭한 자리
      const s = 8 + 3 * d.w, k = d.type === 'arrowup' ? 1 : -1, x = P[0].x, y = P[0].y;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y + k * s); ctx.lineTo(x + s * .4, y + k * s); ctx.lineTo(x + s * .4, y + k * 2.6 * s);
      ctx.lineTo(x - s * .4, y + k * 2.6 * s); ctx.lineTo(x - s * .4, y + k * s); ctx.lineTo(x - s, y + k * s); ctx.closePath(); ctx.fill();
      break;
    }
    case 'arrow': {
      if (P.length < 2) break;
      strokeLine(ctx, P[0], P[1]);
      const ang = Math.atan2(P[1].y - P[0].y, P[1].x - P[0].x), L = 10 + 2 * d.w;
      ctx.beginPath(); ctx.moveTo(P[1].x, P[1].y); ctx.lineTo(P[1].x - L * Math.cos(ang - .45), P[1].y - L * Math.sin(ang - .45));
      ctx.lineTo(P[1].x - L * Math.cos(ang + .45), P[1].y - L * Math.sin(ang + .45)); ctx.closePath(); ctx.fill();
      break;
    }
    case 'channel': {
      const segs = lineSegs(d, P);
      if (P.length > 2) {
        const dy = chanOffset(P);
        ctx.fillStyle = hexA(col, .1); ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); ctx.lineTo(P[1].x, P[1].y); ctx.lineTo(P[1].x, P[1].y + dy); ctx.lineTo(P[0].x, P[0].y + dy); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.setLineDash([4, 4]); ctx.lineWidth = 1; strokeLine(ctx, { x: P[0].x, y: P[0].y + dy / 2 }, { x: P[1].x, y: P[1].y + dy / 2 }); ctx.restore();
      }
      for (const [a, b] of segs) strokeLine(ctx, a, b);
      break;
    }
    case 'fib': case 'fibext': {
      const isExt = d.type === 'fibext';
      if (P.length < 2 || (isExt && P.length < 3)) { ctx.setLineDash([4, 4]); for (const [a, b] of lineSegs(d, P).concat(!isExt && P.length > 1 ? [[P[0], P[1]]] : [])) strokeLine(ctx, a, b); break; }
      const levels = isExt ? FIBX : FIB;
      const x1 = isExt ? P[2].x : Math.min(P[0].x, P[1].x), x2 = isExt ? P[2].x + Math.max(60, Math.abs(P[1].x - P[0].x)) : Math.max(P[0].x, P[1].x);
      const priceAt = lv => isExt ? pts[2].p + (pts[1].p - pts[0].p) * lv : pts[1].p + (pts[0].p - pts[1].p) * lv;
      let prevY = null;
      for (const [lv, c] of levels) {
        const y = mainSeries.priceToCoordinate(priceAt(lv));
        if (y == null) continue;
        if (prevY != null) { ctx.fillStyle = hexA(c, .07); ctx.fillRect(x1, Math.min(prevY, y), x2 - x1, Math.abs(y - prevY)); }
        ctx.strokeStyle = c; ctx.lineWidth = d.w; strokeLine(ctx, { x: x1, y }, { x: x2, y });
        txt(ctx, `${lv} (${fp(priceAt(lv))})`, x1 + 4, y - 2, c);
        prevY = y;
      }
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      for (const [a, b] of isExt ? lineSegs(d, P) : [[P[0], P[1]]]) strokeLine(ctx, a, b);
      ctx.restore();
      break;
    }
    case 'rect': case 'ellipse': {
      if (P.length < 2) break;
      const r = rectOf(P[0], P[1]);
      ctx.fillStyle = hexA(col, .12);
      ctx.beginPath();
      if (d.type === 'rect') ctx.rect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
      else ctx.ellipse((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2, (r.x2 - r.x1) / 2, (r.y2 - r.y1) / 2, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'text': {
      ctx.font = `600 ${fsz(d)}px "IBM Plex Sans KR", -apple-system, "Segoe UI", "Malgun Gothic", sans-serif`;
      ctx.textBaseline = 'bottom'; ctx.lineWidth = 3; ctx.strokeStyle = C.bg;
      const s = d.text || '텍스트';
      ctx.strokeText(s, P[0].x, P[0].y); ctx.fillText(s, P[0].x, P[0].y);
      break;
    }
    case 'measure': {
      if (P.length < 2) break;
      const r = rectOf(P[0], P[1]), up = pts[1].p >= pts[0].p, c = up ? '#2962ff' : '#f23645';
      ctx.fillStyle = hexA(c, .15); ctx.fillRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
      ctx.strokeStyle = c; ctx.lineWidth = 1;
      const mx = (r.x1 + r.x2) / 2, my = (r.y1 + r.y2) / 2;
      strokeLine(ctx, { x: mx, y: P[0].y }, { x: mx, y: P[1].y }); strokeLine(ctx, { x: P[0].x, y: my }, { x: P[1].x, y: my });
      const dp = pts[1].p - pts[0].p, pc = pts[0].p ? dp / pts[0].p * 100 : 0, bars = Math.round(tToLogical(pts[1].t) - tToLogical(pts[0].t));
      tag(ctx, `${dp >= 0 ? '+' : ''}${fp(dp)} (${fpct(pc)})`, mx, r.y2 + 14, c, 'center');
      tag(ctx, `${Math.abs(bars)}봉 · ${fmtDur(pts[1].t - pts[0].t)}`, mx, r.y2 + 34, c, 'center');
      const l0 = tToLogical(pts[0].t), l1 = tToLogical(pts[1].t), i0 = Math.max(0, Math.round(Math.min(l0, l1))), i1 = Math.min(S.bars.length - 1, Math.round(Math.max(l0, l1)));
      if (i1 >= i0) { let vol = 0; for (let i = i0; i <= i1; i++) vol += S.bars[i].volume; tag(ctx, `거래량 ${fvol(vol)}`, mx, r.y2 + 54, c, 'center'); }
      break;
    }
    case 'long': case 'short': {
      if (P.length < 2) break;
      const g = posGeom(d, P, pts);
      if (g.yE == null || g.yT == null || g.yS == null) break;
      const w = g.x2 - g.x1;
      ctx.fillStyle = 'rgba(8,153,129,.2)'; ctx.fillRect(g.x1, Math.min(g.yE, g.yT), w, Math.abs(g.yT - g.yE));
      ctx.fillStyle = 'rgba(242,54,69,.2)'; ctx.fillRect(g.x1, Math.min(g.yE, g.yS), w, Math.abs(g.yS - g.yE));
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1; strokeLine(ctx, { x: g.x1, y: g.yE }, { x: g.x2, y: g.yE });
      const isLong = d.type === 'long', gain = (isLong ? g.tg - g.e : g.e - g.tg) / g.e * 100, loss = Math.abs(g.e - g.st) / g.e * 100;
      const ratio = Math.abs(g.e - g.st) ? Math.abs(g.tg - g.e) / Math.abs(g.e - g.st) : 0, cx = g.x1 + w / 2;
      tag(ctx, `목표 ${fp(g.tg)} (${fpct(gain)})`, cx, g.yT + (g.yT < g.yE ? -12 : 12), '#089981', 'center');
      tag(ctx, `손절 ${fp(g.st)} (${fpct(-loss)})`, cx, g.yS + (g.yS < g.yE ? -12 : 12), '#f23645', 'center');
      tag(ctx, `${isLong ? '롱' : '숏'} ${fp(g.e)} · 손익비 ${ratio.toFixed(2)}`, cx, g.yE, '#5d606b', 'center');
      break;
    }
  }
  if (sel && FREE.includes(d.type)) { // 손그림은 손잡이 대신 테두리
    const xs = P.map(q => q.x), ys = P.map(q => q.y), m = d.type === 'highlighter' ? 4 + 2 * d.w : 4;
    ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.globalAlpha = 1; ctx.strokeStyle = C.accent;
    ctx.strokeRect(Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) - Math.min(...xs) + 2 * m, Math.max(...ys) - Math.min(...ys) + 2 * m);
  } else if (sel) {
    ctx.setLineDash([]); ctx.lineWidth = 1.5;
    for (const q of d.pts.map(xyOf)) { if (q.x == null || q.y == null) continue; ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2); ctx.fillStyle = C.bg; ctx.fill(); ctx.strokeStyle = col === C.fg ? C.accent : col; ctx.stroke(); }
  }
  ctx.restore();
}
class DrawLayer {
  constructor() { this.views = [{ zOrder: () => 'top', renderer: () => this }]; }
  attached(p) { this.req = p.requestUpdate; }
  detached() { this.req = null; }
  updateAllViews() {}
  paneViews() { return this.views; }
  draw(target) {
    if (!mainSeries || !S.bars.length) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      if (!prefs.hideDw) for (const d of DW.list) drawOne(ctx, d, mediaSize, d.id === DW.sel);
      if (DW.draft) drawOne(ctx, DW.draft, mediaSize, true);
      if (DW.qm) drawOne(ctx, DW.qm, mediaSize, false);
    });
  }
}
const drawLayer = new DrawLayer();
const dwRedraw = () => { if (drawLayer.req) drawLayer.req(); };

// ── 저장 · 되돌리기 ──
function dwLoad() {
  const arr = store.get('bc:dw:' + symKey(), []);
  DW.list = (Array.isArray(arr) ? arr : []).filter(d => d && DW_TOOLS[d.type] && Array.isArray(d.pts) && d.pts.every(p => isN(p.t) && isN(p.p)));
  DW.sel = null; DW.draft = null; DW.undo = []; DW.qm = null;
  renderDwBar(); dwRedraw();
}
const dwSave = () => { store.set('bc:dw:' + symKey(), DW.list); if (SYNC.onChange) SYNC.onChange(); };
function dwSnap() { DW.undo.push(JSON.stringify({ dw: DW.list, hl: S.hlines.map(h => h.price) })); if (DW.undo.length > 50) DW.undo.shift(); }
function dwUndo() {
  const s = DW.undo.pop();
  if (!s) { toast('되돌릴 작업이 없어요.'); return; }
  const o = JSON.parse(s);
  DW.list = o.dw; DW.sel = null; dwSave();
  for (const h of S.hlines) { try { mainSeries.removePriceLine(h.line); } catch {} }
  S.hlines = o.hl.map(price => ({ price, line: mainSeries.createPriceLine(hlineOpts({ price }, false)), lastAlert: 0 }));
  saveHlines(); renderDwBar(); dwRedraw();
}
const dwSelected = () => DW.list.find(d => d.id === DW.sel) || null;
function dwSelect(id) { DW.sel = id; renderDwBar(); dwRedraw(); }
function dwDelete(id) {
  const d = DW.list.find(x => x.id === id);
  if (!d) return;
  dwSnap(); DW.list = DW.list.filter(x => x !== d); DW.sel = null; dwSave(); renderDwBar(); dwRedraw();
  toast(`${DW_TOOLS[d.type].name}을 지웠어요. Ctrl+Z로 되돌릴 수 있어요.`);
}
function renderDwBar() {
  const d = dwSelected(), bar = $('#dwBar');
  if (!d) { bar.hidden = true; return; }
  const fixed = ['fib', 'fibext', 'long', 'short', 'measure'].includes(d.type);
  bar.innerHTML = `<span class="muted" style="font-size:12px;padding:0 4px;white-space:nowrap">${DW_TOOLS[d.type].name}</span><span class="vs"></span>`
    + (fixed ? '' : SWATCHES.map(c => `<button type="button" class="sw" data-sw="${c}" style="background:${colorOf(c)}" aria-label="색 바꾸기 ${c === 'fg' ? '기본 글자색' : c}" aria-pressed="${d.color === c}"></button>`).join('') + '<span class="vs"></span>')
    + [1, 2, 3, 4].map(w => `<button type="button" class="wbtn" data-w="${w}" aria-pressed="${d.w === w}" title="${d.type === 'text' ? '글자 크기' : '선 두께'} ${w}">${d.type === 'text' ? fsz({ w }) + 'px' : w + 'px'}</button>`).join('')
    + (d.type === 'text' ? `<span class="vs"></span><button type="button" class="wbtn" data-dwact="edit">글자 수정</button>` : '')
    + `<span class="vs"></span><button type="button" class="wbtn" data-dwact="clone" title="복제 — 오른쪽에 하나 더">복제</button>`
    + (AL_DRAW.includes(d.type) && !EMBED ? `<button type="button" class="icon-btn" data-dwact="alert" title="이 선을 가격이 지나가면 알림" aria-label="알림 만들기">${ICON_BELL}</button>` : '')
    + `<button type="button" class="icon-btn" data-dwact="lock" aria-pressed="${!!d.lock}" title="${d.lock ? '잠금 풀기' : '잠금 — 끌어도 움직이지 않게'}" aria-label="${d.lock ? '잠금 풀기' : '잠금'}">${d.lock ? ICON_LOCK : ICON_UNLOCK}</button>`
    + `<button type="button" class="icon-btn" data-dwact="del" title="삭제 (Delete)" aria-label="삭제">${ICON_TRASH}</button>`;
  bar.hidden = false;
}
$('#dwBar').addEventListener('click', e => {
  const d = dwSelected();
  if (!d) return;
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.sw) { dwSnap(); d.color = b.dataset.sw; }
  else if (b.dataset.w) { dwSnap(); d.w = +b.dataset.w; }
  else if (b.dataset.dwact === 'del') return dwDelete(d.id);
  else if (b.dataset.dwact === 'alert') return addDrawAlert(d);
  else if (b.dataset.dwact === 'lock') { dwSnap(); if (d.lock) delete d.lock; else d.lock = true; }
  else if (b.dataset.dwact === 'clone') {
    dwSnap();
    const c = JSON.parse(JSON.stringify(d));
    c.id = newUid(); delete c.lock;
    c.pts = c.pts.map(q => ({ t: FREE.includes(c.type) ? logicalToTf(tToLogical(q.t) + 8) : logicalToT(Math.round(tToLogical(q.t)) + 8), p: q.p }));
    DW.list.push(c); dwSave(); dwSelect(c.id);
    toast(`${DW_TOOLS[d.type].name}을 복제했어요.`);
    return;
  }
  else if (b.dataset.dwact === 'edit') { const q = xyOf(d.pts[0]); return askText(d, q.x, q.y); }
  dwSave(); renderDwBar(); dwRedraw();
});

// ── 마우스로 만들기 · 옮기기 ──
function setTool(t) {
  if (DW.draft) { DW.draft = null; dwRedraw(); }
  S.tool = t;
  $('#mainPane').classList.toggle('brushing', FREE.includes(t)); // 휴대폰: 그리는 동안 화면이 스크롤되지 않게
  syncToolButtons();
  dwHint();
}
function dwHint() {
  const h = $('#drawHint'), tl = DW_TOOLS[S.tool];
  if (S.tool === 'cursor') { h.hidden = true; return; }
  const step = DW.draft ? DW.draft.pts.length : 0;
  h.textContent = `${tl.name}: ${tl.steps[Math.min(step, tl.steps.length - 1)]} · Esc 취소`;
  h.hidden = false;
}
function dwPlace(x, y) {
  const a = anchorAt(x, y);
  if (!a) return;
  const tl = DW_TOOLS[S.tool];
  if (!DW.draft) DW.draft = { id: newUid(), type: S.tool, pts: [], color: DW_DEFAULT_COLOR[S.tool] || '#2962ff', w: S.tool === 'text' ? 2 : 1 };
  DW.draft.pts.push(a); DW.draft.ghost = null;
  if (DW.draft.pts.length >= tl.n) {
    const d = DW.draft;
    DW.draft = null;
    delete d.ghost;
    if (d.type === 'long' || d.type === 'short') d.pts.push({ t: d.pts[0].t, p: roundTick(2 * d.pts[0].p - d.pts[1].p) });
    dwSnap(); DW.list.push(d); dwSave(); dwSelect(d.id);
    if (d.type === 'text') { const q = xyOf(d.pts[0]); askText(d, q.x, q.y, true); }
    if (!prefs.keepTool) setTool('cursor'); else dwHint();
  } else dwHint();
  dwRedraw();
}
function dwMove(p) {
  if (!p.point) return;
  if (DW.qm && !DW.qm.done) { DW.qm.ghost = anchorAt(p.point.x, p.point.y); dwRedraw(); }
  if (!DW.draft) return;
  DW.draft.ghost = anchorAt(p.point.x, p.point.y);
  dwRedraw();
}
let textTarget = null, textIsNew = false;
function askText(d, x, y, isNew) {
  textTarget = d; textIsNew = !!isNew;
  const f = $('#dwText'), pane = $('#mainPane');
  f.hidden = false;
  f.style.left = Math.max(8, Math.min(x, pane.clientWidth - 290)) + 'px';
  f.style.top = Math.max(8, Math.min(y + 8, pane.clientHeight - 60)) + 'px';
  $('#dwTextIn').value = d.text || '';
  $('#dwTextIn').focus();
}
function closeText(commit) {
  const f = $('#dwText');
  if (f.hidden) return;
  f.hidden = true;
  const d = textTarget; textTarget = null;
  if (!d) return;
  const v = $('#dwTextIn').value.trim();
  if (commit && v) d.text = v;
  if (!d.text) { DW.list = DW.list.filter(x => x !== d); DW.sel = null; renderDwBar(); }
  dwSave(); dwRedraw();
}
$('#dwText').addEventListener('submit', e => { e.preventDefault(); closeText(true); });
$('#dwTextIn').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeText(false); } });
$('#dwTextIn').addEventListener('blur', () => setTimeout(() => closeText(true), 120));

// 도형을 바로 끌어서 옮기기: 차트가 화면 이동을 시작하기 전에 가로챈다
// 시간 칸 번호(소수) → 시간(ms). 손그림이 봉 사이에서도 부드럽게 이어지도록
function logicalToTf(l) {
  const b = S.bars, n = b.length;
  if (!n) return 0;
  const i = Math.floor(l);
  if (i >= 0 && i < n - 1) return b[i].t + (l - i) * (b[i + 1].t - b[i].t);
  return i < 0 ? b[0].t + l * barMs() : b[n - 1].t + (l - (n - 1)) * barMs();
}
function simplifyPts(xy, eps) { // 화면 좌표 기준으로 거의 일직선인 점은 뺀다 (Douglas-Peucker)
  const keep = new Uint8Array(xy.length); keep[0] = keep[xy.length - 1] = 1;
  const st = [[0, xy.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    let mx = 0, mi = -1;
    for (let i = a + 1; i < b; i++) { const dd = segDist(xy[i].x, xy[i].y, xy[a], xy[b]); if (dd > mx) { mx = dd; mi = i; } }
    if (mx > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return keep;
}
// 브러시·형광펜: 누른 채로 끌어서 그린다
function brushStart(e) {
  const el = $('#mainChart'), r = el.getBoundingClientRect(), ts = chart.timeScale();
  const x0 = e.clientX - r.left, y0 = e.clientY - r.top;
  if (x0 > paneW(chart) || y0 > el.clientHeight - ts.height()) return;
  e.preventDefault(); e.stopImmediatePropagation();
  chart.applyOptions({ handleScroll: false, handleScale: false });
  const d = { id: newUid(), type: S.tool, pts: [], color: DW_DEFAULT_COLOR[S.tool] || '#2962ff', w: S.tool === 'highlighter' ? 2 : 2 }, xy = [];
  const add = (x, y) => {
    const q = xy[xy.length - 1];
    if (q && Math.hypot(x - q.x, y - q.y) < 2.5) return;
    const l = ts.coordinateToLogical(x), p = mainSeries.coordinateToPrice(y);
    if (l == null || p == null || d.pts.length >= 2000) return;
    d.pts.push({ t: logicalToTf(l), p }); xy.push({ x, y });
    DW.draft = d; dwRedraw();
  };
  add(x0, y0);
  const move = ev => add(ev.clientX - r.left, ev.clientY - r.top);
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    chart.applyOptions({ handleScroll: baseOptions().handleScroll, handleScale: baseOptions().handleScale });
    DW.draft = null;
    if (d.pts.length >= 2) {
      const keep = simplifyPts(xy, 0.8);
      d.pts = d.pts.filter((_, i) => keep[i]).slice(0, 600);
      dwSnap(); DW.list.push(d); dwSave(); dwSelect(d.id);
    }
    dwRedraw();
    if (!prefs.keepTool) setTool('cursor'); else dwHint();
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}
$('#mainChart').addEventListener('pointerdown', e => {
  if (FREE.includes(S.tool) && e.button === 0 && mainSeries && !RP.picking) return brushStart(e);
  if (S.tool !== 'cursor' || RP.picking || e.shiftKey || DW.qm || e.button !== 0 || !mainSeries) return; // Shift+클릭은 측정
  const r = $('#mainChart').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const hit = dwHit(x, y);
  if (!hit) return;
  dwSelect(hit.d.id); selectHline(-1);
  if (hit.d.lock) return; // 잠근 도형은 옮기지 않는다 (끌면 차트가 움직임)
  chart.applyOptions({ handleScroll: false, handleScale: false });
  const orig = JSON.parse(JSON.stringify(hit.d.pts)), l0 = chart.timeScale().coordinateToLogical(x), p0 = mainSeries.coordinateToPrice(y);
  DW.drag = { hit, orig, l0, p0, moved: false, snap: JSON.stringify({ dw: DW.list, hl: S.hlines.map(h => h.price) }) };
  const move = ev => {
    const xx = ev.clientX - r.left, yy = ev.clientY - r.top, g = DW.drag;
    if (!g) return;
    g.moved = true;
    const d = g.hit.d;
    if (g.hit.mode === 'anchor') {
      const a = anchorAt(xx, yy);
      if (!a) return;
      d.pts[g.hit.idx] = a;
      if ((d.type === 'long' || d.type === 'short') && g.hit.idx === 0 && d.pts[2]) d.pts[2].t = a.t;
      if ((d.type === 'long' || d.type === 'short') && g.hit.idx === 2) d.pts[2].t = d.pts[0].t;
    } else {
      const l = chart.timeScale().coordinateToLogical(xx), p = mainSeries.coordinateToPrice(yy);
      if (l == null || p == null || g.l0 == null || g.p0 == null) return;
      const dl = Math.round(l - g.l0), dp = p - g.p0;
      d.pts = FREE.includes(d.type) ? g.orig.map(q => ({ t: logicalToTf(tToLogical(q.t) + (l - g.l0)), p: q.p + dp }))
        : g.orig.map(q => ({ t: logicalToT(Math.round(tToLogical(q.t)) + dl), p: roundTick(q.p + dp) }));
    }
    dwRedraw();
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    chart.applyOptions({ handleScroll: baseOptions().handleScroll, handleScale: baseOptions().handleScale });
    const g = DW.drag; DW.drag = null;
    if (g && g.moved) { DW.undo.push(g.snap); if (DW.undo.length > 50) DW.undo.shift(); dwSave(); DW.justDragged = true; setTimeout(() => { DW.justDragged = false; }, 50); }
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}, true);

// ───────── 수평선 · 가격 알림 ─────────
function hlineOpts(h, sel) {
  return { price: h.price, color: C.accent, lineWidth: sel ? 2 : 1, lineStyle: LC.LineStyle.Solid, axisLabelVisible: true, title: sel ? 'Delete 키로 삭제' : '' };
}
function loadHlines() {
  const arr = store.get('bc:hl:' + symKey(), []);
  S.hlines = (Array.isArray(arr) ? arr : []).filter(isN).map(price => ({ price, line: null, lastAlert: 0 }));
  S.selHline = -1;
}
const saveHlines = () => { store.set('bc:hl:' + symKey(), S.hlines.map(h => h.price)); if (SYNC.onChange) SYNC.onChange(); };
const roundTick = v => +(Math.round(v / S.tick) * S.tick).toFixed(S.pricePrec);
function addHline(price) {
  dwSnap();
  const h = { price, line: null, lastAlert: 0 };
  h.line = mainSeries.createPriceLine(hlineOpts(h, false));
  S.hlines.push(h); saveHlines();
  toast(`${fp(price)}에 수평선을 그렸어요. 가격이 이 선을 지나가면 알려드려요.`);
}
function removeHline(i) {
  const h = S.hlines[i];
  if (!h) return;
  dwSnap();
  try { mainSeries.removePriceLine(h.line); } catch {}
  S.hlines.splice(i, 1); S.selHline = -1; saveHlines();
  toast(`${fp(h.price)} 수평선을 지웠어요.`);
}
function selectHline(i) {
  const old = S.hlines[S.selHline];
  if (old && old.line) old.line.applyOptions(hlineOpts(old, false));
  S.selHline = i;
  const h = S.hlines[i];
  if (h && h.line) h.line.applyOptions(hlineOpts(h, true));
}
function checkAlerts(prev, p) {
  const now = Date.now();
  for (const h of S.hlines) {
    if ((prev < h.price && p >= h.price) || (prev > h.price && p <= h.price)) {
      if (now - h.lastAlert < 10000) continue;
      h.lastAlert = now;
      const up = p >= h.price;
      toast(`${cur.title} ${fp(h.price)} ${up ? '상향' : '하향'} 돌파 · 현재 ${fp(p)}`, up ? 'up' : 'down');
      beep(up);
    }
  }
}
let actx = null;
document.addEventListener('pointerdown', () => {
  try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); else if (actx.state === 'suspended') actx.resume(); } catch {}
}, { passive: true });
function beep(up) {
  if (!actx || actx.state !== 'running') return;
  const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
  o.type = 'sine'; o.frequency.value = up ? 880 : 520;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.4);
}
function toast(msg, kind = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 4500);
}

// ───────── 차트 클릭 ─────────
// 차트 라이브러리의 클릭 이벤트는 빠른 두 번 클릭을 더블클릭으로 묶어 버려서, 클릭을 직접 판별한다
let tap = null;
const chartXY = e => { const r = $('#mainChart').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
$('#mainChart').addEventListener('pointerdown', e => { if (e.button === 0) { tap = chartXY(e); tap.shift = e.shiftKey; } }, true);
$('#mainChart').addEventListener('pointerup', e => {
  if (!tap || e.button !== 0) return;
  const q = chartXY(e), ok = Math.hypot(q.x - tap.x, q.y - tap.y) < 6, shift = tap.shift || e.shiftKey;
  tap = null;
  if (ok) onChartTap(q.x, q.y, shift);
}, true);
function onChartTap(x, y, shift) {
  if (!mainSeries || !S.bars.length) return;
  if (DW.justDragged) { DW.justDragged = false; return; }
  const ts = chart.timeScale();
  if (x > paneW(chart) || y > $('#mainChart').clientHeight - ts.height()) return; // 가격 축·시간 축 위는 무시
  if (RP.picking) return rpBegin(x);
  if (DW.qm) { // Shift+클릭 측정: 다음 클릭에서 끝나고, 그다음 클릭에서 사라진다
    if (!DW.qm.done) { const a = anchorAt(x, y); if (a) { DW.qm.pts[1] = a; delete DW.qm.ghost; DW.qm.done = true; } }
    else DW.qm = null;
    if (S.tool === 'cursor') $('#drawHint').hidden = true;
    dwRedraw();
    if (!shift || DW.qm) return;
  }
  if (shift && S.tool === 'cursor') { // 트레이딩뷰처럼 Shift+클릭으로 바로 측정 (저장하지 않음)
    const a = anchorAt(x, y);
    if (!a) return;
    DW.qm = { id: 'qm', type: 'measure', pts: [a], color: '#2962ff', w: 1 };
    const h = $('#drawHint'); h.textContent = '측정: 끝낼 곳을 클릭하세요 · Esc 취소'; h.hidden = false;
    dwRedraw();
    return;
  }
  if (S.tool === 'hline') {
    const raw = mainSeries.coordinateToPrice(y);
    if (raw == null || !isFinite(raw)) return;
    addHline(roundTick(raw));
    if (!prefs.keepTool) setTool('cursor');
    return;
  }
  if (FREE.includes(S.tool)) return; // 브러시는 누른 채로 끌 때 그린다
  if (S.tool !== 'cursor') return dwPlace(x, y);
  const hit = dwHit(x, y);
  if (hit) { dwSelect(hit.d.id); selectHline(-1); return; }
  if (DW.sel) dwSelect(null);
  let best = -1, bd = 7;
  S.hlines.forEach((h, i) => { const yy = mainSeries.priceToCoordinate(h.price); if (yy != null) { const d = Math.abs(yy - y); if (d < bd) { bd = d; best = i; } } });
  selectHline(best);
}
