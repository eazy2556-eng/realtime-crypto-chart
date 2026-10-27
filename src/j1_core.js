const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const LC = window.LightweightCharts;
if (!LC) {
  $('#spinner').hidden = true;
  $('#overlayMsg').textContent = '차트 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 새로고침하세요.';
  return;
}

// ───────── 설정 ─────────
// 멀티 차트의 다른 칸은 같은 페이지를 ?embed=1&slot=칸번호 로 띄운다
const QS = new URLSearchParams(location.search), EMBED = QS.get('embed') === '1', SLOT = EMBED ? Math.max(1, Math.min(3, parseInt(QS.get('slot'), 10) || 1)) : 0;
const REST = ['https://api.binance.com', 'https://data-api.binance.vision'];
const WSS = ['wss://stream.binance.com:9443/stream', 'wss://stream.binance.com:443/stream', 'wss://data-stream.binance.vision/stream'];
let TZ = -new Date().getTimezoneOffset() * 60; // 차트에 쓰는 시간대(초). 설정에서 고른 시간대로 바뀐다 (기본: 내 기기 시간대)
const tzOffsetOf = v => v === 'utc' ? 0 : /^[+-]\d{1,2}(\.\d+)?$/.test(v || '') ? Math.round(parseFloat(v) * 3600) : -new Date().getTimezoneOffset() * 60;
const tzLabelOf = off => off === 0 ? 'UTC' : `UTC${off > 0 ? '+' : '-'}${Math.floor(Math.abs(off) / 3600)}${Math.abs(off) % 3600 ? ':' + String(Math.abs(off) % 3600 / 60).padStart(2, '0') : ''}`;
const zDate = ms => new Date(ms + TZ * 1000); // getUTC…로 읽으면 고른 시간대의 시각
const DAY = 864e5;

