
// ───────── 지표 그리기 ─────────
const ICON_X = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
const ICON_EYE = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1.5 9S4.2 4 9 4s7.5 5 7.5 5-2.7 5-7.5 5S1.5 9 1.5 9z"/><circle cx="9" cy="9" r="2.2"/></svg>';
const ICON_EYE_OFF = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M1.5 9S4.2 4 9 4s7.5 5 7.5 5-2.7 5-7.5 5S1.5 9 1.5 9z"/><circle cx="9" cy="9" r="2.2"/><path d="M3 15L15 3"/></svg>';
const ICON_GEAR = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M3 5h7M14 5h1M3 13h1M8 13h7"/><circle cx="12" cy="5" r="1.8"/><circle cx="6" cy="13" r="1.8"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h12M7 5V3.5h4V5M5 5l.7 9.5h6.6L13 5M7.5 8v4M10.5 8v4"/></svg>';
const ICON_MOVE = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2v14M2 9h14M9 2L7 4M9 2l2 2M9 16l-2-2M9 16l2-2M2 9l2-2M2 9l2 2M16 9l-2-2M16 9l-2 2"/></svg>';

function plotColor(R, pl) {
  if (pl.colorFrom) { const base = R.plots.find(q => q.k === pl.colorFrom); if (base) return plotColor(R, base); }
  return R.inst.colors[pl.k] || pl.color;
}
const plotWidth = (R, pl) => R.inst.widths[pl.k] || pl.width || R.inst.w || 1;
const precOf = (R, pl) => pl.prec !== undefined ? pl.prec : R.def.prec !== undefined ? R.def.prec : R.def.pane ? 2 : 'price';
const precDigits = p => p === 'price' ? S.pricePrec : p === 'price+' ? Math.min(8, S.pricePrec + 2) : p;
const fmtP = (v, p) => p === 'vol' ? fvol(v) : fmt(v, precDigits(p));
function pfOf(p) { if (p === 'vol') return { type: 'volume' }; const d = precDigits(p); return { type: 'price', precision: d, minMove: +Math.pow(10, -d).toFixed(d) }; }

// 두 선 사이 채우기(볼린저, 일목 구름 등) — 시리즈 프리미티브로 캔버스에 직접 그린다
class BandFill {
  constructor(R, f) { this.R = R; this.f = f; this.views = [{ zOrder: () => 'bottom', renderer: () => this }]; }
  attached(p) { this.chart = p.chart; this.series = p.series; }
  detached() { this.chart = this.series = null; }
  updateAllViews() {}
  paneViews() { return this.views; }
  draw(target) {
    const R = this.R, f = this.f;
    if (!this.chart || R.inst.hidden) return;
    const A = R.data[f.a], B = R.data[f.b];
    if (!A || !B) return;
    const ts = this.chart.timeScale(), vr = ts.getVisibleLogicalRange();
    if (!vr) return;
    const sh = f.shift || 0, n = S.bars.length;
    const i0 = Math.max(sh, Math.floor(vr.from) - 1), i1 = Math.min(n - 1 + sh, Math.ceil(vr.to) + 1);
    const pl = k => R.plots.find(p => p.k === k);
    const upC = hexA(plotColor(R, pl(f.color)), f.alpha), dnC = f.down ? hexA(plotColor(R, pl(f.down)), f.alpha) : upC;
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      let run = [], runUp = true, prev = null;
      const flushRun = () => {
        if (run.length > 1) {
          ctx.fillStyle = runUp ? upC : dnC; ctx.beginPath(); ctx.moveTo(run[0].x, run[0].a);
          for (let k = 1; k < run.length; k++) ctx.lineTo(run[k].x, run[k].a);
          for (let k = run.length - 1; k >= 0; k--) ctx.lineTo(run[k].x, run[k].b);
          ctx.closePath(); ctx.fill();
        }
        run = [];
      };
      for (let i = i0; i <= i1; i++) {
        const a = A[i - sh], b = B[i - sh];
        if (!isN(a) || !isN(b)) { flushRun(); prev = null; continue; }
        const x = ts.logicalToCoordinate(i), ya = this.series.priceToCoordinate(a), yb = this.series.priceToCoordinate(b);
        if (x == null || ya == null || yb == null) { flushRun(); prev = null; continue; }
        const isUp = a >= b;
        if (prev && isUp !== runUp) {
          const d0 = prev.a - prev.b, d1 = ya - yb, t = d0 / (d0 - d1), cx = prev.x + (x - prev.x) * t, cy = prev.a + (ya - prev.a) * t;
          run.push({ x: cx, a: cy, b: cy }); flushRun(); run.push({ x: cx, a: cy, b: cy });
        }
        runUp = isUp;
        prev = { x, a: ya, b: yb }; run.push(prev);
      }
      flushRun();
    });
  }
}
// 봉마다 배경 칠하기 (bakkta 정배열·역배열). data 값: 1 = 위, -1 = 아래, 0 = 없음. 마지막 봉 뒤는 예측 구간
class BgFill {
  constructor(R, g) { this.R = R; this.g = g; this.views = [{ zOrder: () => 'bottom', renderer: () => this }]; }
  attached(p) { this.chart = p.chart; }
  detached() { this.chart = null; }
  updateAllViews() {}
  paneViews() { return this.views; }
  draw(target) {
    const R = this.R, g = this.g, arr = R.data[g.key];
    if (!this.chart || R.inst.hidden || !arr) return;
    const ts = this.chart.timeScale(), vr = ts.getVisibleLogicalRange(), n = S.bars.length;
    if (!vr) return;
    const i0 = Math.max(0, Math.floor(vr.from) - 1), i1 = Math.min(arr.length - 1, Math.ceil(vr.to) + 1);
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      let i = i0;
      while (i <= i1) {
        const st = arr[i], fut = i >= n;
        if (!st) { i++; continue; }
        let j = i;
        while (j + 1 <= i1 && arr[j + 1] === st && (j + 1 >= n) === fut) j++;
        const x0 = ts.logicalToCoordinate(i - 0.5), x1 = ts.logicalToCoordinate(j + 0.5);
        if (x0 != null && x1 != null) { ctx.fillStyle = hexA(st > 0 ? g.up : g.down, fut ? g.futAlpha : g.alpha); ctx.fillRect(x0, 0, x1 - x0, mediaSize.height); }
        i = j + 1;
      }
    });
  }
}

