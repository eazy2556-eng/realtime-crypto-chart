
// ───────── 바 리플레이 ─────────
// 과거의 한 봉에서 시작해 한 봉씩(또는 자동으로) 차트를 다시 펼쳐 본다. 끝내면 실시간 차트로 돌아온다
const RP = { on: false, picking: false, full: null, idx: 0, timer: null, speed: 1 };
const RP_SPEEDS = [[1, '1배'], [3, '3배'], [10, '10배']];
function rpPick() {
  if (RP.on) return rpExit();
  if (!S.bars.length || S.loading) return;
  setTool('cursor');
  RP.picking = true;
  const h = $('#drawHint');
  h.textContent = '바 리플레이: 시작할 봉을 클릭하세요 · Esc 취소';
  h.hidden = false;
  syncRpBtn();
}
function rpCancelPick() { RP.picking = false; $('#drawHint').hidden = true; syncRpBtn(); }
function rpBegin(x) {
  const n = S.bars.length, l = chart.timeScale().coordinateToLogical(x);
  rpCancelPick();
  if (l == null || n < 30) return;
  const i = Math.max(10, Math.min(n - 2, Math.round(l)));
  const r = chart.timeScale().getVisibleLogicalRange(), w = r ? r.to - r.from : 120;
  RP.full = S.bars.slice(); RP.idx = i; RP.on = true;
  S.bars = RP.full.slice(0, i + 1); rebuildIndex(); S.futBase = null;
  renderAll();
  chart.timeScale().setVisibleLogicalRange({ from: i - w * .8, to: i + w * .2 });
  renderRpBar(); syncRpBtn();
  toast('바 리플레이를 시작했어요. ▶로 재생하거나 한 봉씩 넘겨 보세요. (Shift+→ 한 봉)');
}
function rpStep() {
  if (!RP.on) return;
  if (RP.idx >= RP.full.length - 1) { rpPause(); toast('리플레이를 시작할 때의 마지막 봉까지 왔어요.'); return; }
  RP.idx++;
  pushBar(RP.full[RP.idx]);
  schedule(false);
  const r = chart.timeScale().getVisibleLogicalRange(); // 새 봉이 화면 밖으로 나가면 따라간다
  if (r && RP.idx > r.to - 2) chart.timeScale().setVisibleLogicalRange({ from: r.from + 1, to: r.to + 1 });
  renderRpBar();
}
function rpPlay() { if (!RP.on || RP.timer) return; RP.timer = setInterval(rpStep, 1000 / RP.speed); renderRpBar(); }
function rpPause() { clearInterval(RP.timer); RP.timer = null; renderRpBar(); }
function rpExit(silent) { // 실시간으로 돌아오기 (멈춘 동안 놓친 봉은 다시 받는다)
  if (RP.picking) rpCancelPick();
  if (!RP.on) return;
  rpPause();
  RP.on = false; RP.full = null;
  $('#rpBar').hidden = true; syncRpBtn();
  if (!silent) { load(cur.sid, spec.id); toast('실시간 차트로 돌아왔어요.'); }
}
function renderRpBar() {
  const bar = $('#rpBar');
  if (!RP.on) { bar.hidden = true; return; }
  const b = S.bars[S.bars.length - 1], z = zDate(b.t);
  bar.innerHTML = `<span class="rp-tag">리플레이</span>`
    + `<button type="button" class="icon-btn" data-rp="${RP.timer ? 'pause' : 'play'}" aria-label="${RP.timer ? '일시정지' : '재생'}" title="${RP.timer ? '일시정지' : '재생'}">${RP.timer ? '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="4" y="3" width="3" height="10" rx=".6"/><rect x="9" y="3" width="3" height="10" rx=".6"/></svg>' : '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3l8 5-8 5z"/></svg>'}</button>`
    + `<button type="button" class="icon-btn" data-rp="step" aria-label="한 봉 넘기기" title="한 봉 넘기기 (Shift+→)"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 3l7 5-7 5z"/><rect x="11" y="3" width="2" height="10" rx=".5"/></svg></button>`
    + `<span class="seg">${RP_SPEEDS.map(([v, l]) => `<button type="button" data-rps="${v}" aria-pressed="${RP.speed === v}">${l}</button>`).join('')}</span>`
    + `<span class="rp-time num">${z.getUTCFullYear()}.${pad(z.getUTCMonth() + 1)}.${pad(z.getUTCDate())}${spec.intraday ? ` ${pad(z.getUTCHours())}:${pad(z.getUTCMinutes())}` : ''}</span>`
    + `<span class="rp-left muted">남은 봉 ${RP.full.length - 1 - RP.idx}</span>`
    + `<button type="button" class="btn-ghost rp-exit" data-rp="exit">끝내기</button>`;
  bar.hidden = false;
}
function syncRpBtn() { const b = $('#replayBtn'); if (b) b.setAttribute('aria-pressed', String(RP.on || RP.picking)); }
$('#rpBar').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.rps) { RP.speed = +b.dataset.rps; if (RP.timer) { rpPause(); rpPlay(); } else renderRpBar(); return; }
  ({ play: rpPlay, pause: rpPause, step: () => { rpPause(); rpStep(); }, exit: () => rpExit() })[b.dataset.rp]?.();
});

