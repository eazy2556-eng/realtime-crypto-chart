
// ───────── 가격 축 늘이기·줄이기 ─────────
// 오른쪽 가격 축을 위로 끌면 늘이고 아래로 끌면 줄인다. 휠도 되고, 더블클릭(두 번 탭)하면 자동 맞춤으로.
// 라이브러리 기본 기능은 퍼센트 축과 휴대폰에서 안 돼서, 자동 맞춤 범위를 직접 정하는 방식으로 만든다.
// 직접 늘인 동안에는 차트 안을 마우스로 위아래로 끌어 가격 범위를 옮길 수 있다.
const PZR = new Map(); // 차트 → { min, max } (직접 정한 가격 범위, 여백 제외). 없으면 자동 맞춤
function pzProvider(c, role, base) { // role: 'anchor'(범위를 정하는 시리즈) · 'other'(직접 정한 동안 자동 맞춤에서 빠짐)
  return orig => {
    const r = PZR.get(c);
    if (!r) return base ? base(orig) : orig();
    if (role === 'other') return null;
    return { priceRange: { minValue: r.min, maxValue: r.max } };
  };
}
function pzSeriesOf(c) {
  if (c === chart) return mainSeries;
  for (const R of RT.values()) if (R.chart === c && !R.inst.hidden) for (const pl of R.plots) { const s = R.series[pl.k]; if (s && (s.options().priceScaleId || 'right') === 'right') return s; }
  return null;
}
// 차트 칸 폭 (가격 축 제외). 아래 창이 있어 시간축을 숨기면 timeScale().width()가 0이 되므로 가격 축 폭으로 구한다
function paneW(c) { return c.chartElement().clientWidth - c.priceScale('right').width(); }
function pzHeight(c) { const el = c.chartElement(); return el.clientHeight - (c.timeScale().options().visible ? c.timeScale().height() : 0); }
const pzLog = c => c === chart && prefs.scale === 'log';
const pzIn = (c, v) => pzLog(c) ? Math.log(Math.max(v, 1e-12)) : v, pzOut = (c, v) => pzLog(c) ? Math.exp(v) : v;
function pzBase(c) { // 지금 보이는 범위 (위아래 여백을 뺀 자동 맞춤 범위로 환산)
  const s = pzSeriesOf(c);
  if (!s) return null;
  const H = pzHeight(c), m = c.priceScale('right').options().scaleMargins || { top: .1, bottom: .1 };
  const a = s.coordinateToPrice(H * m.top), b = s.coordinateToPrice(H * (1 - m.bottom));
  if (a == null || b == null || !isFinite(a) || !isFinite(b) || a === b) return null;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}
function pzScale(c, r, k) { // 가운데를 기준으로 k배
  const lo = pzIn(c, r.min), hi = pzIn(c, r.max), mid = (lo + hi) / 2, half = (hi - lo) / 2 * k;
  if (!(half > 0) || !isFinite(half)) return r;
  return { min: pzOut(c, mid - half), max: pzOut(c, mid + half) };
}
// 가격 축 설정을 다시 적용하면 차트 전체를 무겁게 다시 그려서, 시간축을 제자리에 다시 두는 가벼운 갱신으로
// 가격 범위만 다시 계산하게 한다. 한 화면(프레임)에 한 번만
const pzQ = new Set();
let pzRaf = 0;
function pzKick(c) {
  pzQ.add(c);
  if (pzRaf) return;
  pzRaf = requestAnimationFrame(() => {
    pzRaf = 0;
    for (const x of pzQ) { try { const ts = x.timeScale(); ts.scrollToPosition(ts.scrollPosition(), false); } catch {} }
    pzQ.clear();
  });
}
function pzSet(c, r) {
  const had = PZR.has(c);
  if (r) PZR.set(c, r); else if (had) PZR.delete(c); else return;
  pzKick(c);
  if (c === chart && had !== !!r) syncPzPill();
}
function pzResetAll() { for (const c of [...PZR.keys()]) pzSet(c, null); }
function syncPzPill() { $('#pzAuto').hidden = !PZR.has(chart); }
$('#pzAuto').addEventListener('click', () => pzSet(chart, null));

// 마우스·터치가 어느 차트의 가격 축 위인지
function pzTarget(e) {
  const el = e.target.closest && e.target.closest('.chart-area .chart');
  if (!el) return null;
  const c = el === $('#mainChart') ? chart : ([...PANES.values()].find(P => P.el.contains(el)) || {}).chart;
  if (!c || !pzSeriesOf(c)) return null;
  const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, H = pzHeight(c);
  return { c, el, x, y, H, onAxis: x > paneW(c) && y >= 0 && y <= H };
}
let pzLastTap = { t: 0, c: null };
$('.chart-area').addEventListener('pointerdown', e => {
  if (e.button !== 0 || RP.picking) return;
  const t = pzTarget(e);
  if (!t) return;
  if (t.onAxis) { // 가격 축 끌기
    const now = performance.now();
    if (now - pzLastTap.t < 320 && pzLastTap.c === t.c) { pzLastTap = { t: 0, c: null }; e.preventDefault(); pzSet(t.c, null); return; } // 두 번 누르면 자동 맞춤
    pzLastTap = { t: now, c: t.c };
    const base = PZR.get(t.c) || pzBase(t.c);
    if (!base) return;
    e.preventDefault(); e.stopPropagation();
    const top = t.el.getBoundingClientRect().top, H = t.H, y0 = H - t.y, pad = (H - 1) * .2;
    const move = ev => {
      const y = Math.max(0, H - (ev.clientY - top));
      pzSet(t.c, pzScale(t.c, base, Math.max(.05, (y0 + pad) / (y + pad)))); // 라이브러리와 같은 계산 (위로 끌면 늘어남)
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return;
  }
  // 직접 늘인 차트는 마우스로 위아래로 끌면 가격 범위도 따라 옮긴다 (좌우는 차트가 알아서)
  if (e.pointerType !== 'mouse' || S.tool !== 'cursor' || !PZR.has(t.c)) return;
  const r0 = PZR.get(t.c), s = pzSeriesOf(t.c), p0 = s.coordinateToPrice(t.y), top = t.el.getBoundingClientRect().top;
  if (p0 == null) return;
  const move = ev => {
    if (DW.drag) return; // 도형을 옮기는 중
    const p = s.coordinateToPrice(ev.clientY - top);
    if (p == null) return;
    const d = pzIn(t.c, p0) - pzIn(t.c, p);
    PZR.set(t.c, { min: pzOut(t.c, pzIn(t.c, r0.min) + d), max: pzOut(t.c, pzIn(t.c, r0.max) + d) }); // 끄는 동안 차트가 알아서 범위를 다시 계산한다
  };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}, true);
$('.chart-area').addEventListener('wheel', e => { // 가격 축 위에서 휠: 늘이기·줄이기
  const t = pzTarget(e);
  if (!t || !t.onAxis) return;
  const base = PZR.get(t.c) || pzBase(t.c);
  if (!base) return;
  e.preventDefault(); e.stopPropagation();
  pzSet(t.c, pzScale(t.c, base, e.deltaY > 0 ? 1.1 : 1 / 1.1));
}, { capture: true, passive: false });
$('.chart-area').addEventListener('dblclick', e => { const t = pzTarget(e); if (t && t.onAxis) { e.preventDefault(); pzSet(t.c, null); } }, true);