// 한 창을 여러 칸으로 나눠 그릴 때(스토캐스틱 3중) 칸 구분선·옅은 바탕·기준선 숫자
class BandDeco {
  constructor(R, j, B, r0, r1) { Object.assign(this, { R, j, B, r0, r1 }); this.views = [{ zOrder: () => 'bottom', renderer: () => this }]; }
  attached(p) { this.series = p.series; }
  detached() { this.series = null; }
  updateAllViews() {}
  paneViews() { return this.views; }
  draw(target) {
    if (!this.series || this.R.inst.hidden) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize: m }) => {
      const at = f => m.height * (this.r0 + (this.r1 - this.r0) * f), y0 = at(this.j / this.B), y1 = at((this.j + 1) / this.B);
      if (this.j % 2 === 1) { ctx.fillStyle = hexA(C.fg, 0.035); ctx.fillRect(0, y0, m.width, y1 - y0); }
      if (this.j > 0) { ctx.fillStyle = C.line; ctx.fillRect(0, Math.round(y0), m.width, 1); }
      ctx.font = '10px "IBM Plex Sans KR", -apple-system, "Segoe UI", "Malgun Gothic", sans-serif';
      ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (const v of this.R.def.bandLevels || []) { const y = this.series.priceToCoordinate(v); if (y != null) ctx.fillText(String(v), m.width - 4, y); }
      ctx.textAlign = 'left';
    });
  }
}
const bandsOf = R => R.def.bands ? R.def.bands(R.inst.p) : 0;

