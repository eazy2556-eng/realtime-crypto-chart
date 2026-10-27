
// ───────── 지금 보는 종목 ─────────
function makeCur(sid) {
  const s = sidInfo(sid);
  const [b, q] = s.V.split(s.native);
  return Object.assign(s, { ex: s.V.ex, mk: s.V.mk, title: s.V.disp(s.native), tv: `${EX_TV[s.V.ex]}:${s.V.disp(s.native)}`, base: b, quote: q });
}
// 작도·수평선 저장 이름 (바이낸스 현물은 예전 이름 그대로)
const symKey = () => cur.vk === 'binance:spot' ? cur.native : cur.sid;

// 기본 봉을 여러 번 받아 원하는 개수(minBars)만큼의 합성 봉을 만든다
async function fetchRaw(sp, endTime, minBars) {
  const V = cur.V, native = cur.native, want = Math.max(1, minBars) * sp.k;
  let raw = [], end = endTime, exhausted = false;
  for (let pg = 0; pg < 12; pg++) {
    const r = await V.klines(native, sp.base, end);
    const part = r.bars.filter(b => !end || b.t <= end).map(b => ({ t: b.t, time: toTime(b.t), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
    raw = part.concat(raw.filter(b => !part.length || b.t > part[part.length - 1].t));
    if (!r.more || !part.length) { exhausted = true; break; }
    if (raw.length >= want) break;
    end = part[0].t - 1;
  }
  return { raw, exhausted };
}
function aggregate(raw, sp) {
  const out = []; let c = null;
  for (const b of raw) {
    const t0 = bucketStart(b.t, sp);
    if (!c || c.t !== t0) { c = { t: t0, time: toTime(t0), open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }; out.push(c); }
    else { if (b.high > c.high) c.high = b.high; if (b.low < c.low) c.low = b.low; c.close = b.close; c.volume += b.volume; }
  }
  return out;
}
// 피봇용 상위 기간 봉 (일·주·월·년). 새 기간이 시작되면 다시 받는다
const HTF = {}, HTF_IV = { D: '1d', W: '1w', M: '1M', Y: '1M' };
function htfMap(tf) {
  const k = cur.sid + ':' + tf, v = HTF[k], n = S.bars.length;
  const lastKey = n ? anchorKey(S.bars[n - 1].t, tf) : 0;
  if (v instanceof Map && v.maxKey >= lastKey) return v;
  if (v && v.loading) return v.map || null;
  if (typeof v === 'number' && Date.now() - v < 30000) return null;
  const sid = cur.sid, V = cur.V, native = cur.native, old = v instanceof Map ? v : null;
  HTF[k] = { loading: true, map: old };
  V.klines(native, HTF_IV[tf], null).then(r => {
    const m = new Map();
    m.maxKey = -Infinity;
    for (const b of r.bars) {
      const key = anchorKey(b.t, tf), x = m.get(key);
      if (!x) m.set(key, { h: b.h, l: b.l, c: b.c });
      else { x.h = Math.max(x.h, b.h); x.l = Math.min(x.l, b.l); x.c = b.c; }
      m.maxKey = Math.max(m.maxKey, key);
    }
    HTF[k] = m;
    if (sid === cur.sid) schedule(true);
  }).catch(() => { HTF[k] = Date.now(); });
  return old;
}
function rebuildIndex() { S.tIndex = new Map(S.bars.map((b, i) => [b.time, i])); }
function buildBars() {
  if (spec.native) S.bars = S.raw;
  else {
    S.bars = aggregate(S.raw, spec);
    if (S.bars.length > 1 && S.bars[0].t < S.raw[0].t && !S.noMore) S.bars.shift(); // 앞쪽 덜 찬 봉은 버림
  }
  rebuildIndex();
}
function pushBar(bar) { S.bars.push(bar); S.tIndex.set(bar.time, S.bars.length - 1); }

// ───────── 지연 측정 ─────────
// 체결 시각(거래소 서버 시계) → 내 PC 수신 시각(서버 시계로 보정) 차이를 잰다
const LAT = { off: 0, ready: false, rtt: null, net: [], inner: [], screen: [], pendingAt: null, vk: null };
const pushS = (a, v) => { a.push(v); if (a.length > 300) a.shift(); };
function pct(a, q) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
async function syncClock() {
  const V = cur.V;
  if (LAT.vk !== V.key) Object.assign(LAT, { vk: V.key, ready: false, net: [], inner: [], screen: [] });
  let best = null;
  for (let k = 0; k < 4; k++) {
    const t0 = Date.now();
    try { const st = await V.time(), t1 = Date.now(); if (!best || t1 - t0 < best.rtt) best = { rtt: t1 - t0, off: st - (t0 + t1) / 2 }; } catch {}
  }
  if (best && V === cur.V) { LAT.off = best.off; LAT.rtt = best.rtt; LAT.ready = true; }
}
function renderLatency() {
  const med = pct(LAT.net, .5), scr = pct(LAT.screen, .5);
  $('#connLat').textContent = med == null ? '' : `· ${Math.max(0, Math.round(med + (scr || 0)))}ms`;
  const pop = $('#latPop');
  if (pop.hidden) return;
  const f = v => v == null ? '—' : Math.round(v) + ' ms';
  pop.innerHTML = `<div class="lat-big">${med == null ? '측정 중…' : f(med + (scr || 0))}</div>
    <div class="muted" style="font-size:12px">${cur.V.label} · 체결 → 화면 표시까지 (최근 ${LAT.net.length}건 중앙값)</div>
    <dl class="lat-grid">
      <dt>체결 → 내 PC 수신</dt><dd>${f(med)} · 느린 10% ${f(pct(LAT.net, .9))}</dd>
      <dt>└ 거래소 내부 (체결 → 전송)</dt><dd>${LAT.inner.length ? f(pct(LAT.inner, .5)) : '거래소가 안 알려 줌'}</dd>
      <dt>수신 → 화면 반영</dt><dd>${f(scr)}</dd>
      <dt>서버 왕복 (REST)</dt><dd>${f(LAT.rtt)}</dd>
      <dt>시계 보정 오차</dt><dd>${LAT.rtt == null ? '—' : '±' + Math.round(LAT.rtt / 2) + ' ms'}</dd>
    </dl>
    <p class="lat-note">체결·캔들은 거래가 생길 때마다 바로 반영됩니다. 호가창은 약 0.1초, 24시간 시세는 거래소가 보내 주는 주기(바이낸스 1초)마다 바뀝니다.</p>`;
}
setInterval(renderLatency, 1000);
setInterval(() => { if (cur) syncClock(); }, 10 * 60 * 1000);

// ───────── 실시간 데이터 처리 ─────────
function onTrade(ev) {
  const p = ev.p, q = ev.q, T = ev.T;
  S.trades.unshift({ p, q, T, sell: ev.sell });
  if (S.trades.length > 60) S.trades.length = 60;
  tradesDirty = true;
  if (ev.snap) return; // 연결 직후 받은 지난 체결 묶음은 목록에만
  if (LAT.ready) { pushS(LAT.net, Date.now() + LAT.off - T); if (ev.E) pushS(LAT.inner, ev.E - T); }
  if (LAT.pendingAt == null) LAT.pendingAt = performance.now();
  const prev = S.lastPrice;
  S.lastPrice = p; S.lastTrade = { T, p };
  if (prev != null && prev !== p) checkAlerts(prev, p);
  alertTick(cur.sid, p);
  if (RP.on) return; // 리플레이 중에는 차트를 멈춰 둔다 (끝내면 다시 받음)
  if (!S.bars.length || S.loading) { schedule(false); return; }
  const last = S.bars[S.bars.length - 1];
  if (T < last.t) return;
  const b0 = spec.noTradeNew ? null : bucketStart(T, spec);
  if (b0 !== null && b0 > last.t) pushBar({ t: b0, time: toTime(b0), open: p, high: p, low: p, close: p, volume: q });
  else { last.close = p; if (p > last.high) last.high = p; if (p < last.low) last.low = p; last.volume += q; }
  schedule(false);
}
function tradeOverride(bar, E) { // 캔들 메시지보다 늦게 들어온 체결가는 유지
  const lt = S.lastTrade;
  if (lt && lt.T > E && lt.T >= bar.t) { bar.close = lt.p; bar.high = Math.max(bar.high, lt.p); bar.low = Math.min(bar.low, lt.p); }
}
function placeBar(bar, E) {
  const n = S.bars.length, last = S.bars[n - 1];
  if (bar.t === last.t) { tradeOverride(bar, E); S.bars[n - 1] = bar; schedule(false); }
  else if (bar.t > last.t) { pushBar(bar); schedule(false); }
  else { // 지난 봉의 마감 값: 같으면 그냥 두고, 다르면 고친다 (다시 그리기는 나눠서)
    const i = S.tIndex.get(bar.time), o = i !== undefined && S.bars[i];
    if (!o || (o.open === bar.open && o.high === bar.high && o.low === bar.low && o.close === bar.close && o.volume === bar.volume)) return;
    S.bars[i] = bar; schedule(true);
  }
}
function onKline(ev) {
  if (RP.on || S.loading || !S.raw.length || ev.iv !== spec.base) return;
  const k = ev.bar, E = ev.E || Date.now() + LAT.off;
  const bar = { t: k.t, time: toTime(k.t), open: k.o, high: k.h, low: k.l, close: k.c, volume: k.v };
  if (spec.native) return placeBar(bar, E);
  const rn = S.raw.length, rl = S.raw[rn - 1];
  let ri;
  if (bar.t === rl.t) { S.raw[rn - 1] = bar; ri = rn - 1; }
  else if (bar.t > rl.t) { S.raw.push(bar); ri = rn; }
  else { ri = -1; for (let i = rn - 2; i >= Math.max(0, rn - 6); i--) if (S.raw[i].t === bar.t) { S.raw[i] = bar; ri = i; break; } if (ri < 0) return; }
  const t0 = bucketStart(bar.t, spec);
  let j = ri, e = ri;
  while (j > 0 && bucketStart(S.raw[j - 1].t, spec) === t0) j--;
  while (e + 1 < S.raw.length && bucketStart(S.raw[e + 1].t, spec) === t0) e++;
  placeBar(aggregate(S.raw.slice(j, e + 1), spec)[0], E);
}
function onTicker(t) {
  S.ticker = { c: t.c, o: t.o, h: t.h, l: t.l, v: t.v, q: t.q };
  $('#sumHigh').textContent = fp(t.h);
  $('#sumLow').textContent = fp(t.l);
  $('#sumVol').textContent = fvol(t.v);
  $('#sumQv').textContent = fvol(t.q);
  updatePrice();
}
let lastTitleAt = 0, prevShown = null;
function updatePrice() {
  const p = S.lastPrice != null ? S.lastPrice : S.ticker && S.ticker.c;
  if (p == null) return;
  const el = $('#sumLast');
  el.textContent = fp(p);
  if (prevShown != null && p !== prevShown) el.className = 'num ' + (p > prevShown ? 'up' : 'down');
  prevShown = p;
  const t = S.ticker;
  if (t && t.o) {
    const ch = p - t.o, pc = ch / t.o * 100, c = $('#sumChg');
    c.textContent = `${ch >= 0 ? '+' : ''}${fp(ch)}  ${fpct(pc)}`;
    c.className = 'sum-chg num ' + (ch >= 0 ? 'up' : 'down');
    if (el.className === 'num') el.className = 'num ' + (ch >= 0 ? 'up' : 'down');
    const now = Date.now();
    if (now - lastTitleAt > 400) { lastTitleAt = now; document.title = `${cur.title} ${fp(p)} ${pc >= 0 ? '▲' : '▼'} ${fpct(pc)}`; }
  }
}

// ───────── 실시간 구독 ─────────
function topicsFor() {
  const s = cur.sid, list = [{ sid: s, kind: 'kline', iv: spec.base }, { sid: s, kind: 'trade' }, { sid: s, kind: 'ticker' }];
  if (!EMBED || prefs.bidask) list.push({ sid: s, kind: 'book' }); // 멀티 차트의 다른 칸은 호가·관심 종목을 받지 않는다
  if (!EMBED) for (const w of new Set(prefs.watch.concat(alertSids()))) list.push({ sid: w, kind: 'mini' });
  return list;
}
function resubscribe() {
  WSM.set(topicsFor());
  const c = WSM.conns.get(curConnKey()); // 이미 열려 있던 연결이면 바로 '실시간'으로
  setStatus(c && c.ws && c.ws.readyState === 1 ? 'live' : c && c.opened ? 'reconnecting' : 'connecting');
}
const curConnKey = () => { const w = cur.V.ws; return typeof w.key === 'function' ? w.key('trade') : w.key; };
WSM.onEvent = ev => {
  const sid = sidOf(ev.vk, ev.native);
  if (ev.kind === 'mini' || ev.kind === 'ticker') onMini(sid, ev);
  if (ev.kind === 'mini' && (!cur || sid !== cur.sid)) alertTick(sid, ev.c); // 다른 종목 가격 알림
  if (sid !== cur.sid) return;
  if (ev.kind === 'trade') onTrade(ev);
  else if (ev.kind === 'kline') onKline(ev);
  else if (ev.kind === 'ticker') onTicker(ev);
  else if (ev.kind === 'book') { S.book = ev; bookDirty = true; }
};
WSM.status = (conn, s) => { if (cur && conn.key === curConnKey()) setStatus(s); };
WSM.reopened = conn => { if (conn.key === curConnKey()) resync(); fetchWatchInit(); };
function setStatus(s) {
  const el = $('#conn');
  el.dataset.state = s;
  el.querySelector('.conn-text').textContent = { connecting: '연결 중…', live: '실시간', reconnecting: '재연결 중…' }[s] || s;
}
async function resync() {
  if (RP.on || S.loading || !S.raw.length) return;
  const token = S.token, sp = spec;
  try {
    const rr = await fetchRaw(sp, null, 1);
    if (token !== S.token || !rr.raw.length) return;
    const fresh = rr.raw, lastOld = S.raw[S.raw.length - 1], bms = ivMsOf(sp.base) || 0;
    if (fresh[0].t > lastOld.t + bms) S.raw = fresh;
    else { const i = S.raw.findIndex(b => b.t >= fresh[0].t); S.raw = S.raw.slice(0, i < 0 ? S.raw.length : i).concat(fresh); }
    buildBars(); schedule(true);
  } catch (e) { console.warn(e); }
}

// ───────── 종목 · 시간 단위 불러오기 ─────────
function showOverlay(msg, err) {
  $('#overlay').hidden = false;
  $('#spinner').hidden = !!err;
  $('#overlayMsg').textContent = msg;
  $('#retryBtn').hidden = !err;
}
function applyInfo(info) {
  S.base = info.base; S.quote = info.quote; cur.base = info.base; cur.quote = info.quote;
  S.tick = info.tick; S.pricePrec = info.prec; S.qtyPrec = Math.min(8, info.qtyPrec);
  precCache[cur.sid] = S.pricePrec;
}
function renderMeta() {
  const h = hue(S.base);
  for (const el of [$('#symCoin'), $('#sumCoin')]) { el.textContent = S.base.slice(0, 1); el.style.setProperty('--h', h); }
  $('#symText').textContent = cur.title;
  $('#exBadge').textContent = cur.V.label;
  $('#exBadge').dataset.ex = cur.ex;
  $('#sumSym').innerHTML = `${esc(S.base)}<small>/${esc(S.quote)}</small>`;
  $('#sumSub').textContent = cur.V.label;
  $('#lgSym').textContent = `${S.base}/${S.quote}${cur.mk === 'perp' ? ' 무기한' : ''}`;
  $('#lgIv').textContent = spec.label;
  $('#lgEx').textContent = EX_LABEL[cur.ex];
  $('#sumVolL').textContent = `24h 거래량(${S.base})`;
  $('#sumQvL').textContent = `24h 거래대금(${S.quote})`;
  $('#tcP').textContent = $('#bcP').textContent = `가격(${S.quote})`;
  $('#tcQ').textContent = $('#bcQ').textContent = `수량(${S.base})`;
  $('#bcT').textContent = `합계(${S.quote})`;
  chart.applyOptions({ watermark: { text: wmText() } });
  $$('#watchList .w-item').forEach(li => li.classList.toggle('active', li.dataset.s === cur.sid));
}
async function load(sid, ivId) {
  rpExit(true);
  if (!sidInfo(sid)) sid = 'binance:spot:BTCUSDT';
  const symChanged = !cur || sid !== cur.sid || S.infoFor !== sid, venueChanged = !cur || cur.vk !== sidInfo(sid).vk;
  if (!cur || sid !== cur.sid) cur = makeCur(sid);
  setVenueIntervals(cur.V);
  let sp = parseIv(ivId);
  if (!sp) {
    const m = /^(\d+)([smhdwM])$/.exec(ivId || '');
    toast(`${cur.V.label}에서는 ${m ? m[1] + UNITS[m[2]].label : ivId} 봉을 만들 수 없어 1분봉으로 바꿨어요.`);
    sp = parseIv('1m');
  }
  const token = ++S.token;
  prefs.sym = sid; prefs.interval = sp.id; spec = sp; savePrefs();
  mcMoved(sid, sp.id);
  Object.assign(S, { loading: true, raw: [], bars: [], tIndex: new Map(), noMore: false, older: false, renderedN: 0, indRenderedN: 0, futBase: null });
  hoverIdx = null;
  if (symChanged) {
    Object.assign(S, { trades: [], book: null, lastPrice: null, lastTrade: null, ticker: null });
    [S.base, S.quote] = [cur.base, cur.quote];
    prevShown = null; tradesDirty = bookDirty = true;
    $('#sumLast').textContent = '—'; $('#sumLast').className = 'num'; $('#sumChg').textContent = '';
    for (const id of ['sumHigh', 'sumLow', 'sumVol', 'sumQv']) $('#' + id).textContent = '—';
  }
  if (venueChanged) { setStatus('connecting'); syncClock(); }
  showOverlay(sp.native ? `${cur.V.label} 차트 불러오는 중…` : `${sp.label} 봉 만드는 중… (${parseIv(sp.base).label} 봉 ${sp.k}개씩 합치기)`);
  syncControls(); renderMeta();
  if (symChanged) { // 예전 기호에 맞던 정밀도로 새 종목을 그리지 않도록 정보부터 받는다
    try { applyInfo(await cur.V.info(cur.native)); S.infoFor = sid; loadHlines(); dwLoad(); renderMeta(); }
    catch (e) {
      if (token !== S.token) return;
      showOverlay(`종목 정보를 불러오지 못했어요 (${e.message}). 인터넷 연결을 확인한 뒤 다시 시도하세요.`, true);
      return;
    }
    if (token !== S.token) return;
  }
  resubscribe();
  try {
    const [rr, tk] = await Promise.all([fetchRaw(sp, null, 600), symChanged ? cur.V.ticker(cur.native).catch(() => null) : null]);
    if (token !== S.token) return;
    S.raw = rr.raw; S.noMore = rr.exhausted;
    if (!S.raw.length) throw new Error('받은 봉이 없어요');
    buildBars();
    S.loading = false;
    for (const c of charts) c.applyOptions({ timeScale: { timeVisible: sp.intraday, secondsVisible: sp.unit === 's' } });
    rebuildIndicators(); renderAll();
    if (tk) onTicker(tk);
    const n = S.bars.length;
    chart.priceScale('right').applyOptions({ autoScale: true });
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 140), to: n + 8 });
    $('#overlay').hidden = true;
    requestAnimationFrame(onRange);
  } catch (e) {
    if (token !== S.token) return;
    console.error(e);
    showOverlay(`차트를 불러오지 못했어요 (${e.message}). 인터넷 연결을 확인한 뒤 다시 시도하세요.`, true);
  }
}
async function loadOlder() {
  if (RP.on || S.older || S.noMore || S.loading || !S.raw.length || S.bars.length >= 20000) return;
  S.older = true;
  const token = S.token, sp = spec;
  try {
    const first = S.raw[0].t, rr = await fetchRaw(sp, first - 1, 1000); // 한 번에 많이 받아 받는 횟수를 줄인다
    if (token !== S.token) return;
    const older = rr.raw.filter(b => b.t < first);
    if (rr.exhausted) S.noMore = true;
    if (!older.length) { S.noMore = true; return; }
    const r = chart.timeScale().getVisibleLogicalRange(), before = S.bars.length;
    S.raw = older.concat(S.raw); buildBars();
    const added = S.bars.length - before;
    if (hoverIdx != null) hoverIdx += added;
    renderAll(true);
    if (r) chart.timeScale().setVisibleLogicalRange({ from: r.from + added, to: r.to + added });
  } catch (e) { console.warn(e); }
  finally { if (token === S.token) S.older = false; }
}

