
// ───────── 저장 · 설정 ─────────
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const newUid = () => 'i' + Math.random().toString(36).slice(2, 10);
function defaultsOf(type) { const o = {}; for (const p of TYPES[type].params) o[p.k] = p.def; return o; }
// 지표는 pane 값으로 놓일 자리를 기억한다: 'main'(가격 차트 위) 또는 아래 창 키('p_…')
const newPaneKey = () => 'p_' + Math.random().toString(36).slice(2, 10);
function mk(type, preset, colors) {
  return { uid: newUid(), type, p: Object.assign(defaultsOf(type), preset || {}), colors: Object.assign({}, colors || {}), widths: {}, w: TYPES[type].w || 1, hidden: false, pane: TYPES[type].pane ? newPaneKey() : 'main' };
}
const DEFAULT_INDS = () => [mk('vol'), mk('ma', { kind: 'SMA', len: 7 }, { v: '#f0b90b' }), mk('ma', { kind: 'SMA', len: 25 }, { v: '#eb40b5' }), mk('ma', { kind: 'SMA', len: 99 }, { v: '#b385f8' }), mk('bakkta'), mk('rsi'), mk('stoch3')];
function sanitizeInst(i) {
  const def = TYPES[i.type], p = defaultsOf(i.type), src = i.p || {};
  for (const d of def.params) {
    let v = src[d.k];
    if (d.t === 'sel') { if (!d.opts.some(o => String(o[0]) === String(v))) v = d.def; }
    else if (d.t === 'bool') { if (typeof v !== 'boolean') v = d.def; }
    else { v = +v; if (!isFinite(v)) v = d.def; v = Math.min(d.max, Math.max(d.min, v)); if (d.t === 'int') v = Math.round(v); }
    p[d.k] = v;
  }
  const colors = {}, widths = {};
  if (i.colors && typeof i.colors === 'object') for (const [k, v] of Object.entries(i.colors)) if (/^#[0-9a-f]{6}$/i.test(v)) colors[k] = v;
  if (i.widths && typeof i.widths === 'object') for (const [k, v] of Object.entries(i.widths)) if ([1, 2, 3, 4].includes(v)) widths[k] = v;
  const uid = typeof i.uid === 'string' ? i.uid : newUid();
  const pane = i.pane === 'main' || /^p_[a-z0-9_]+$/i.test(i.pane || '') ? i.pane : (def.pane ? 'p_' + uid : 'main');
  return { uid, type: i.type, p, colors, widths, w: [1, 2, 3, 4].includes(i.w) ? i.w : (def.w || 1), hidden: !!i.hidden, pane, h: isFinite(i.h) && i.h ? +i.h : undefined };
}
// 쓰지 않는 창은 빼고, 순서 목록에 없는 창은 뒤에 붙인다
function normalizePanes() {
  const used = [];
  for (const i of prefs.inds) if (i.pane !== 'main' && !used.includes(i.pane)) used.push(i.pane);
  prefs.panes = (prefs.panes || []).filter(k => used.includes(k)).concat(used.filter(k => !(prefs.panes || []).includes(k)));
  for (const k of Object.keys(prefs.paneH)) if (!used.includes(k)) delete prefs.paneH[k];
}
const SID_RE = /^(binance|bitget|okx):(spot|perp):[A-Za-z0-9._-]{2,40}$/;
const EXTRA_WATCH = ['binance:perp:BTCUSDT', 'bitget:perp:BTCUSDT', 'okx:perp:BTC-USDT-SWAP'];
const DEFAULTS = {
  sym: 'binance:spot:BTCUSDT', interval: '1m', type: 'candle', scale: 'n', invert: false, theme: 'dark', tab: 'trades',
  tz: 'local', cd: true, pline: true, hilo: false, bidask: false, seps: false, vp: false, grid: true, wmOn: true, cross: 'normal', upC: null, dnC: null, cmp: [], calc: { rate: null, usdt: null, krw: null, last: 'usdt' }, alerts: [], layout: { n: '1', syncSym: false, syncIv: false, syncX: true },
  watch: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'TRXUSDT', 'LINKUSDT', 'AVAXUSDT'].map(s => 'binance:spot:' + s).concat(EXTRA_WATCH),
  favIv: DEFAULT_FAV, customIv: [], magnet: false, keepTool: false, hideDw: false, toolPick: {},
  v: 2, panes: [], paneH: {},
};
const TYPES_IDS = ['candle', 'hollow', 'heikin', 'bar', 'line', 'step', 'markers', 'area', 'baseline'];
const PREFS_KEY = EMBED ? 'bc:prefs:slot' + SLOT : 'bc:prefs';
const LOOK_KEYS = ['theme', 'upC', 'dnC', 'tz', 'cd', 'pline', 'hilo', 'bidask', 'seps', 'vp', 'grid', 'wmOn', 'cross']; // 멀티 차트 칸들이 첫 칸을 따르는 모양 설정
const SLOT_IV = { 1: '1h', 2: '4h', 3: '1d' };
const prefs = (() => {
  const main = store.get('bc:prefs', null) || {};
  let s = main;
  if (EMBED) { // 멀티 차트의 다른 칸: 칸마다 따로 저장하고 모양 설정만 첫 칸을 따른다
    const own = store.get(PREFS_KEY, null);
    s = Object.assign({}, own || Object.assign({}, main, { interval: SLOT_IV[SLOT], cmp: [] }));
    for (const k of LOOK_KEYS) if (k in main) s[k] = main[k];
    s.alerts = []; delete s.layout;
  }
  const p = JSON.parse(JSON.stringify(DEFAULTS));
  Object.assign(p, s);
  if (!s.scale && s.log) p.scale = 'log'; // 예전 로그 스케일 설정
  delete p.log;
  if (!Array.isArray(s.inds)) { // 예전 버전 설정 옮기기
    const o = s.ind;
    if (o && typeof o === 'object') {
      const a = [];
      if (o.vol) a.push(mk('vol'));
      if (o.ma) a.push(...DEFAULT_INDS().filter(i => i.type === 'ma'));
      if (o.ema) a.push(mk('ma', { kind: 'EMA', len: 12 }, { v: '#ff9800' }), mk('ma', { kind: 'EMA', len: 26 }, { v: '#00bcd4' }));
      if (o.bb) a.push(mk('bb'));
      if (o.rsi) a.push(mk('rsi'));
      if (o.macd) a.push(mk('macd'));
      p.inds = a;
    } else p.inds = DEFAULT_INDS();
  }
  delete p.ind;
  p.inds = p.inds.filter(i => i && TYPES[i.type]).map(sanitizeInst).slice(0, 60);
  if (!p.paneH || typeof p.paneH !== 'object') p.paneH = {};
  if (!Array.isArray(p.panes)) p.panes = p.inds.filter(i => i.pane !== 'main').map(i => i.pane);
  for (const i of p.inds) { if (i.h && i.pane !== 'main' && !p.paneH[i.pane]) p.paneH[i.pane] = Math.min(600, Math.max(60, i.h)); delete i.h; }
  if (!(s.v >= 2) && (s.inds || s.ind)) { // 2단계 업데이트: 요청받은 지표를 지금 쓰는 차트에도 추가
    if (!p.inds.some(i => i.type === 'bakkta')) p.inds.push(mk('bakkta'));
    if (!p.inds.some(i => i.type === 'stoch3')) p.inds.push(mk('stoch3'));
  }
  p.v = 3;
  if (!parseIv(p.interval)) p.interval = '1m';
  p.interval = parseIv(p.interval).id;
  p.customIv = (Array.isArray(p.customIv) ? p.customIv : []).map(parseIv).filter(sp => sp && !sp.native).map(sp => sp.id).filter((v, i, a) => a.indexOf(v) === i);
  p.favIv = (Array.isArray(p.favIv) ? p.favIv : DEFAULT_FAV).map(parseIv).filter(Boolean).map(sp => sp.id).filter((v, i, a) => a.indexOf(v) === i);
  if (!TYPES_IDS.includes(p.type)) p.type = 'candle';
  // 3단계 업데이트: 종목을 '거래소:시장:기호'로 저장 (예전 'BTCUSDT'는 바이낸스 현물)
  if (!SID_RE.test(p.sym || '')) p.sym = 'binance:spot:' + (/^[A-Z0-9]{2,30}$/.test(s.symbol || '') ? s.symbol : 'BTCUSDT');
  delete p.symbol;
  if (!Array.isArray(p.watch) || !p.watch.length) p.watch = DEFAULTS.watch.slice();
  p.watch = p.watch.map(w => SID_RE.test(w) ? w : 'binance:spot:' + w).filter((w, i, a) => SID_RE.test(w) && a.indexOf(w) === i);
  if (!(s.v >= 3) && (s.inds || s.ind)) for (const w of EXTRA_WATCH) if (!p.watch.includes(w)) p.watch.push(w);
  if (!['spot', 'perp'].includes(p.searchMk)) p.searchMk = 'spot';
  if (p.theme !== 'light') p.theme = 'dark';
  if (!['book', 'sig', 'calc'].includes(p.tab)) p.tab = 'trades';
  if (!p.toolPick || typeof p.toolPick !== 'object') p.toolPick = {};
  if (!['n', 'log', 'pct', 'idx'].includes(p.scale)) p.scale = 'n';
  p.cmp = (Array.isArray(p.cmp) ? p.cmp : []).filter((x, i, a) => SID_RE.test(x) && a.indexOf(x) === i).slice(0, 3);
  const fin = Number.isFinite, str = v => typeof v === 'string';
  p.alerts = (Array.isArray(p.alerts) ? p.alerts : []).filter(a => a && str(a.id) && SID_RE.test(a.sid || '') && ['up', 'down', 'cross'].includes(a.cond)
    && (a.kind === 'price' ? fin(a.price) : a.kind === 'ind' ? a.ind && str(a.ind.uid) && str(a.ind.k) && str(a.iv) && (a.tk ? str(a.tk) : fin(a.tv)) : a.kind === 'draw' ? a.dw && str(a.dw.id) && str(a.dw.key) : false)).slice(0, 50);
  const cc = p.calc && typeof p.calc === 'object' ? p.calc : {};
  const pos = v => fin(v) && v >= 0 ? v : null;
  p.calc = { rate: fin(cc.rate) && cc.rate > 0 ? cc.rate : null, usdt: pos(cc.usdt), krw: pos(cc.krw), last: cc.last === 'krw' ? 'krw' : 'usdt' };
  if (!p.layout || typeof p.layout !== 'object') p.layout = {};
  p.layout = { n: ['1', '2v', '2h', '3', '4'].includes(p.layout.n) ? p.layout.n : '1', syncSym: !!p.layout.syncSym, syncIv: !!p.layout.syncIv, syncX: p.layout.syncX !== false };
  for (const k of ['upC', 'dnC']) if (!/^#[0-9a-f]{6}$/i.test(p[k] || '')) p[k] = null;
  return p;
})();
const SYNC = { onChange: null, onSave: null }; // 자동 연동·멀티 차트가 설정 변경을 알아채는 곳
const savePrefs = () => { store.set(PREFS_KEY, prefs); if (SYNC.onChange) SYNC.onChange(); if (SYNC.onSave) SYNC.onSave(); };
normalizePanes();
TZ = tzOffsetOf(prefs.tz);
let spec = parseIv(prefs.interval);

// ───────── 상태 ─────────
const S = {
  raw: [], bars: [], tIndex: new Map(), ha: [], renderedN: 0, indRenderedN: 0, futBase: null, futMs: [],
  pricePrec: 2, tick: 0.01, qtyPrec: 5, base: 'BTC', quote: 'USDT', infoFor: null,
  token: 0, loading: true, older: false, noMore: false,
  lastTrade: null, lastPrice: null, ticker: null,
  hlines: [], selHline: -1, tool: 'cursor',
  trades: [], book: null,
};
const watchCache = {}, precCache = {};
let tradesDirty = true, bookDirty = true;

// ───────── 형식 ─────────
const nfs = {};
const nf = d => nfs[d] || (nfs[d] = new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmt = (v, d) => (v == null || !isFinite(v)) ? '—' : nf(d).format(v);
const fp = v => fmt(v, S.pricePrec);
const autoPrec = p => (!p || !isFinite(p)) ? 2 : Math.max(2, Math.min(8, 4 - Math.floor(Math.log10(Math.abs(p)))));
const fpct = v => (v == null || !isFinite(v)) ? '—' : (v > 0 ? '+' : '') + fmt(v, 2) + '%';
const decOf = s => { const t = String(s).replace(/0+$/, ''); const i = t.indexOf('.'); return i < 0 ? 0 : t.length - i - 1; };
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fvol(v) {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return fmt(v / 1e9, 2) + 'B';
  if (a >= 1e6) return fmt(v / 1e6, 2) + 'M';
  if (a >= 1e3) return fmt(v / 1e3, 2) + 'K';
  return fmt(v, a >= 100 ? 2 : a >= 1 ? 3 : 4);
}
const QUOTES = ['FDUSD', 'USDT', 'USDC', 'TUSD', 'BUSD', 'USDP', 'AEUR', 'EURI', 'DAI', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY', 'BRL', 'JPY', 'ARS', 'MXN', 'PLN', 'RON', 'ZAR', 'UAH', 'IDR', 'COP', 'CZK', 'XRP', 'DOGE', 'TRX', 'SOL', 'PAX'].sort((a, b) => b.length - a.length);
const STABLE = new Set(['USDT', 'USDC', 'FDUSD', 'TUSD', 'BUSD', 'USDP', 'DAI']);
function splitSym(s) { for (const q of QUOTES) if (s.length > q.length && s.endsWith(q)) return [s.slice(0, -q.length), q]; return [s, '']; }
const HUES = { BTC: 33, ETH: 232, BNB: 45, SOL: 275, XRP: 205, DOGE: 48, ADA: 220, TRX: 355, LINK: 224, AVAX: 0 };
function hue(s) { if (HUES[s] != null) return HUES[s]; let h = 0; for (const c of s) h = (h * 31 + c.codePointAt(0)) >>> 0; return h % 360; }
const toTime = t => Math.floor(t / 1000) + TZ;
const parseK = a => ({ t: a[0], time: toTime(a[0]), open: +a[1], high: +a[2], low: +a[3], close: +a[4], volume: +a[5] });
function hexA(hex, a) { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex; const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function tickFmt(time, type) {
  const d = new Date(time * 1000);
  switch (type) {
    case 0: return String(d.getUTCFullYear());
    case 1: return (d.getUTCMonth() + 1) + '월';
    case 2: return String(d.getUTCDate());
    case 3: return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
    case 4: return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
  }
  return '';
}
function crossTime(t) {
  const d = new Date(t * 1000);
  const date = `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} (${'일월화수목금토'[d.getUTCDay()]})`;
  if (!spec.intraday) return date;
  const hm = pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  return spec.unit === 's' ? `${date} ${hm}:${pad(d.getUTCSeconds())}` : `${date} ${hm}`;
}

// ───────── 차트 ─────────
let C = {};
function readColors() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  C = { bg: g('--bg'), fg: g('--fg'), muted: g('--muted'), line: g('--line'), grid: g('--grid'), up: g('--up'), down: g('--down'), raise: g('--raise'),
    upVol: g('--up-vol'), downVol: g('--down-vol'), accent: g('--accent'), cross: g('--cross'), crossLabel: g('--cross-label'), wm: g('--watermark') };
}
function applyTheme() {
  const r = document.documentElement;
  r.dataset.theme = prefs.theme;
  for (const [k, v] of [['up', prefs.upC], ['down', prefs.dnC]]) { // 캔들 색을 바꿨으면 화면 전체의 상승·하락 색도 같이
    if (v) { r.style.setProperty('--' + k, v); r.style.setProperty(`--${k}-vol`, hexA(v, .45)); r.style.setProperty(`--${k}-soft`, hexA(v, .15)); }
    else for (const x of ['', '-vol', '-soft']) r.style.removeProperty('--' + k + x);
  }
  readColors();
}
function baseOptions() {
  return {
    autoSize: true,
    layout: { background: { type: 'solid', color: C.bg }, textColor: C.muted, fontSize: 11, fontFamily: '"IBM Plex Sans KR", -apple-system, "Segoe UI", "Malgun Gothic", sans-serif' },
    grid: { vertLines: { color: C.grid, visible: prefs.grid }, horzLines: { color: C.grid, visible: prefs.grid } },
    crosshair: {
      mode: prefs.cross === 'magnet' ? LC.CrosshairMode.Magnet : LC.CrosshairMode.Normal,
      vertLine: { color: C.cross, width: 1, style: LC.LineStyle.Dashed, labelBackgroundColor: C.crossLabel },
      horzLine: { color: C.cross, width: 1, style: LC.LineStyle.Dashed, labelBackgroundColor: C.crossLabel },
    },
    rightPriceScale: { borderColor: C.line, minimumWidth: 84, entireTextOnly: true },
    timeScale: { borderColor: C.line, rightOffset: 8, barSpacing: 7, minBarSpacing: 0.5, timeVisible: spec.intraday, secondsVisible: spec.unit === 's', tickMarkFormatter: tickFmt },
    localization: { locale: 'ko-KR', timeFormatter: crossTime },
    // 휴대폰: 차트 위에서 위아래로 쓸면 페이지가 스크롤되게 (좌우는 차트 이동)
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    // 가격 축 끌기는 직접 만든 것을 쓴다 (퍼센트 축·휴대폰에서도 되게)
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: false }, axisDoubleClickReset: { time: true, price: false } },
  };
}
let cur = null; // 지금 보는 종목 { sid, vk, V(거래소), native, title, ... }
const wmText = () => cur ? `${EX_TV[cur.ex]}:${cur.title} · ${spec.label}` : '';
const mainOptions = () => Object.assign(baseOptions(), { watermark: { visible: prefs.wmOn, text: wmText(), fontSize: 52, color: C.wm, horzAlign: 'center', vertAlign: 'center' } });
applyTheme();
const chart = LC.createChart($('#mainChart'), mainOptions());
const charts = [];
const RT = new Map(); // 지표 인스턴스 uid → 화면에 붙은 시리즈·데이터
let mainSeries = null;
let syncing = false, hoverChart = null, hoverIdx = null;
const priceFormat = () => ({ type: 'price', precision: S.pricePrec, minMove: S.tick });