// lightweight-charts 4.2 버그 막기: 점만 찍는 시리즈(이평선 예측점 등)는 화면에 점이 하나도 없어도 '칠하기'를 해서
// 바로 앞에 그린 선의 경로가 검게 칠해진다 (차트를 옮겨 예측점이 화면 밖으로 나가면 이평선 아래가 검은 덩어리가 됨).
// 선 시리즈마다 그린 직후 경로를 비우는 그림을 붙여 둔다.
const PATH_RESET_R = { draw: t => t.useMediaCoordinateSpace(({ context }) => context.beginPath()) };
const PATH_RESET_V = [{ zOrder: () => 'normal', renderer: () => PATH_RESET_R }];
const pathReset = () => ({ paneViews: () => PATH_RESET_V, updateAllViews() {} });
function addPlotSeries(c, R, pl, scaleId) {
  const prec = precOf(R, pl), col = plotColor(R, pl);
  const o = { color: pl.alpha ? hexA(col, pl.alpha) : col, priceLineVisible: false, lastValueVisible: !!R.def.pane && pl.type !== 'hist' && !pl.ext, crosshairMarkerVisible: false, priceFormat: pfOf(prec), visible: !R.inst.hidden };
  if (scaleId) o.priceScaleId = scaleId;
  if (R.def.range) { const [lo, hi] = R.def.range; o.autoscaleInfoProvider = () => ({ priceRange: { minValue: lo, maxValue: hi } }); }
  if (R.def.noScale) o.autoscaleInfoProvider = () => null; // 가격 축 자동 맞춤에서 빼기
  if (!scaleId) o.autoscaleInfoProvider = pzProvider(c, c === chart ? 'other' : 'anchor', o.autoscaleInfoProvider); // 가격 축을 직접 늘였을 때
  if (pl.type === 'hist') return c.addHistogramSeries(o);
  o.lineWidth = plotWidth(R, pl);
  if (pl.type === 'dots') { o.lineVisible = false; o.pointMarkersVisible = true; o.pointMarkersRadius = pl.radius || 2; o.lastValueVisible = false; }
  if (pl.type === 'step') o.lineType = LC.LineType.WithSteps;
  if (pl.dashed) o.lineStyle = LC.LineStyle.Dashed;
  const s = c.addLineSeries(o);
  s.attachPrimitive(pathReset());
  return s;
}
// 지표 하나를 차트(c)에 붙인다. onMain이면 가격 차트 위
function mountInd(R, c, onMain) {
  let scale;
  if (onMain && R.def.ownScale) scale = 'v_' + R.inst.uid;          // 거래량: 메인 차트 아래쪽 20%
  else if (onMain && R.def.pane) scale = 'o_' + R.inst.uid;         // RSI 같은 창 지표를 메인으로 옮기면 따로 눈금
  const B = bandsOf(R), [r0, r1] = onMain ? [0.55, 0.96] : [0, 1], bandScale = j => `b${j}_${R.inst.uid}`;
  for (const pl of R.plots) R.series[pl.k] = addPlotSeries(c, R, pl, B && pl.band !== undefined ? bandScale(pl.band) : scale);
  if (scale && R.plots.some(pl => !(B && pl.band !== undefined))) c.priceScale(scale).applyOptions({ scaleMargins: scale[0] === 'v' ? { top: 0.8, bottom: 0 } : { top: 0.55, bottom: 0.04 } });
  const first = R.series[R.plots[0].k];
  for (const v of R.def.levels ? R.def.levels(R.inst.p) : []) first.createPriceLine({ price: v, color: C.muted, lineWidth: 1, lineStyle: LC.LineStyle.Dashed, axisLabelVisible: false, title: '' });
  for (let j = 0; j < B; j++) { // 칸마다 따로 눈금(0~100)을 두고 위·가운데·아래로 나눈다
    const pad = 0.025 * (r1 - r0), top = r0 + (r1 - r0) * j / B, bot = r0 + (r1 - r0) * (j + 1) / B;
    c.priceScale(bandScale(j)).applyOptions({ scaleMargins: { top: top + pad, bottom: 1 - bot + pad } });
    const s = R.series[R.plots.find(pl => pl.band === j).k];
    for (const v of R.def.bandLevels || []) s.createPriceLine({ price: v, color: C.muted, lineWidth: 1, lineStyle: LC.LineStyle.Dashed, axisLabelVisible: false, title: '' });
    const prim = new BandDeco(R, j, B, r0, r1); s.attachPrimitive(prim); R.prims.push({ s, prim });
  }
  if (R.def.fills) for (const f of R.def.fills(R.inst.p)) {
    const s = R.series[f.a];
    if (!s || !R.series[f.b]) continue;
    const prim = new BandFill(R, f); s.attachPrimitive(prim); R.prims.push({ s, prim });
  }
  const bg = R.def.bgFill && R.def.bgFill(R.inst.p);
  if (bg) { const prim = new BgFill(R, bg); first.attachPrimitive(prim); R.prims.push({ s: first, prim }); }
  R.chart = c;
}
function unmountInd(R) {
  for (const { s, prim } of R.prims) { try { s.detachPrimitive(prim); } catch {} }
  if (R.chart === chart) for (const k in R.series) { try { chart.removeSeries(R.series[k]); } catch {} }
  R.series = {}; R.prims = []; R.chart = null;
}