// ───────── 관심 종목 (여러 거래소 섞어서) ─────────
const EX_SHORT = { binance: 'BN', bitget: 'BG', okx: 'OKX' };
const watchRows = new Map();
function renderWatch() {
  const ul = $('#watchList');
  ul.innerHTML = ''; watchRows.clear();
  for (const sid of prefs.watch) {
    const s = sidInfo(sid);
    if (!s) continue;
    const [b, q] = s.V.split(s.native), li = document.createElement('li');
    li.className = 'w-item' + (cur && sid === cur.sid ? ' active' : '');
    li.dataset.s = sid;
    li.innerHTML = `<button type="button" class="w-row" data-open="${esc(sid)}" title="${esc(s.V.label)} ${esc(s.native)}"><span class="w-sym">${esc(b)}<small>/${esc(q)}</small><span class="w-ex" data-ex="${s.V.ex}">${EX_SHORT[s.V.ex]}${s.V.mk === 'perp' ? '·선물' : ''}</span></span><span class="w-last num">—</span><span class="w-chg num">—</span></button><button type="button" class="w-del" data-del="${esc(sid)}" aria-label="${esc(b + q)} 관심 종목에서 빼기" title="관심 종목에서 빼기">${ICON_X}</button>`;
    ul.append(li);
    const r = { last: li.querySelector('.w-last'), chg: li.querySelector('.w-chg'), price: null };
    watchRows.set(sid, r);
    if (watchCache[sid]) updateWatchRow(sid, r, false);
  }
}
function updateWatchRow(sid, r, flash) {
  const { c, o } = watchCache[sid];
  r.last.textContent = fmt(c, precCache[sid] != null ? precCache[sid] : autoPrec(c));
  const pc = o ? (c - o) / o * 100 : 0;
  r.chg.textContent = fpct(pc);
  r.chg.className = 'w-chg num ' + (pc >= 0 ? 'up' : 'down');
  if (flash && r.price != null && c !== r.price) {
    r.last.classList.remove('flash-up', 'flash-down');
    void r.last.offsetWidth;
    r.last.classList.add(c > r.price ? 'flash-up' : 'flash-down');
  }
  r.price = c;
}
function onMini(sid, d) {
  if (!watchRows.has(sid)) return;
  watchCache[sid] = { c: d.c, o: d.o };
  updateWatchRow(sid, watchRows.get(sid), true);
}
const byVenue = sids => { const g = {}; for (const sid of sids) { const s = sidInfo(sid); if (s) (g[s.vk] = g[s.vk] || []).push(s.native); } return g; };
async function fetchPrec(sids) {
  const g = byVenue(sids.filter(s => precCache[s] == null));
  await Promise.all(Object.entries(g).map(async ([vk, natives]) => {
    try { const o = await VENUES[vk].precs(natives); for (const [n, p] of Object.entries(o)) precCache[sidOf(vk, n)] = p; } catch (e) { console.warn(e); }
  }));
}
async function fetchWatchInit() {
  if (EMBED) return;
  const g = byVenue(prefs.watch);
  const prec = fetchPrec(prefs.watch);
  await Promise.all(Object.entries(g).map(async ([vk, natives]) => {
    try {
      const d = await VENUES[vk].tickers(natives);
      await prec;
      for (const x of d) { const sid = sidOf(vk, x.native); watchCache[sid] = { c: x.c, o: x.o }; const r = watchRows.get(sid); if (r) updateWatchRow(sid, r, false); }
    } catch (e) { console.warn(vk, e); }
  }));
}
$('#watchList').addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del) { prefs.watch = prefs.watch.filter(x => x !== del.dataset.del); savePrefs(); renderWatch(); resubscribe(); return; }
  const row = e.target.closest('[data-open]');
  if (row && row.dataset.open !== cur.sid) load(row.dataset.open, prefs.interval);
});