// ───────── 시간 단위 ─────────
// 바이낸스가 주는 단위(NATIVE)는 그대로 쓰고, 나머지(10분, 2일 등)는 더 작은 봉을 합쳐서 만든다.
const UNITS = { s: { ms: 1e3, label: '초' }, m: { ms: 6e4, label: '분' }, h: { ms: 36e5, label: '시간' }, d: { ms: DAY, label: '일' }, w: { ms: 7 * DAY, label: '주' }, M: { ms: null, label: '개월' } };
const UNIT_ORDER = ['s', 'm', 'h', 'd', 'w', 'M'];
// 메뉴에 보이는 기본 단위 목록. 거래소가 직접 주지 않는 단위는 더 작은 봉을 합쳐 만든다
const NATIVE = ['1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '2d', '3d', '1w', '1M', '3M'];
const DEFAULT_FAV = ['1s', '1m', '5m', '15m', '1h', '4h', '1d', '1w'];
const IV_LIMIT_MSG = '지원 범위를 넘었어요. 일은 365, 주는 52, 개월은 24까지, 초·분·시간은 작은 봉 500개 이내로 만들 수 있어요.';
let VNAT = ['1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'], VKEY = 'binance:spot'; // 지금 거래소가 직접 주는 단위
const ivCache = {};
function ivMsOf(id) { const m = /^(\d+)([smhdwM])$/.exec(id); return m && m[2] !== 'M' ? +m[1] * UNITS[m[2]].ms : null; }
function parseIv(id) {
  const ck = VKEY + '|' + id;
  if (ck in ivCache) return ivCache[ck];
  const m = /^(\d{1,4})([smhdwM])$/.exec(String(id));
  if (!m) return null;
  const n = +m[1], u = m[2];
  if (n < 1) return null;
  const sp = { id: n + u, n, unit: u, ms: u === 'M' ? null : n * UNITS[u].ms, label: n + UNITS[u].label, intraday: 'smh'.includes(u) };
  if (VNAT.includes(sp.id)) { sp.native = true; sp.base = sp.id; sp.k = 1; }
  else {
    sp.native = false;
    const need = b => VNAT.includes(b) ? b : null;
    if (u === 'M') { if (n > 24) return (ivCache[ck] = null); sp.base = need('1M'); sp.k = n; }
    else if (u === 'w') { if (n > 52) return (ivCache[ck] = null); sp.base = need('1w'); sp.k = n; }
    else if (u === 'd') { if (n > 365) return (ivCache[ck] = null); sp.base = need('1d'); sp.k = n; }
    else {
      const bases = VNAT.filter(b => /[smh]$/.test(b)).sort((a, b) => ivMsOf(b) - ivMsOf(a));
      sp.base = bases.find(b => sp.ms % ivMsOf(b) === 0) || null;
      if (sp.base) sp.k = sp.ms / ivMsOf(sp.base);
    }
    if (!sp.base || sp.k > 500) return (ivCache[ck] = null);
  }
  sp.noTradeNew = sp.native && sp.unit === 'd' && sp.n > 1; // 여러 날짜 봉은 거래소마다 시작일이 달라 체결로 새 봉을 만들지 않음
  return (ivCache[ck] = sp);
}
// 거래소가 바뀌면 단위 계산 기준도 바꾼다
function setVenueIntervals(V) { VNAT = V.iv; VKEY = V.key; }
const ivApproxMs = sp => sp.ms || sp.n * 30.4375 * DAY;
// 봉 시작 시각: 분·시간 단위는 UTC 하루 시작 기준, 일 단위는 1970-01-01 기준, 주는 월요일, 월은 달력 기준
function bucketStart(t, sp) {
  switch (sp.unit) {
    case 's': case 'm': case 'h': { const d0 = Math.floor(t / DAY) * DAY; return d0 + Math.floor((t - d0) / sp.ms) * sp.ms; }
    case 'd': return Math.floor(t / sp.ms) * sp.ms;
    case 'w': { const m0 = 4 * DAY; return m0 + Math.floor((t - m0) / sp.ms) * sp.ms; }
    default: { const d = new Date(t), idx = d.getUTCFullYear() * 12 + d.getUTCMonth(), b = Math.floor(idx / sp.n) * sp.n; return Date.UTC(Math.floor(b / 12), b % 12, 1); }
  }
}
function nextBucket(t, sp) {
  if (sp.unit === 'M') { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + sp.n, 1); }
  if (sp.intraday) { const nt = t + sp.ms, d1 = Math.floor(t / DAY) * DAY + DAY; return nt > d1 ? d1 : nt; }
  return t + sp.ms;
}
function canonIv(n, u) {
  if (u === 's' && n % 60 === 0) { n /= 60; u = 'm'; }
  if (u === 'm' && n % 60 === 0) { n /= 60; u = 'h'; }
  if (u === 'h' && n % 24 === 0) { n /= 24; u = 'd'; }
  if (u === 'd' && n % 7 === 0) { n /= 7; u = 'w'; }
  const sp = parseIv(n + u);
  if (sp) return { id: sp.id };
  const tooBig = (u === 'M' && n > 24) || (u === 'w' && n > 52) || (u === 'd' && n > 365);
  return { err: tooBig ? IV_LIMIT_MSG : `${n}${UNITS[u].label} 봉은 이 거래소 데이터로 만들 수 없어요. (예: 비트겟·바이낸스 선물에는 초 단위 봉이 없어요)` };
}
function parseUserIv(text) {
  const t = String(text).trim().replace(/\s+/g, '');
  const m = /^(\d{1,4})(초|s|S|분|m|시간|시|h|H|일|d|D|주|w|W|개월|달|M|mo)?$/.exec(t);
  if (!m) return { err: '숫자와 단위로 입력하세요. 예: 10, 45분, 4h, 2일, 3개월' };
  const n = +m[1];
  if (n < 1) return { err: '1 이상으로 입력하세요.' };
  const map = { '초': 's', s: 's', S: 's', '분': 'm', m: 'm', '시간': 'h', '시': 'h', h: 'h', H: 'h', '일': 'd', d: 'd', D: 'd', '주': 'w', w: 'w', W: 'w', '개월': 'M', '달': 'M', M: 'M', mo: 'M' };
  return canonIv(n, m[2] ? map[m[2]] : 'm');
}