// ───────── 아래 창 ─────────
const PANES = new Map(); // 창 키 → { key, el, chart, legend }
function createPane(key) {
  const el = document.createElement('div');
  el.className = 'pane sub-pane';
  el.dataset.pane = key;
  const defH = Math.max(120, ...prefs.inds.filter(i => i.pane === key).map(i => TYPES[i.type].paneH ? TYPES[i.type].paneH(i.p) : 0));
  el.style.height = (prefs.paneH[key] || defH) + 'px';
  el.innerHTML = '<div class="pane-grip" title="끌어서 높이 조절"></div><div class="chart"></div><div class="legend pane-legend"></div>';
  $('#panes').append(el);
  const opts = baseOptions();
  opts.layout.attributionLogo = false; // 트레이딩뷰 출처 로고는 메인 차트에 하나만
  opts.timeScale.visible = false;
  const c = LC.createChart(el.querySelector('.chart'), opts);
  c.priceScale('right').applyOptions({ scaleMargins: { top: 0.14, bottom: 0.08 } });
  const P = { key, el, chart: c, legend: el.querySelector('.legend') };
  PANES.set(key, P);
  gripDrag(el.querySelector('.pane-grip'), P);
  linkChart(c, el);
  return P;
}
function destroyPane(P) {
  const k = charts.indexOf(P.chart);
  if (k >= 0) charts.splice(k, 1);
  if (hoverChart === P.chart) hoverChart = null;
  PZR.delete(P.chart);
  P.chart.remove(); P.el.remove(); PANES.delete(P.key);
}
function gripDrag(grip, P) {
  grip.addEventListener('pointerdown', e => {
    e.preventDefault();
    grip.setPointerCapture(e.pointerId); grip.classList.add('drag');
    const y0 = e.clientY, h0 = P.el.offsetHeight;
    const move = ev => { const h = Math.max(60, Math.min(600, h0 - (ev.clientY - y0))); P.el.style.height = h + 'px'; prefs.paneH[P.key] = h; };
    const up = () => { grip.classList.remove('drag'); grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); savePrefs(); };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  });
}
const paneLabel = key => { const list = prefs.inds.filter(i => i.pane === key); return list.length ? list.map(i => TYPES[i.type].short(i.p)).join(' + ') : '빈 창'; };

const LINE_TYPES = ['line', 'step', 'markers', 'area', 'baseline']; // 종가 하나로 그리는 차트 유형
const scaleModeOf = () => CMP.list.length ? LC.PriceScaleMode.Percentage : ({ log: LC.PriceScaleMode.Logarithmic, pct: LC.PriceScaleMode.Percentage, idx: LC.PriceScaleMode.IndexedTo100 })[prefs.scale] ?? LC.PriceScaleMode.Normal;
function createMainSeries() {
  const up = C.up, dn = C.down, o = { priceFormat: priceFormat(), priceLineVisible: prefs.pline, autoscaleInfoProvider: pzProvider(chart, 'anchor') };
  switch (prefs.type) {
    case 'hollow': mainSeries = chart.addCandlestickSeries({ ...o, upColor: 'rgba(0,0,0,0)', downColor: dn, borderUpColor: up, borderDownColor: dn, wickUpColor: up, wickDownColor: dn }); break;
    case 'bar': mainSeries = chart.addBarSeries({ ...o, upColor: up, downColor: dn, thinBars: false }); break;
    case 'line': mainSeries = chart.addLineSeries({ ...o, color: C.accent, lineWidth: 2 }); break;
    case 'step': mainSeries = chart.addLineSeries({ ...o, color: C.accent, lineWidth: 2, lineType: LC.LineType.WithSteps }); break;
    case 'markers': mainSeries = chart.addLineSeries({ ...o, color: C.accent, lineWidth: 2, pointMarkersVisible: true, pointMarkersRadius: 2.5 }); break;
    case 'area': mainSeries = chart.addAreaSeries({ ...o, lineColor: C.accent, topColor: hexA(C.accent, .28), bottomColor: hexA(C.accent, .02), lineWidth: 2 }); break;
    case 'baseline': mainSeries = chart.addBaselineSeries({ ...o, baseValue: { type: 'price', price: S.bars.length ? S.bars[S.bars.length - 1].close : 0 }, lineWidth: 2,
      topLineColor: up, topFillColor1: hexA(up, .28), topFillColor2: hexA(up, .04), bottomLineColor: dn, bottomFillColor1: hexA(dn, .04), bottomFillColor2: hexA(dn, .28) }); break;
    default: mainSeries = chart.addCandlestickSeries({ ...o, upColor: up, downColor: dn, borderUpColor: up, borderDownColor: dn, wickUpColor: up, wickDownColor: dn });
  }
  const volOn = prefs.inds.some(i => i.type === 'vol' && i.pane === 'main' && !i.hidden);
  mainSeries.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: volOn ? 0.22 : 0.06 }, mode: scaleModeOf(), invertScale: prefs.invert });
  S.selHline = -1;
  for (const h of S.hlines) h.line = mainSeries.createPriceLine(hlineOpts(h, false));
  mainSeries.attachPrimitive(pathReset());
  mainSeries.attachPrimitive(drawLayer);
  mainSeries.attachPrimitive(tvLayer);
}
// 메인 차트 순서: 거래량 → 캔들 → 나머지 지표(캔들 위). 그다음 창 순서대로 아래 창
function rebuildIndicators() {
  rqCancel();
  normalizePanes();
  for (const R of RT.values()) unmountInd(R);
  RT.clear();
  for (const P of [...PANES.values()]) destroyPane(P);
  if (mainSeries) { try { mainSeries.detachPrimitive(drawLayer); } catch {} try { chart.removeSeries(mainSeries); } catch {} mainSeries = null; }
  for (const inst of prefs.inds) {
    const def = TYPES[inst.type];
    RT.set(inst.uid, { inst, def, plots: def.plots(inst.p), data: {}, series: {}, prims: [], chart: null, vals: [] });
  }
  const list = [...RT.values()], onMain = list.filter(R => R.inst.pane === 'main');
  onMain.filter(R => R.def.under).forEach(R => mountInd(R, chart, true));
  createMainSeries();
  onMain.filter(R => !R.def.under).forEach(R => mountInd(R, chart, true));
  for (const key of prefs.panes) {
    const P = createPane(key);
    list.filter(R => R.inst.pane === key).forEach(R => mountInd(R, P.chart, false));
  }
  const panes = [...PANES.values()];
  chart.applyOptions({ timeScale: { visible: panes.length === 0 } });
  panes.forEach((P, k) => P.chart.applyOptions({ timeScale: { visible: k === panes.length - 1 } }));
  buildLegendRows();
}

