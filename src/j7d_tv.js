
// ───────── 트레이딩뷰식 추가 기능 ─────────
// 봉 마감 카운트다운 · 시간대와 시계 · 보이는 구간 최고/최저 · 1호가 선 · 날짜 구분선 · 거래량 프로파일
// 차트 설정 창 · 가격 축 방식 · 날짜로 이동 · 전체 화면
const nowSrv = () => Date.now() + (LAT.off || 0); // 거래소 서버 시계 기준 지금
function fmtLeft(ms) { // 봉 마감까지 남은 시간
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  if (d) return `${d}일 ${pad(h)}:${pad(m)}`;
  return h ? `${pad(h)}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
const VP_ROWS = 24;
function calcVP(i0, i1) { // 보이는 구간 가격대별 거래량. 봉 거래량을 고가~저가에 고르게 나눠 담는다
  let lo = Infinity, hi = -Infinity;
  for (let i = i0; i <= i1; i++) { const b = S.bars[i]; if (b.low < lo) lo = b.low; if (b.high > hi) hi = b.high; }
  if (!(hi > lo)) return null;
  const rows = VP_ROWS, step = (hi - lo) / rows, up = new Array(rows).fill(0), dn = new Array(rows).fill(0);
  for (let i = i0; i <= i1; i++) {
    const b = S.bars[i], arr = b.close >= b.open ? up : dn, v = b.volume;
    if (!v) continue;
    const r0 = Math.min(rows - 1, Math.floor((b.low - lo) / step)), r1 = Math.min(rows - 1, Math.floor((b.high - lo) / step));
    if (r0 === r1) { arr[r0] += v; continue; }
    const span = b.high - b.low;
    for (let r = r0; r <= r1; r++) { const a = Math.max(b.low, lo + r * step), z = Math.min(b.high, lo + (r + 1) * step); if (z > a) arr[r] += v * (z - a) / span; }
  }
  const tot = up.map((u, r) => u + dn[r]), all = tot.reduce((a, x) => a + x, 0);
  let poc = 0;
  for (let r = 1; r < rows; r++) if (tot[r] > tot[poc]) poc = r;
  let vaLo = poc, vaHi = poc, acc = tot[poc]; // 거래량 70%가 모인 가격대 (밸류 에어리어)
  while (acc < all * 0.7 && (vaLo > 0 || vaHi < rows - 1)) {
    const below = vaLo > 0 ? tot[vaLo - 1] : -1, above = vaHi < rows - 1 ? tot[vaHi + 1] : -1;
    if (above >= below) acc += tot[++vaHi]; else acc += tot[--vaLo];
  }
  return { lo, step, rows, up, dn, max: Math.max(...tot), poc, vaLo, vaHi };
}
class TvLayer {
  constructor() {
    const o = this.cd = { y: 0, text: '', bg: '#000', vis: false };
    // fixedCoordinate가 없으면 라이브러리의 라벨 겹침 처리에서 위치를 잃고 현재가 라벨을 맨 위로 밀어낸다
    this.axis = [{ fixedCoordinate: () => o.y, coordinate: () => o.y, text: () => o.text, textColor: () => '#ffffff', backColor: () => o.bg, visible: () => o.vis, tickVisible: () => false }];
    const r = { draw: t => this.drawBottom(t) };
    this.panes = [{ zOrder: () => 'bottom', renderer: () => r }];
    this.vpKey = ''; this.vp = null;
  }
  attached(p) { this.series = p.series; this.req = p.requestUpdate; }
  detached() { this.series = this.req = null; }
  priceAxisViews() { return this.axis; }
  paneViews() { return this.panes; }
  updateAllViews() { // 가격 축: 현재가 라벨 바로 아래에 봉 마감까지 남은 시간
    const o = this.cd, n = S.bars.length;
    o.vis = false;
    if (!prefs.cd || RP.on || !this.series || !n || S.loading || (spec.ms && spec.ms < 5000)) return;
    const b = S.bars[n - 1], ha = prefs.type === 'heikin' && S.ha[n - 1], v = ha ? ha.close : b.close, y = this.series.priceToCoordinate(v);
    if (y == null) return;
    o.y = y + 17;
    o.text = fmtLeft(nextBucket(b.t, spec) - nowSrv());
    o.bg = ['line', 'step', 'markers', 'area'].includes(prefs.type) ? C.accent : prefs.type === 'baseline' ? (v >= (TVL.base ?? v) ? C.up : C.down) : ((ha || b).close >= (ha || b).open ? C.up : C.down);
    o.vis = true;
  }
  drawBottom(target) {
    if (!this.series || !S.bars.length || S.loading) return;
    if (prefs.seps && spec.intraday) target.useBitmapCoordinateSpace(scope => this.drawSeps(scope));
    if (prefs.vp) target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => this.drawVP(ctx, mediaSize));
  }
  // 하루가 바뀌는 봉(고른 시간대 기준)에 세로 점선. 격자선·십자선과 같은 봉 한가운데에, 격자선과 같은 방식으로 픽셀을 맞춘다
  drawSeps({ context: ctx, bitmapSize, horizontalPixelRatio: hr }) {
    const ts = chart.timeScale(), vr = ts.getVisibleLogicalRange(), n = S.bars.length;
    if (!vr || n < 2) return;
    const i0 = Math.max(1, Math.floor(vr.from)), i1 = Math.min(n - 1, Math.ceil(vr.to)), lw = Math.max(1, Math.floor(hr));
    ctx.save(); ctx.strokeStyle = C.muted; ctx.globalAlpha = .6; ctx.lineWidth = lw; ctx.setLineDash([3 * lw, 4 * lw]); ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      if (Math.floor(S.bars[i].time / 86400) === Math.floor(S.bars[i - 1].time / 86400)) continue;
      const x = ts.logicalToCoordinate(i);
      if (x == null) continue;
      const xx = Math.round(x * hr);
      ctx.moveTo(xx, 0); ctx.lineTo(xx, bitmapSize.height);
    }
    ctx.stroke(); ctx.beginPath(); ctx.restore();
  }
  drawVP(ctx, size) {
    const ts = chart.timeScale(), vr = ts.getVisibleLogicalRange(), n = S.bars.length, s = this.series;
    if (!vr) return;
    const i0 = Math.max(0, Math.ceil(vr.from)), i1 = Math.min(n - 1, Math.floor(vr.to));
    if (i1 - i0 < 1) return;
    const last = S.bars[n - 1], key = `${i0}|${i1}|${n}|${last.close}|${last.volume}|${S.bars[i0].t}`;
    if (key !== this.vpKey) { this.vpKey = key; this.vp = calcVP(i0, i1); }
    const v = this.vp;
    if (!v) return;
    const W = Math.min(size.width * .3, 280), right = size.width - 1, max = v.max || 1;
    for (let r = 0; r < v.rows; r++) {
      const ya = s.priceToCoordinate(v.lo + (r + 1) * v.step), yb = s.priceToCoordinate(v.lo + r * v.step);
      if (ya == null || yb == null) continue;
      const top = Math.min(ya, yb) + .5, h = Math.max(1, Math.abs(yb - ya) - 1), a = r >= v.vaLo && r <= v.vaHi ? .42 : .18;
      const wu = W * v.up[r] / max, wd = W * v.dn[r] / max;
      ctx.fillStyle = hexA(C.up, a); ctx.fillRect(right - wu - wd, top, wu, h);
      ctx.fillStyle = hexA(C.down, a); ctx.fillRect(right - wd, top, wd, h);
    }
    const yp = s.priceToCoordinate(v.lo + (v.poc + .5) * v.step);
    if (yp != null) { ctx.save(); ctx.strokeStyle = '#ff9800'; ctx.globalAlpha = .85; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, Math.round(yp) + .5); ctx.lineTo(size.width, Math.round(yp) + .5); ctx.stroke(); ctx.restore(); }
  }
}
const tvLayer = new TvLayer();

// 보이는 구간 최고·최저, 1호가 선 (메인 시리즈를 새로 만들면 다시 단다)
const TVL = { s: null, base: null, baseS: null };
function tvLine(k, on, price, opts) {
  if (TVL.s !== mainSeries) { for (const x of ['hi', 'lo', 'bid', 'ask']) TVL[x] = null; TVL.s = mainSeries; }
  if (!mainSeries) return;
  if (!on || !isN(price)) { if (TVL[k]) { try { mainSeries.removePriceLine(TVL[k]); } catch {} TVL[k] = null; } return; }
  const sig = price + '|' + opts.color;
  if (TVL[k] && TVL[k + 'Sig'] === sig) return;
  TVL[k + 'Sig'] = sig;
  const o = Object.assign({ price, lineWidth: 1, axisLabelVisible: true }, opts);
  if (TVL[k]) TVL[k].applyOptions(o); else TVL[k] = mainSeries.createPriceLine(o);
}
function visHL() {
  const vr = chart.timeScale().getVisibleLogicalRange(), n = S.bars.length;
  if (!vr || !n) return null;
  const i0 = Math.max(0, Math.ceil(vr.from)), i1 = Math.min(n - 1, Math.floor(vr.to));
  if (i1 < i0) return null;
  const line = LINE_TYPES.includes(prefs.type);
  let hi = -Infinity, lo = Infinity;
  for (let i = i0; i <= i1; i++) { const b = S.bars[i], h = line ? b.close : b.high, l = line ? b.close : b.low; if (h > hi) hi = h; if (l < lo) lo = l; }
  return { hi, lo };
}
function updClock() {
  const el = $('#tzClock');
  const z = zDate(nowSrv()), s = `${pad(z.getUTCHours())}:${pad(z.getUTCMinutes())}:${pad(z.getUTCSeconds())}`;
  if (el.textContent !== s) el.textContent = s;
  renderBarClose();
}
function tvTick() {
  updClock();
  if (document.hidden || !mainSeries || S.loading || !S.bars.length) return;
  if (tvLayer.req && (prefs.cd || prefs.vp)) tvLayer.req();
  const hl = prefs.hilo || prefs.type === 'baseline' ? visHL() : null;
  tvLine('hi', prefs.hilo && hl, hl && hl.hi, { color: C.muted, lineStyle: LC.LineStyle.Dotted, title: '최고' });
  tvLine('lo', prefs.hilo && hl, hl && hl.lo, { color: C.muted, lineStyle: LC.LineStyle.Dotted, title: '최저' });
  const bk = S.book, bid = bk && bk.bids && bk.bids[0] && bk.bids[0][0], ask = bk && bk.asks && bk.asks[0] && bk.asks[0][0];
  // 1호가는 현재가와 거의 붙어 있어 축 라벨 대신 선 이름에 가격을 넣는다 (마감 시간 라벨과 겹치지 않게)
  tvLine('bid', prefs.bidask, bid, { color: C.up, lineStyle: LC.LineStyle.Dashed, axisLabelVisible: false, title: isN(bid) ? '매수 ' + fp(bid) : '' });
  tvLine('ask', prefs.bidask, ask, { color: C.down, lineStyle: LC.LineStyle.Dashed, axisLabelVisible: false, title: isN(ask) ? '매도 ' + fp(ask) : '' });
  if (prefs.type === 'baseline' && hl) { // 베이스라인 기준: 보이는 구간 가운데 (트레이딩뷰 기본 50%)
    const base = roundTick((hl.hi + hl.lo) / 2);
    if (base !== TVL.base || TVL.baseS !== mainSeries) { TVL.base = base; TVL.baseS = mainSeries; mainSeries.applyOptions({ baseValue: { type: 'price', price: base } }); }
  }
}
setInterval(tvTick, 500);

// ── 차트 모양 다시 그리기 (색·격자·워터마크 등을 바꿨을 때) ──
function refreshLook() {
  applyTheme();
  keepRange(() => { chart.applyOptions(mainOptions()); rebuildIndicators(); if (S.bars.length && !S.loading) renderAll(); });
  syncControls(); renderDwBar(); tvTick();
}

// ── 가격 축 방식 ──
function applyScale() { if (mainSeries) mainSeries.priceScale().applyOptions({ mode: scaleModeOf(), invertScale: prefs.invert, autoScale: true }); }
const SCALE_NAMES = { n: '일반', log: '로그', pct: '퍼센트(%)', idx: '100 기준' };
function setScale(v) {
  prefs.scale = v; savePrefs(); applyScale(); syncToolButtons();
  toast(`가격 축: ${SCALE_NAMES[v]}`);
}
function toggleInvert() { prefs.invert = !prefs.invert; savePrefs(); applyScale(); toast(prefs.invert ? '가격 축을 뒤집었어요 (Alt+I로 되돌리기).' : '가격 축을 원래대로 돌렸어요.'); }

// ── 시간대 ──
const TZ_LIST = [['local', '내 기기 시간대'], ['utc', '거래소 일봉 기준 · 런던(겨울)'], ['+9', '서울 · 도쿄'], ['+8', '홍콩 · 싱가포르 · 상하이'], ['+7', '방콕 · 호찌민 · 자카르타'],
  ['+5.5', '뭄바이'], ['+4', '두바이'], ['+3', '이스탄불 · 모스크바'], ['+2', '카이로 · 아테네(겨울)'], ['+1', '파리 · 베를린(겨울) · 런던(서머타임)'], ['-3', '상파울루'],
  ['-4', '뉴욕(서머타임)'], ['-5', '뉴욕(겨울) · 시카고(서머타임)'], ['-6', '시카고(겨울)'], ['-7', 'LA(서머타임)'], ['-8', 'LA(겨울)'], ['-10', '하와이']];
const tzName = v => v === 'local' ? `내 기기 (${tzLabelOf(tzOffsetOf('local'))})` : tzLabelOf(tzOffsetOf(v));
const BC_IVS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];
function renderBarClose() { // 시간 단위별 봉 마감까지 남은 시간 (거래소 기준: UTC 0시에 일봉, 월요일 0시에 주봉이 바뀜)
  const el = $('#bcList');
  if (!el || $('#tzPop').hidden) return;
  const now = nowSrv();
  el.innerHTML = BC_IVS.map(id => {
    const sp = parseIv(id);
    if (!sp) return '';
    return `<div class="bc-row${sp.id === spec.id ? ' on' : ''}"><span>${sp.label}</span><b class="num">${fmtLeft(nextBucket(bucketStart(now, sp), sp) - now)}</b></div>`;
  }).join('');
}
function buildTzMenu() {
  $('#tzPop').innerHTML = '<div class="pop-title">봉 마감까지 남은 시간</div><div class="bc-list" id="bcList"></div><div class="pop-title">시간대</div>' + TZ_LIST.map(([v, name]) => `<button type="button" class="pop-item type-item tz-item" role="menuitemradio" data-tz="${v}" aria-checked="${v === prefs.tz}"><b>${v === 'local' ? '내 기기' : tzLabelOf(tzOffsetOf(v))}</b><span class="muted">${v === 'local' ? tzLabelOf(tzOffsetOf('local')) : name}</span><span class="check">✓</span></button>`).join('')
    + '<p class="pop-hint">차트 시간축·십자선·체결 시간이 이 시간대로 표시돼요. 서머타임은 자동으로 바뀌지 않아요.</p>';
  setTimeout(renderBarClose, 0);
}
function setTz(v) {
  if (!TZ_LIST.some(x => x[0] === v)) return;
  prefs.tz = v; savePrefs();
  TZ = tzOffsetOf(v);
  $('#tzLbl').textContent = tzLabelOf(TZ); updClock();
  if (RP.on) { rpExit(); return; } // 리플레이 중이면 실시간으로 돌아오며 새 시간대로 다시 받는다
  for (const b of S.raw) b.time = toTime(b.t);
  if (S.bars.length && !S.loading) { S.futBase = null; buildBars(); keepRange(renderAll); }
  tradesDirty = true; dwRedraw();
  if (!$('#chartDlg').hidden) renderChartSet();
  toast(`시간대를 ${tzName(v)}로 바꿨어요.`);
}
$('#tzPop').addEventListener('click', e => { const b = e.target.closest('[data-tz]'); if (!b) return; closePops(); setTz(b.dataset.tz); });
$('#tzLbl').textContent = tzLabelOf(TZ);
updClock();

// ── 차트 설정 창 ──
const CS_SHOW = [['cd', '봉 마감까지 남은 시간', '가격 축의 현재가 아래에 표시'], ['pline', '현재가 선'], ['hilo', '보이는 구간 최고가 · 최저가'], ['bidask', '매수 · 매도 1호가 선'],
  ['seps', '날짜 구분선', '분·시간 봉에서 하루가 바뀌는 곳 (고른 시간대 기준)'], ['vp', '거래량 프로파일', '보이는 구간의 가격대별 거래량 · 진한 부분은 거래량 70% 구간, 주황 선은 가장 많이 거래된 가격(POC)'],
  ['grid', '격자선'], ['wmOn', '종목 이름 워터마크']];
const COLOR_PRESETS = { global: [null, null], kr: ['#f23645', '#2962ff'] };
function renderChartSet() {
  const kr = prefs.upC === COLOR_PRESETS.kr[0] && prefs.dnC === COLOR_PRESETS.kr[1];
  $('#chartBody').innerHTML = `<section class="cs-sec"><h3>캔들 색</h3>
      <div class="seg" role="group" aria-label="색 묶음"><button type="button" data-cpre="global" aria-pressed="${!prefs.upC && !prefs.dnC}">초록 상승 · 빨강 하락</button><button type="button" data-cpre="kr" aria-pressed="${kr}">빨강 상승 · 파랑 하락 (국내식)</button></div>
      <div class="cs-colors"><label class="fld color"><input type="color" id="csUp" value="${C.up}"><span>상승</span></label><label class="fld color"><input type="color" id="csDn" value="${C.down}"><span>하락</span></label></div>
    </section>
    <section class="cs-sec"><h3>차트에 표시</h3>
      ${CS_SHOW.map(([k, l, hint]) => `<label class="cs-chk"><input type="checkbox" data-cs="${k}"${prefs[k] ? ' checked' : ''}><span>${l}${hint ? `<small>${hint}</small>` : ''}</span></label>`).join('')}
    </section>
    <section class="cs-sec"><h3>가격 축</h3>
      <div class="seg" role="group" aria-label="가격 축 방식">${Object.entries(SCALE_NAMES).map(([v, l]) => `<button type="button" data-scale="${v}" aria-pressed="${prefs.scale === v}">${l}</button>`).join('')}</div>
      <label class="cs-chk"><input type="checkbox" data-cs="invert"${prefs.invert ? ' checked' : ''}><span>위아래 뒤집기 <small>단축키 Alt+I · 로그 Alt+L · 퍼센트 Alt+P</small></span></label>
    </section>
    <section class="cs-sec"><h3>십자선</h3>
      <div class="seg" role="group" aria-label="십자선 움직임">${[['normal', '자유롭게'], ['magnet', '봉 종가에 붙기']].map(([v, l]) => `<button type="button" data-cross="${v}" aria-pressed="${prefs.cross === v}">${l}</button>`).join('')}</div>
    </section>
    <section class="cs-sec"><h3>시간대</h3>
      <select class="field" id="csTz" aria-label="시간대">${TZ_LIST.map(([v, name]) => `<option value="${v}"${v === prefs.tz ? ' selected' : ''}>${esc(tzName(v))}${v === 'local' ? '' : ' · ' + esc(name)}</option>`).join('')}</select>
    </section>`;
}
function openChartSet() { closePops(); renderChartSet(); $('#chartDlg').hidden = false; }
$('#chartSetBtn').addEventListener('click', openChartSet);
$('#chartBody').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.cpre) { [prefs.upC, prefs.dnC] = COLOR_PRESETS[b.dataset.cpre]; savePrefs(); refreshLook(); }
  else if (b.dataset.scale) { prefs.scale = b.dataset.scale; savePrefs(); applyScale(); syncToolButtons(); }
  else if (b.dataset.cross) { prefs.cross = b.dataset.cross; savePrefs(); for (const c of charts) c.applyOptions({ crosshair: { mode: prefs.cross === 'magnet' ? LC.CrosshairMode.Magnet : LC.CrosshairMode.Normal } }); }
  else return;
  renderChartSet();
});
$('#chartBody').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'csUp' || t.id === 'csDn') { prefs[t.id === 'csUp' ? 'upC' : 'dnC'] = t.value; savePrefs(); refreshLook(); renderChartSet(); return; }
  if (t.id === 'csTz') return setTz(t.value);
  const k = t.dataset.cs;
  if (!k) return;
  prefs[k] = t.checked; savePrefs();
  if (k === 'grid' || k === 'wmOn') refreshLook();
  else if (k === 'pline') { if (mainSeries) mainSeries.applyOptions({ priceLineVisible: prefs.pline }); }
  else if (k === 'invert') applyScale();
  else { tvTick(); if (tvLayer.req) tvLayer.req(); }
});

// ── 날짜로 이동 ──
const sleep = ms => new Promise(r => setTimeout(r, ms));
function prepGoto() {
  const vr = chart.timeScale().getVisibleLogicalRange(), n = S.bars.length;
  const i = vr && n ? Math.max(0, Math.min(n - 1, Math.round((vr.from + vr.to) / 2))) : n - 1;
  const z = zDate(n ? S.bars[i].t : nowSrv());
  $('#gotoIn').value = `${z.getUTCFullYear()}-${pad(z.getUTCMonth() + 1)}-${pad(z.getUTCDate())}T${pad(z.getUTCHours())}:${pad(z.getUTCMinutes())}`;
  $('#gotoTz').textContent = tzLabelOf(TZ);
}
function openGoto() { closePops(); prepGoto(); openPop($('#gotoBtn'), $('#gotoPop')); setTimeout(() => $('#gotoIn').focus(), 0); }
async function gotoDate(v) {
  const m = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/.exec(v || '');
  if (!m) { toast('날짜를 고르세요.', 'err'); return; }
  const target = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) - TZ * 1000;
  if (target > nowSrv()) { toast('아직 오지 않은 시간이에요.', 'err'); return; }
  closePops();
  const token = S.token;
  if (S.bars.length && S.bars[0].t > target && !S.noMore) toast('예전 봉을 받아 오는 중…');
  for (let k = 0; k < 80 && token === S.token && S.bars.length && S.bars[0].t > target && !S.noMore && S.bars.length < 20000; k++) {
    while (S.older && token === S.token) await sleep(80);
    const before = S.raw.length;
    await loadOlder();
    if (S.raw.length === before && !S.older) break;
  }
  if (token !== S.token || !S.bars.length) return;
  const b = S.bars;
  if (b[0].t > target) toast(S.noMore ? '그보다 예전 봉은 거래소에 없어요. 가장 오래된 봉으로 이동했어요.' : '봉이 너무 많아 더 받지 못했어요. 큰 시간 단위로 바꿔서 이동해 보세요.', 'err');
  let lo = 0, hi = b.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (b[mid].t <= target) lo = mid; else hi = mid - 1; }
  const r = chart.timeScale().getVisibleLogicalRange(), w = r ? Math.max(40, r.to - r.from) : 120;
  chart.timeScale().setVisibleLogicalRange({ from: lo - w / 2, to: lo + w / 2 });
  for (const c of charts) c.priceScale('right').applyOptions({ autoScale: true });
}
$('#gotoForm').addEventListener('submit', e => { e.preventDefault(); gotoDate($('#gotoIn').value); });

// ── 전체 화면 ──
const FS_ON = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.5v-4h4M11.5 2.5h4v4M15.5 11.5v4h-4M6.5 15.5h-4v-4"/></svg>';
const FS_OFF = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 2.5v4h-4M15.5 6.5h-4v-4M11.5 15.5v-4h4M2.5 11.5h4v4"/></svg>';
function syncFs() {
  const on = !!document.fullscreenElement, b = $('#fsBtn');
  b.innerHTML = on ? FS_OFF : FS_ON;
  b.setAttribute('aria-label', on ? '전체 화면 끝내기' : '전체 화면');
  b.title = on ? '전체 화면 끝내기 (Esc)' : '전체 화면';
}
$('#fsBtn').hidden = !document.fullscreenEnabled;
$('#fsBtn').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => toast('전체 화면으로 바꾸지 못했어요.', 'err')); });
document.addEventListener('fullscreenchange', syncFs);
syncFs();