// ───────── 계산 도구 ─────────
const isN = v => typeof v === 'number' && isFinite(v);
const NA = undefined;
function map1(a, f) { const n = a.length, o = new Array(n); for (let i = 0; i < n; i++) if (isN(a[i])) o[i] = f(a[i], i); return o; }
function zip2(a, b, f) { const n = a.length, o = new Array(n); for (let i = 0; i < n; i++) if (isN(a[i]) && isN(b[i])) o[i] = f(a[i], b[i], i); return o; }
function change(a, p = 1) { const n = a.length, o = new Array(n); for (let i = p; i < n; i++) if (isN(a[i]) && isN(a[i - p])) o[i] = a[i] - a[i - p]; return o; }
function sumN(a, p) {
  const n = a.length, o = new Array(n); let s = 0, c = 0;
  for (let i = 0; i < n; i++) {
    const v = a[i];
    if (!isN(v)) { s = 0; c = 0; continue; }
    s += v;
    if (++c > p) { s -= a[i - p]; c = p; }
    if (c === p) o[i] = s;
  }
  return o;
}
const sma = (a, p) => map1(sumN(a, p), v => v / p);
function emaK(a, p, k) {
  const n = a.length, o = new Array(n); let e, s = 0, c = 0;
  for (let i = 0; i < n; i++) {
    const v = a[i];
    if (!isN(v)) { if (e === undefined) { s = 0; c = 0; } continue; }
    if (e === undefined) { s += v; if (++c === p) { e = s / p; o[i] = e; } }
    else { e += k * (v - e); o[i] = e; }
  }
  return o;
}
const ema = (a, p) => emaK(a, p, 2 / (p + 1));
const rma = (a, p) => emaK(a, p, 1 / p);
function wma(a, p) {
  const n = a.length, o = new Array(n), den = p * (p + 1) / 2; let num = 0, sum = 0, c = 0;
  for (let i = 0; i < n; i++) {
    const v = a[i];
    if (!isN(v)) { num = sum = c = 0; continue; }
    if (c < p) { c++; num += c * v; sum += v; }
    else { num += p * v - sum; sum += v - a[i - p]; }
    if (c === p) o[i] = num / den;
  }
  return o;
}
function lsma(a, p) {
  if (p < 2) return a.slice();
  const n = a.length, o = new Array(n), sx = p * (p - 1) / 2, sxx = (p - 1) * p * (2 * p - 1) / 6, dd = p * sxx - sx * sx;
  let num = 0, sum = 0, c = 0;
  for (let i = 0; i < n; i++) {
    const v = a[i];
    if (!isN(v)) { num = sum = c = 0; continue; }
    if (c < p) { c++; num += c * v; sum += v; }
    else { num += p * v - sum; sum += v - a[i - p]; }
    if (c === p) { const sxy = num - sum, slope = (p * sxy - sx * sum) / dd, icpt = (sum - slope * sx) / p; o[i] = icpt + slope * (p - 1); }
  }
  return o;
}
const hma = (a, p) => wma(zip2(wma(a, Math.max(1, Math.floor(p / 2))), wma(a, p), (x, y) => 2 * x - y), Math.max(1, Math.round(Math.sqrt(p))));
const vwma = (a, v, p) => zip2(sumN(zip2(a, v, (x, y) => x * y), p), sumN(v, p), (x, y) => y === 0 ? NA : x / y);
const dema = (a, p) => { const e1 = ema(a, p); return zip2(e1, ema(e1, p), (x, y) => 2 * x - y); };
function tema(a, p) {
  const e1 = ema(a, p), e2 = ema(e1, p), e3 = ema(e2, p), o = new Array(a.length);
  for (let i = 0; i < a.length; i++) if (isN(e1[i]) && isN(e2[i]) && isN(e3[i])) o[i] = 3 * e1[i] - 3 * e2[i] + e3[i];
  return o;
}
function maOf(kind, a, p, vol) {
  switch (kind) {
    case 'EMA': return ema(a, p);
    case 'WMA': return wma(a, p);
    case 'HMA': return hma(a, p);
    case 'RMA': return rma(a, p);
    case 'VWMA': return vwma(a, vol, p);
    case 'DEMA': return dema(a, p);
    case 'TEMA': return tema(a, p);
    case 'LSMA': return lsma(a, p);
    default: return sma(a, p);
  }
}
function stdev(a, p) { // 모표준편차, 이동 창
  const n = a.length, o = new Array(n); let mean = 0, m2 = 0, c = 0;
  for (let i = 0; i < n; i++) {
    const v = a[i];
    if (!isN(v)) { mean = m2 = c = 0; continue; }
    if (c < p) { c++; const d = v - mean; mean += d / c; m2 += d * (v - mean); }
    else { const old = a[i - p], om = mean; mean += (v - old) / p; m2 += (v - old) * (v - mean + old - om); }
    if (c === p) o[i] = Math.sqrt(Math.max(0, m2 / p));
  }
  return o;
}
function extremeIdx(a, p, isMax) {
  const n = a.length, o = new Array(n), dq = new Int32Array(Math.max(1, n)); let h = 0, t = 0, start = 0;
  for (let i = 0; i < n; i++) {
    const v = a[i];
    if (!isN(v)) { h = t = 0; start = i + 1; continue; }
    while (t > h && (isMax ? a[dq[t - 1]] <= v : a[dq[t - 1]] >= v)) t--;
    dq[t++] = i;
    while (dq[h] <= i - p) h++;
    if (i - start + 1 >= p) o[i] = dq[h];
  }
  return o;
}
const extreme = (a, p, isMax) => extremeIdx(a, p, isMax).map(j => a[j]);
const cum = a => { const n = a.length, o = new Array(n); let s = 0; for (let i = 0; i < n; i++) { if (isN(a[i])) s += a[i]; o[i] = s; } return o; };
function rocOf(a, p) { const n = a.length, o = new Array(n); for (let i = p; i < n; i++) if (isN(a[i]) && isN(a[i - p]) && a[i - p] !== 0) o[i] = 100 * (a[i] - a[i - p]) / a[i - p]; return o; }
function rsiOf(a, p) {
  const ch = change(a, 1), up = rma(map1(ch, v => v > 0 ? v : 0), p), dn = rma(map1(ch, v => v < 0 ? -v : 0), p);
  return zip2(up, dn, (u, d) => d === 0 ? 100 : u === 0 ? 0 : 100 - 100 / (1 + u / d));
}
function stochRaw(c, h, l, p) {
  const hh = extreme(h, p, true), ll = extreme(l, p, false), n = c.length, o = new Array(n);
  for (let i = 0; i < n; i++) if (isN(hh[i]) && isN(ll[i]) && isN(c[i])) o[i] = hh[i] === ll[i] ? 50 : 100 * (c[i] - ll[i]) / (hh[i] - ll[i]);
  return o;
}
function swma(a) { const n = a.length, o = new Array(n); for (let i = 3; i < n; i++) if (isN(a[i]) && isN(a[i - 1]) && isN(a[i - 2]) && isN(a[i - 3])) o[i] = (a[i - 3] + 2 * a[i - 2] + 2 * a[i - 1] + a[i]) / 6; return o; }
const trueRange = x => x.memo('tr', () => {
  const h = x.src('high'), l = x.src('low'), c = x.src('close'), n = x.n, o = new Array(n);
  for (let i = 0; i < n; i++) o[i] = i === 0 ? h[i] - l[i] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
  return o;
});
const mfmOf = x => x.memo('mfm', () => {
  const h = x.src('high'), l = x.src('low'), c = x.src('close');
  return c.map((v, i) => h[i] === l[i] ? 0 : ((v - l[i]) - (h[i] - v)) / (h[i] - l[i]));
});
const adLine = x => x.memo('ad', () => { const m = mfmOf(x), v = x.src('volume'); return cum(m.map((a, i) => a * v[i])); });
function psar(h, l, c, start, inc, max) {
  const n = h.length, o = new Array(n);
  if (n < 2) return o;
  let res, mm, acc, below;
  for (let i = 1; i < n; i++) {
    let first = false;
    if (i === 1) {
      if (c[1] > c[0]) { below = true; mm = h[1]; res = l[0]; } else { below = false; mm = l[1]; res = h[0]; }
      first = true; acc = start;
    }
    res += acc * (mm - res);
    if (below) { if (res > l[i]) { first = true; below = false; res = Math.max(h[i], mm); mm = l[i]; acc = start; } }
    else if (res < h[i]) { first = true; below = true; res = Math.min(l[i], mm); mm = h[i]; acc = start; }
    if (!first) {
      if (below) { if (h[i] > mm) { mm = h[i]; acc = Math.min(acc + inc, max); } }
      else if (l[i] < mm) { mm = l[i]; acc = Math.min(acc + inc, max); }
    }
    if (below) { res = Math.min(res, l[i - 1]); if (i > 1) res = Math.min(res, l[i - 2]); }
    else { res = Math.max(res, h[i - 1]); if (i > 1) res = Math.max(res, h[i - 2]); }
    o[i] = res;
  }
  return o;
}
const histSign = key => (i, d) => { const a = d[key], h = a[i], p = a[i - 1]; if (h >= 0) return isN(p) && h < p ? '#b2dfdb' : '#26a69a'; return isN(p) && h > p ? '#ffcdd2' : '#ff5252'; };
const histRise = key => (i, d) => { const a = d[key]; return isN(a[i - 1]) && a[i] < a[i - 1] ? '#ef5350' : '#26a69a'; };