// 미래 칸(일목 선행스팬, 예측점 등)의 시간
function timeAt(i) {
  const n = S.bars.length;
  if (i < n) return S.bars[i].time;
  const last = S.bars[n - 1].t;
  if (S.futBase !== last) { S.futBase = last; S.futMs = []; }
  while (S.futMs.length <= i - n) S.futMs.push(nextBucket(S.futMs.length ? S.futMs[S.futMs.length - 1] : last, spec));
  return toTime(S.futMs[i - n]);
}
function plotPoint(R, pl, i) {
  const src = i - (pl.shift || 0), arr = R.data[pl.k], time = timeAt(i);
  const v = arr && src >= 0 && src < arr.length ? arr[src] : NA;
  if (!isN(v)) return { time };
  return pl.type === 'hist' ? { time, value: v, color: pl.colorAt ? pl.colorAt(src, R.data) : plotColor(R, pl) } : { time, value: v };
}
const plotEnd = pl => S.bars.length - 1 + (pl.shift || 0);
// 예측점(ext)은 마지막 봉 뒤 몇 칸에만 점이 있어서 통째로 다시 넣는다
function extPoints(R, pl) {
  const n = S.bars.length, pts = [];
  for (let i = n; i < n + pl.ext; i++) { const q = plotPoint(R, pl, i); if (q.value !== undefined) pts.push(q); }
  return pts;
}
function setPlotData(R, pl) {
  const s = R.series[pl.k];
  if (!s) return;
  if (pl.ext) { s.setData(extPoints(R, pl)); return; }
  const pts = [];
  for (let i = Math.max(0, pl.shift || 0), e = plotEnd(pl); i <= e; i++) pts.push(plotPoint(R, pl, i));
  s.setData(pts);
}
function setAllData(R) { for (const pl of R.plots) setPlotData(R, pl); }
// 봉이 많을 때 데이터를 통째로 다시 넣으면 선 하나에 20ms쯤 걸린다 (봉 7천 개 기준, 선이 30개면 0.6초 멈춤).
// 예전 봉을 붙이거나 지난 봉이 고쳐질 때는 캔들과 아래 창만 바로 넣고, 메인 차트 위 지표 선은 몇 개씩 나눠 넣는다.
const RQ = { list: [], t: null };
function rqCancel() { RQ.list = []; clearTimeout(RQ.t); RQ.t = null; }
function rqStep() {
  RQ.t = null;
  const t0 = performance.now();
  while (RQ.list.length && performance.now() - t0 < 10) {
    const [R, pl] = RQ.list.shift();
    if (RT.get(R.inst.uid) === R) { try { setPlotData(R, pl); } catch {} }
  }
  if (RQ.list.length) RQ.t = setTimeout(rqStep, 16);
}
function updateLastData(R) {
  for (const pl of R.plots) {
    const s = R.series[pl.k], e = plotEnd(pl);
    if (!s) continue;
    if (pl.ext) s.setData(extPoints(R, pl));
    else if (e >= 0) s.update(plotPoint(R, pl, e));
  }
}
function makeCtx() {
  const b = S.bars, n = b.length, cache = {}, memo = {};
  const src = k => {
    if (cache[k]) return cache[k];
    const a = new Array(n);
    for (let i = 0; i < n; i++) {
      const x = b[i];
      a[i] = k === 'hl2' ? (x.high + x.low) / 2 : k === 'hlc3' ? (x.high + x.low + x.close) / 3 : k === 'ohlc4' ? (x.open + x.high + x.low + x.close) / 4 : x[k];
    }
    return (cache[k] = a);
  };
  return { n, src, memo: (k, f) => k in memo ? memo[k] : (memo[k] = f()) };
}
function computeAll() {
  const x = makeCtx();
  for (const R of RT.values()) { try { R.data = R.def.calc(x, R.inst.p) || {}; } catch (e) { console.warn('지표 계산 오류', R.inst.type, e); R.data = {}; } }
}
function haAt(i) {
  const b = S.bars[i], c = (b.open + b.high + b.low + b.close) / 4, p = S.ha[i - 1];
  const o = i > 0 && p ? (p.open + p.close) / 2 : (b.open + b.close) / 2;
  return { time: b.time, open: o, high: Math.max(b.high, o, c), low: Math.min(b.low, o, c), close: c };
}
function mainPoint(i) {
  const b = S.bars[i];
  switch (prefs.type) {
    case 'heikin': return (S.ha[i] = haAt(i));
    case 'line': case 'step': case 'markers': case 'area': case 'baseline': return { time: b.time, value: b.close };
    default: return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close };
  }
}
function syncPaneRanges() {
  const r = chart.timeScale().getVisibleLogicalRange();
  if (r) for (const P of PANES.values()) setRangeOf(P.chart, r);
}
function renderAll(soft) {
  if (!mainSeries) return;
  rqCancel();
  computeAll();
  const n = S.bars.length;
  S.ha = [];
  const md = new Array(n);
  for (let i = 0; i < n; i++) md[i] = mainPoint(i);
  mainSeries.setData(md);
  const lazy = soft && n > 1500;
  for (const R of RT.values()) {
    if (lazy && R.chart === chart) for (const pl of R.plots) RQ.list.push([R, pl]);
    else setAllData(R);
  }
  if (RQ.list.length) RQ.t = setTimeout(rqStep, 16);
  S.renderedN = S.indRenderedN = n; lastIndAt = performance.now();
  syncPaneRanges();
  renderLegends();
  alertInd();
}
// 캔들·거래량은 매 프레임, 나머지 지표는 0.2초마다 다시 계산
function renderMainLast() {
  const n = S.bars.length;
  if (!n || !mainSeries) return;
  if (n - S.renderedN > 1 || n < S.renderedN) return renderAll();
  const i = n - 1, b = S.bars[i];
  try {
    mainSeries.update(mainPoint(i));
    for (const R of RT.values()) if (R.inst.type === 'vol' && R.series.v) R.series.v.update({ time: b.time, value: b.volume, color: b.close >= b.open ? C.upVol : C.downVol });
  } catch (e) { return renderAll(); }
  S.renderedN = n;
  if (hoverIdx == null) renderOHLC(i);
  queueInd();
}
let rafPending = false, needFull = false, needLast = false, indTimer = null, lastIndAt = 0;
function schedule(full) {
  if (full) needFull = true; else needLast = true;
  if (!rafPending) { rafPending = true; requestAnimationFrame(flush); }
}
function flush() {
  rafPending = false;
  if (needFull) { needFull = needLast = false; renderAll(true); }
  else if (needLast) { needLast = false; renderMainLast(); }
  updatePrice();
  if (LAT.pendingAt != null) { // 수신 → 화면 반영 시간 (탭이 뒤에 있어 멈췄던 시간은 빼고)
    const d = performance.now() - LAT.pendingAt;
    if (d < 1000 && !document.hidden) pushS(LAT.screen, d);
    LAT.pendingAt = null;
  }
}
function queueInd() { if (!indTimer) indTimer = setTimeout(flushInd, Math.max(0, 200 - (performance.now() - lastIndAt))); }
function flushInd() {
  indTimer = null;
  if (!S.bars.length || S.loading || !mainSeries) return;
  lastIndAt = performance.now();
  computeAll();
  const n = S.bars.length, full = n - S.indRenderedN > 1 || n < S.indRenderedN;
  for (const R of RT.values()) { try { full ? setAllData(R) : updateLastData(R); } catch (e) { setAllData(R); } }
  S.indRenderedN = n;
  if (hoverIdx == null) renderLegends();
  alertInd();
}
function keepRange(fn) {
  const r = chart.timeScale().getVisibleLogicalRange();
  fn();
  if (r) chart.timeScale().setVisibleLogicalRange(r);
}