// ───────── 체결 · 호가 ─────────
function renderTrades() {
  let h = '';
  for (const t of S.trades.slice(0, 40)) {
    const d = zDate(t.T);
    h += `<div class="t-row"><span class="${t.sell ? 'down' : 'up'}">${fp(t.p)}</span><span>${fmt(t.q, S.qtyPrec)}</span><span class="muted">${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}</span></div>`;
  }
  $('#tradeList').innerHTML = h || '<div class="empty">체결 내역을 기다리는 중…</div>';
}
function renderBook() {
  const el = $('#bookList'), b = S.book;
  if (!b || !b.asks || !b.bids || !b.asks.length || !b.bids.length) { el.innerHTML = '<div class="empty">호가를 기다리는 중…</div>'; return; }
  const levels = Math.max(4, Math.min(20, Math.floor(((el.clientHeight || 380) - 40) / 2 / 19)));
  const asks = b.asks.slice(0, levels), bids = b.bids.slice(0, levels);
  let ca = 0, cb = 0;
  const askCum = asks.map(([, q]) => (ca += q)), bidCum = bids.map(([, q]) => (cb += q)), max = Math.max(ca, cb) || 1;
  const row = (cls, p, q, w) => `<div class="ob-row ${cls}"><i style="width:${(w * 100).toFixed(1)}%"></i><span>${fp(p)}</span><span>${fmt(q, S.qtyPrec)}</span><span>${fvol(p * q)}</span></div>`;
  let h = '';
  for (let i = asks.length - 1; i >= 0; i--) h += row('down', asks[i][0], asks[i][1], askCum[i] / max);
  const last = S.lastPrice != null ? S.lastPrice : (asks[0][0] + bids[0][0]) / 2, dir = S.trades[0] ? (S.trades[0].sell ? 'down' : 'up') : '';
  h += `<div class="ob-mid"><strong class="num ${dir}">${fp(last)}</strong><span class="muted num">스프레드 ${fp(asks[0][0] - bids[0][0])}</span></div>`;
  for (let i = 0; i < bids.length; i++) h += row('up', bids[i][0], bids[i][1], bidCum[i] / max);
  el.innerHTML = h;
}
setInterval(() => {
  if (document.hidden) return;
  if (prefs.tab === 'trades' && tradesDirty) { tradesDirty = false; renderTrades(); }
  if (prefs.tab === 'book' && bookDirty) { bookDirty = false; renderBook(); }
}, 120);
function setTab(tab) {
  prefs.tab = tab; savePrefs();
  $$('.tabs [role="tab"]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $('#panelTrades').hidden = tab !== 'trades';
  $('#panelBook').hidden = tab !== 'book';
  $('#panelSig').hidden = tab !== 'sig';
  $('#panelCalc').hidden = tab !== 'calc';
  if (tab === 'sig') { sgRender(); sgTick(); }
  if (tab === 'calc') calcShow();
  tradesDirty = bookDirty = true;
}
$('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