// ───────── 종목 비교 ─────────
// 다른 종목(다른 거래소도 가능)의 종가를 같은 시간 단위로 받아 퍼센트 축에 겹쳐 그린다
const CMP_COLORS = ['#ff9800', '#00bcd4', '#e91e63'];
const CMP = { list: [], key: '', n: 0, timer: null };
function cmpName(sid) { const s = sidInfo(sid); return s ? `${s.V.disp(s.native)} · ${EX_SHORT[s.V.ex]}${s.V.mk === 'perp' ? ' 선물' : ''}` : sid; }
async function cmpFetch(c, full) {
  const s = sidInfo(c.sid), sp = spec, key = CMP.key;
  if (!s) return;
  if (!s.V.iv.includes(sp.base)) { c.err = `${s.V.label}에서는 ${sp.label} 봉을 받을 수 없어요`; renderCmpLegend(); return; }
  try {
    let raw = [], end = null;
    const need = full && S.bars.length ? S.bars[0].t : Infinity;
    for (let pg = 0; pg < (full ? 6 : 1); pg++) {
      const r = await s.V.klines(s.native, sp.base, end);
      const part = r.bars.filter(b => !end || b.t <= end).map(b => ({ t: b.t, time: toTime(b.t), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
      raw = part.concat(raw.filter(b => !part.length || b.t > part[part.length - 1].t));
      if (!r.more || !part.length || part[0].t <= need) break;
      end = part[0].t - 1;
    }
    if (key !== CMP.key || !CMP.list.includes(c)) return;
    const bars = sp.native ? raw : aggregate(raw, sp);
    if (full) c.map = new Map();
    for (const b of bars) c.map.set(b.t, b.close);
    c.err = null;
    cmpSetData(c);
  } catch (e) { c.err = '받지 못했어요'; }
  renderCmpLegend();
}
function cmpSetData(c) {
  if (!c.series || !c.map) return;
  const d = [];
  for (const b of S.bars) { const v = c.map.get(b.t); if (v != null) d.push({ time: b.time, value: v }); }
  c.series.setData(d);
}
function cmpAddSeries(c) {
  c.series = chart.addLineSeries({ autoscaleInfoProvider: pzProvider(chart, 'other'), color: c.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false, priceFormat: { type: 'price', precision: 8, minMove: 1e-8 } });
  c.series.attachPrimitive(pathReset());
}
function addCompare(sid) {
  if (sid === cur.sid) { toast('지금 보는 종목이에요. 다른 종목을 고르세요.'); return; }
  if (prefs.cmp.includes(sid)) { toast('이미 비교하고 있어요.'); return; }
  if (prefs.cmp.length >= 3) { toast('비교는 3개까지예요. 범례에서 하나를 지운 뒤 추가하세요.', 'err'); return; }
  prefs.cmp.push(sid); savePrefs();
  const c = { sid, color: CMP_COLORS.find(x => !CMP.list.some(o => o.color === x)) || '#9e9e9e', map: null, series: null, err: null };
  CMP.list.push(c);
  cmpAddSeries(c); applyScale(); syncToolButtons();
  renderCmpLegend();
  cmpFetch(c, true);
  toast(`${cmpName(sid)}와 비교해요. 가격 축은 퍼센트(%)로 바뀌어요.`);
}
function removeCompare(sid) {
  const c = CMP.list.find(x => x.sid === sid);
  if (!c) return;
  try { chart.removeSeries(c.series); } catch {}
  CMP.list = CMP.list.filter(x => x !== c);
  prefs.cmp = prefs.cmp.filter(x => x !== sid); savePrefs();
  applyScale(); syncToolButtons(); renderCmpLegend();
}
function renderCmpLegend() {
  const el = $('#lgCmp');
  el.innerHTML = CMP.list.map(c => `<span class="cmp-chip"><i style="background:${c.color}"></i>${esc(cmpName(c.sid))}${c.err ? ` <em>${esc(c.err)}</em>` : ''}<button type="button" data-cmpdel="${esc(c.sid)}" aria-label="${esc(cmpName(c.sid))} 비교 지우기" title="비교 지우기">${ICON_X}</button></span>`).join('');
  el.hidden = !CMP.list.length;
}
$('#lgCmp').addEventListener('click', e => { const b = e.target.closest('[data-cmpdel]'); if (b) removeCompare(b.dataset.cmpdel); });
function cmpTick() { // 종목·시간 단위·시간대가 바뀌면 다시 받고, 켜 둔 동안은 10초마다 최근 봉을 맞춘다
  if (!CMP.list.length || S.loading || !S.bars.length || !cur) return;
  const key = `${cur.sid}|${spec.id}|${TZ}`;
  if (key !== CMP.key) {
    CMP.key = key; CMP.n = S.bars.length;
    for (const c of CMP.list) { if (c.sid === cur.sid) continue; c.map = null; c.series.setData([]); cmpFetch(c, true); }
    return;
  }
  if (S.bars.length !== CMP.n || S.bars[0].t !== CMP.first) { CMP.n = S.bars.length; CMP.first = S.bars[0].t; for (const c of CMP.list) cmpSetData(c); }
}
setInterval(cmpTick, 1000);
setInterval(() => { if (!document.hidden && !RP.on) for (const c of CMP.list) if (c.map) cmpFetch(c, false); }, 10000);
function initCompare() { // 시작할 때 저장된 비교 종목 다시 달기
  for (const sid of prefs.cmp) {
    const c = { sid, color: CMP_COLORS[CMP.list.length] || '#9e9e9e', map: null, series: null, err: null };
    CMP.list.push(c); cmpAddSeries(c);
  }
  renderCmpLegend();
}
$('#cmpBtn').addEventListener('click', () => openSearch('cmp'));
initCompare();