// ───────── 범례 ─────────
function makeRow(R) {
  const row = document.createElement('div');
  row.className = 'lg-row' + (R.inst.hidden ? ' off' : '');
  row.dataset.uid = R.inst.uid;
  const nm = document.createElement('span');
  nm.className = 'lg-name'; nm.textContent = R.def.short(R.inst.p);
  nm.title = '끌어서 다른 창이나 창 사이로 옮길 수 있어요';
  row.append(nm);
  R.vals = [];
  const split = bandsOf(R) && R.inst.pane !== 'main';
  for (const pl of R.plots) {
    if (pl.legend === false || (split && pl.band > 0)) continue; // 나눠 보기면 둘째·셋째 칸 값은 그 칸 안에 표시
    if (split && pl.tag) row.append(bandTag(R, pl));
    const b = document.createElement('b');
    if (!pl.textAt && !pl.colorAt) b.style.color = plotColor(R, pl);
    row.append(b); R.vals.push({ el: b, pl });
  }
  const act = document.createElement('span');
  act.className = 'lg-act';
  const hid = R.inst.hidden;
  act.innerHTML = `<button type="button" data-act="move" aria-label="위치 옮기기" title="위치 옮기기">${ICON_MOVE}</button><button type="button" data-act="vis" aria-label="${hid ? '보이기' : '숨기기'}" title="${hid ? '보이기' : '숨기기'}">${hid ? ICON_EYE_OFF : ICON_EYE}</button><button type="button" data-act="set" aria-label="설정" title="설정">${ICON_GEAR}</button><button type="button" data-act="del" aria-label="삭제" title="삭제">${ICON_X}</button>`;
  row.append(act);
  return row;
}
function bandTag(R, pl) {
  const t = document.createElement('span');
  t.className = 'band-tag'; t.textContent = pl.tag; t.style.color = plotColor(R, pl);
  return t;
}
// 둘째·셋째 칸 값 표시 (칸 맨 위 왼쪽)
function addBandLegends(R, P) {
  const B = bandsOf(R);
  for (let j = 1; j < B; j++) {
    const box = document.createElement('div');
    box.className = 'band-legend';
    box.style.top = `calc(${(100 * j / B).toFixed(3)}% + 4px)`;
    for (const pl of R.plots.filter(q => q.band === j && q.legend !== false)) {
      if (pl.tag) box.append(bandTag(R, pl));
      const b = document.createElement('b');
      b.style.color = plotColor(R, pl);
      box.append(b); R.vals.push({ el: b, pl });
    }
    P.el.append(box);
  }
}
let lgCollapsed = innerWidth < 700; // 좁은 화면(휴대폰)에서는 지표 범례를 접은 채로 시작
function buildLegendRows() {
  const box = $('#lgInds');
  box.innerHTML = '';
  for (const P of PANES.values()) { P.legend.innerHTML = ''; P.el.querySelectorAll('.band-legend').forEach(e => e.remove()); }
  let cnt = 0;
  for (const R of RT.values()) {
    const row = makeRow(R);
    if (R.inst.pane === 'main') { box.append(row); cnt++; }
    else { const P = PANES.get(R.inst.pane); if (P) { P.legend.append(row); if (bandsOf(R)) addBandLegends(R, P); } }
  }
  const t = $('#lgToggle');
  t.hidden = cnt === 0;
  t.textContent = lgCollapsed ? `지표 ${cnt}개 보기` : '지표 접기';
  t.setAttribute('aria-expanded', String(!lgCollapsed));
  box.classList.toggle('collapsed', lgCollapsed);
  renderLegends();
}
function renderOHLC(i) {
  const b = S.bars[i], ids = ['lgO', 'lgH', 'lgL', 'lgC', 'lgChg'];
  if (!b) { for (const id of ids) $('#' + id).textContent = ''; return; }
  const prev = S.bars[i - 1], base = prev ? prev.close : b.open, ch = b.close - base, pc = base ? ch / base * 100 : 0, cls = b.close >= b.open ? 'up' : 'down';
  [b.open, b.high, b.low, b.close].forEach((v, k) => { const el = $('#' + ids[k]); el.textContent = fp(v); el.className = cls; });
  const c = $('#lgChg');
  c.textContent = `${ch >= 0 ? '+' : ''}${fp(ch)} (${fpct(pc)})`;
  c.className = ch >= 0 ? 'up' : 'down';
}
function renderLegends() {
  const i = hoverIdx != null ? hoverIdx : S.bars.length - 1;
  renderOHLC(i);
  for (const R of RT.values()) {
    for (const it of R.vals) {
      const pl = it.pl, src = i - (pl.shift || 0), arr = R.data[pl.k], v = arr && src >= 0 ? arr[src] : NA;
      it.el.textContent = fmtP(v, precOf(R, pl));
      if (isN(v) && (pl.textAt || pl.colorAt)) it.el.style.color = pl.textAt ? pl.textAt(src) : pl.colorAt(src, R.data);
    }
  }
}
$('#lgToggle').addEventListener('click', () => { lgCollapsed = !lgCollapsed; buildLegendRows(); });

// ───────── 차트끼리 시간축 · 십자선 맞추기 ─────────
// 차트(메인·아래 창)끼리 보이는 범위 맞추기. 맞춰 준 차트가 그 범위를 그리면서 다시 알려 오는데(한 박자 늦게),
// 그걸 또 보내면 끄는 동안 메인 차트가 한 박자 전 위치로 되돌아가 실제로는 절반만 움직인다(버벅임).
// 그래서 내가 맞춰 준 범위가 그대로 돌아온 것은 다시 보내지 않는다.
const LAST_SET = new WeakMap();
const sameRange = (a, b) => !!(a && b) && Math.abs(a.from - b.from) < 1e-6 && Math.abs(a.to - b.to) < 1e-6;
function setRangeOf(o, r) { const rr = { from: r.from, to: r.to }; LAST_SET.set(o, rr); o.timeScale().setVisibleLogicalRange(rr); }
function linkChart(c, el) {
  charts.push(c);
  c.timeScale().subscribeVisibleLogicalRangeChange(r => {
    if (!r) return;
    if (!sameRange(r, LAST_SET.get(c))) for (const o of charts) if (o !== c) setRangeOf(o, r);
    if (c === chart) onRange();
  });
  const enter = () => { hoverChart = c; };
  el.addEventListener('pointerenter', enter);
  el.addEventListener('pointerdown', enter);
  el.addEventListener('pointerleave', () => { if (hoverChart === c) { hoverChart = null; clearCross(); } });
  c.subscribeCrosshairMove(p => {
    if (c === chart) dwMove(p);
    if (hoverChart !== c) return;
    XH.c = c; XH.p = p; // 마우스가 빨리 움직여도 다른 창 십자선·범례는 한 화면에 한 번만 고친다
    if (!XH.raf) XH.raf = requestAnimationFrame(xhFlush);
  });
}
const XH = { c: null, p: null, raf: 0 };
function xhFlush() {
  XH.raf = 0;
  const { c, p } = XH;
  if (!c || !p || hoverChart !== c) return;
  if (p.time === undefined || !p.point) { clearCross(); return; }
  const i = S.tIndex.get(p.time);
  if (i === undefined) return;
  hoverIdx = i;
  for (const o of charts) if (o !== c) setCross(o, i, p.time);
  renderLegends();
  mcCrossOut(S.bars[i].t);
}
function setCross(o, i, time) {
  if (typeof o.setCrosshairPosition !== 'function') return;
  let s, v;
  if (o === chart) { s = mainSeries; v = S.bars[i] && S.bars[i].close; }
  else {
    const R = [...RT.values()].find(r => r.chart === o);
    if (!R) return;
    const pl = R.plots.find(p => p.type !== 'hist' && !p.ext) || R.plots[0];
    s = R.series[pl.k]; v = R.data[pl.k] && R.data[pl.k][i - (pl.shift || 0)];
  }
  try { if (!s || !isN(v)) o.clearCrosshairPosition(); else o.setCrosshairPosition(v, time, s); } catch {}
}
function clearCross() {
  mcCrossOut(null);
  hoverIdx = null;
  for (const o of charts) if (o !== hoverChart && typeof o.clearCrosshairPosition === 'function') { try { o.clearCrosshairPosition(); } catch {} }
  renderLegends();
}
// 차트를 끄는 동안에는 예전 봉 받기를 미뤘다가 손을 떼면 받는다 (받는 동안 화면이 잠깐 멈추므로)
const DRAG = { on: false, pend: false };
$('.chart-area').addEventListener('pointerdown', () => { DRAG.on = true; }, true);
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, () => {
  if (!DRAG.on) return;
  DRAG.on = false;
  if (DRAG.pend) { DRAG.pend = false; setTimeout(onRange, 0); }
});
let toRtShown = null;
function onRange() {
  const r = chart.timeScale().getVisibleLogicalRange(), n = S.bars.length, show = !!(r && n && r.to < n - 2);
  if (show !== toRtShown) { toRtShown = show; $('#toRT').hidden = !show; }
  if (r && r.from < Math.max(60, (r.to - r.from) * 1.2)) { if (DRAG.on) DRAG.pend = true; else loadOlder(); } // 한 화면쯤 남으면 미리 받는다
}
