
// ───────── 거래소 연결 (바이낸스 · 비트겟 · OKX, 현물 · USDT 무기한 선물) ─────────
// 종목 ID = '거래소:시장:거래소 기호'  예) binance:spot:BTCUSDT, bitget:perp:BTCUSDT, okx:perp:BTC-USDT-SWAP
// 모든 거래소의 데이터는 같은 모양으로 바꿔서 쓴다: 봉 {t,o,h,l,c,v}, 체결 {T,p,q,sell}, 시세 {c,o,h,l,v,q}, 호가 {bids,asks}
async function getJSON(urls) {
  let err;
  for (const u of [].concat(urls)) {
    try {
      const r = await fetch(u);
      const j = await r.json().catch(() => null);
      if (r.status === 400 || (j && j.code !== undefined && j.code !== '0' && j.code !== '00000' && j.code !== 0 && typeof j.code === 'string')) {
        const e = new Error(j && (j.msg === 'Invalid symbol.' ? '존재하지 않는 종목이에요' : j.msg) || '잘못된 요청'); e.fatal = true; throw e;
      }
      if (!r.ok || j == null) throw new Error('HTTP ' + r.status);
      return j;
    } catch (e) { if (e.fatal) throw e; err = e; }
  }
  throw err;
}
const num = v => +v;
const qs = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
const decs = v => decOf(String(v).includes('e') ? Number(v).toFixed(12) : v);
const EX_LABEL = { binance: '바이낸스', bitget: '비트겟', okx: 'OKX' };
const EX_TV = { binance: 'BINANCE', bitget: 'BITGET', okx: 'OKX' };
const MK_LABEL = { spot: '현물', perp: '무기한 선물' };
const BN_IV = ['1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];

// ── 바이낸스 ──
function binanceVenue(mk) {
  const spot = mk === 'spot';
  const rest = spot ? ['https://api.binance.com', 'https://data-api.binance.vision'] : ['https://fapi.binance.com'];
  const pre = spot ? '/api/v3' : '/fapi/v1';
  const url = (path, q) => rest.map(h => `${h}${pre}${path}${q ? '?' + qs(q) : ''}`);
  let infoAll = null; // 선물 거래소 정보는 종목 필터가 없어서 한 번 받아 둔다
  const allInfo = async () => infoAll || (infoAll = getJSON(url('/exchangeInfo')).catch(e => { infoAll = null; throw e; }));
  const toInfo = s => {
    const pf = s.filters.find(f => f.filterType === 'PRICE_FILTER'), lf = s.filters.find(f => f.filterType === 'LOT_SIZE');
    return { base: s.baseAsset, quote: s.quoteAsset, tick: +pf.tickSize, prec: decs(pf.tickSize), qtyPrec: lf ? decs(lf.stepSize) : 4, mult: 1 };
  };
  return {
    ex: 'binance', mk, iv: spot ? BN_IV : BN_IV.slice(1),
    async klines(native, iv, end) {
      const kl = await getJSON(url('/klines', { symbol: native, interval: iv, limit: 1000, endTime: end }));
      return { bars: kl.map(a => ({ t: a[0], o: +a[1], h: +a[2], l: +a[3], c: +a[4], v: +a[5] })), more: kl.length === 1000 };
    },
    async info(native) {
      if (spot) return toInfo((await getJSON(url('/exchangeInfo', { symbol: native }))).symbols[0]);
      const s = (await allInfo()).symbols.find(x => x.symbol === native);
      if (!s) { const e = new Error('존재하지 않는 종목이에요'); e.fatal = true; throw e; }
      return toInfo(s);
    },
    async ticker(native) { const t = await getJSON(url('/ticker/24hr', { symbol: native })); return { c: +t.lastPrice, o: +t.openPrice, h: +t.highPrice, l: +t.lowPrice, v: +t.volume, q: +t.quoteVolume }; },
    async tickers(natives) {
      let d;
      if (spot) d = await getJSON(url('/ticker/24hr', natives ? { type: 'MINI', symbols: JSON.stringify(natives) } : { type: 'MINI' }));
      else {
        const [all, info] = await Promise.all([getJSON(url('/ticker/24hr')), natives ? null : allInfo()]);
        const perp = info && new Set(info.symbols.filter(s => s.contractType === 'PERPETUAL' && s.status === 'TRADING').map(s => s.symbol));
        d = all.filter(x => natives ? natives.includes(x.symbol) : perp.has(x.symbol));
      }
      return d.map(x => ({ native: x.symbol, c: +x.lastPrice, o: +x.openPrice, qv: +x.quoteVolume }));
    },
    async precs(natives) {
      const d = spot ? await getJSON(url('/exchangeInfo', { symbols: JSON.stringify(natives) })) : await allInfo();
      const o = {};
      for (const s of d.symbols) if (natives.includes(s.symbol)) o[s.symbol] = toInfo(s).prec;
      return o;
    },
    async time() { return (await getJSON(url('/time'))).serverTime; },
    split: native => splitSym(native),
    disp: native => spot ? native : native + '.P',
    ws: {
      // 선물은 주소가 나뉘어 있다: 체결·캔들·시세는 /market, 호가는 /public (예전 /stream으로는 체결·캔들이 오지 않음)
      key: spot ? 'binance-spot' : kind => kind === 'book' ? 'binance-perp-public' : 'binance-perp-market',
      urls: spot ? ['wss://stream.binance.com:9443/stream', 'wss://stream.binance.com:443/stream', 'wss://data-stream.binance.vision/stream']
        : kind => [kind === 'book' ? 'wss://fstream.binance.com/public/stream' : 'wss://fstream.binance.com/market/stream'],
      topic(kind, native, iv) {
        const s = native.toLowerCase();
        return { trade: `${s}@aggTrade`, kline: `${s}@kline_${iv}`, ticker: `${s}@ticker`, mini: `${s}@miniTicker`, book: `${s}@depth20@100ms` }[kind];
      },
      sub: (args, on, id) => [JSON.stringify({ method: on ? 'SUBSCRIBE' : 'UNSUBSCRIBE', params: args, id })],
    },
  };
}
function parseBinance(m, vk) {
  if (!m.stream || !m.data) return [];
  const d = m.data, at = m.stream.indexOf('@'), native = m.stream.slice(0, at).toUpperCase(), kind = m.stream.slice(at + 1), base = { vk, native };
  if (kind === 'aggTrade') return [{ ...base, kind: 'trade', T: d.T, E: d.E, p: +d.p, q: +d.q, sell: d.m }];
  if (kind.startsWith('kline_')) { const k = d.k; return [{ ...base, kind: 'kline', iv: k.i, E: d.E, bar: { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v } }]; }
  if (kind === 'ticker') return [{ ...base, kind: 'ticker', c: +d.c, o: +d.o, h: +d.h, l: +d.l, v: +d.v, q: +d.q }];
  if (kind === 'miniTicker') return [{ ...base, kind: 'mini', c: +d.c, o: +d.o }];
  if (kind.startsWith('depth')) return [{ ...base, kind: 'book', bids: (d.bids || d.b).map(([p, q]) => [+p, +q]), asks: (d.asks || d.a).map(([p, q]) => [+p, +q]) }];
  return [];
}

// ── 비트겟 (v2) ──
const BG_SPOT_IV = { '1m': '1min', '3m': '3min', '5m': '5min', '15m': '15min', '30m': '30min', '1h': '1h', '4h': '4h', '6h': '6Hutc', '12h': '12Hutc', '1d': '1Dutc', '3d': '3Dutc', '1w': '1Wutc', '1M': '1Mutc' };
const BG_MIX_IV = { '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H', '6h': '6Hutc', '12h': '12Hutc', '1d': '1Dutc', '3d': '3Dutc', '1w': '1Wutc', '1M': '1Mutc' };
function bitgetVenue(mk) {
  const spot = mk === 'spot', H = 'https://api.bitget.com', PT = 'USDT-FUTURES', G = spot ? BG_SPOT_IV : BG_MIX_IV;
  const mkt = spot ? '/api/v2/spot/market' : '/api/v2/mix/market';
  const extra = spot ? {} : { productType: PT };
  const rows = d => d.map(a => ({ t: +a[0], o: +a[1], h: +a[2], l: +a[3], c: +a[4], v: +a[5] }));
  const toInfo = s => spot
    ? { base: s.baseCoin, quote: s.quoteCoin, tick: Math.pow(10, -s.pricePrecision), prec: +s.pricePrecision, qtyPrec: +s.quantityPrecision, mult: 1 }
    : { base: s.baseCoin, quote: s.quoteCoin, tick: +s.priceEndStep * Math.pow(10, -s.pricePlace), prec: +s.pricePlace, qtyPrec: +s.volumePlace, mult: 1 };
  const tk = x => ({ c: +x.lastPr, o: +(spot ? x.open : x.open24h), h: +x.high24h, l: +x.low24h, v: +x.baseVolume, q: +x.quoteVolume });
  return {
    ex: 'bitget', mk, iv: Object.keys(G),
    async klines(native, iv, end) {
      const q = { symbol: native, granularity: G[iv], ...extra };
      if (!end) return { bars: rows((await getJSON(`${H}${mkt}/candles?${qs({ ...q, limit: 1000 })}`)).data), more: true };
      // 최근 구간은 한 번에 1000개, 그보다 오래된 구간은 200개씩
      const a = (await getJSON(`${H}${mkt}/candles?${qs({ ...q, limit: 1000, endTime: end })}`)).data;
      if (a.length) return { bars: rows(a), more: true };
      const b = (await getJSON(`${H}${mkt}/history-candles?${qs({ ...q, limit: 200, endTime: end })}`)).data;
      return { bars: rows(b), more: b.length === 200 };
    },
    async info(native) {
      const d = (await getJSON(spot ? `${H}/api/v2/spot/public/symbols?symbol=${native}` : `${H}/api/v2/mix/market/contracts?${qs({ productType: PT, symbol: native })}`)).data;
      if (!d || !d.length) { const e = new Error('존재하지 않는 종목이에요'); e.fatal = true; throw e; }
      return toInfo(d[0]);
    },
    async ticker(native) { const d = (await getJSON(spot ? `${H}${mkt}/tickers?symbol=${native}` : `${H}${mkt}/ticker?${qs({ productType: PT, symbol: native })}`)).data; return tk(d[0]); },
    async tickers(natives) {
      const d = (await getJSON(spot ? `${H}${mkt}/tickers` : `${H}${mkt}/tickers?productType=${PT}`)).data;
      return d.filter(x => !natives || natives.includes(x.symbol)).map(x => ({ native: x.symbol, c: +x.lastPr, o: +(spot ? x.open : x.open24h), qv: +x.quoteVolume }));
    },
    async precs(natives) {
      const d = (await getJSON(spot ? `${H}/api/v2/spot/public/symbols` : `${H}/api/v2/mix/market/contracts?productType=${PT}`)).data, o = {};
      for (const s of d) if (natives.includes(s.symbol)) o[s.symbol] = toInfo(s).prec;
      return o;
    },
    async time() { return +(await getJSON(`${H}/api/v2/public/time`)).data.serverTime; },
    split: native => splitSym(native),
    disp: native => spot ? native : native + '.P',
    ws: {
      key: 'bitget', urls: ['wss://ws.bitget.com/v2/ws/public'], ping: 25000,
      topic(kind, native, iv) {
        const ch = { trade: 'trade', ticker: 'ticker', mini: 'ticker', book: 'books15', kline: 'candle' + BG_MIX_IV[iv] }[kind];
        return { instType: spot ? 'SPOT' : PT, channel: ch, instId: native };
      },
      sub: (args, on) => [JSON.stringify({ op: on ? 'subscribe' : 'unsubscribe', args })],
    },
  };
}
const BG_IV_BACK = Object.fromEntries(Object.entries(BG_MIX_IV).map(([k, v]) => [v, k]));
function parseBitget(m) {
  if (!m.arg || !m.data) return [];
  const a = m.arg, vk = 'bitget:' + (a.instType === 'SPOT' ? 'spot' : 'perp'), base = { vk, native: a.instId };
  if (a.channel === 'trade') { // 첫 메시지(snapshot)는 지난 체결 묶음이라 체결 목록에만 넣는다
    const snap = m.action === 'snapshot';
    return m.data.slice().reverse().map(x => ({ ...base, kind: 'trade', T: +x.ts, p: +x.price, q: +x.size, sell: x.side === 'sell', snap }));
  }
  if (a.channel === 'ticker') { const x = m.data[0]; return [{ ...base, kind: 'ticker', c: +x.lastPr, o: +x.open24h, h: +x.high24h, l: +x.low24h, v: +x.baseVolume, q: +x.quoteVolume }]; }
  if (a.channel.startsWith('books')) { const x = m.data[0]; return [{ ...base, kind: 'book', bids: x.bids.map(([p, q]) => [+p, +q]), asks: x.asks.map(([p, q]) => [+p, +q]) }]; }
  if (a.channel.startsWith('candle')) {
    const iv = BG_IV_BACK[a.channel.slice(6)], list = m.action === 'snapshot' ? m.data.slice(-1) : m.data;
    return list.map(r => ({ ...base, kind: 'kline', iv, bar: { t: +r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] } }));
  }
  return [];
}

// ── OKX (v5) ──
const OKX_IV = { '1s': '1s', '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H', '2h': '2H', '4h': '4H', '6h': '6Hutc', '12h': '12Hutc', '1d': '1Dutc', '2d': '2Dutc', '3d': '3Dutc', '1w': '1Wutc', '1M': '1Mutc', '3M': '3Mutc' };
const OKX_IV_BACK = Object.fromEntries(Object.entries(OKX_IV).map(([k, v]) => [v, k]));
const OKX_CT = {}; // 선물 계약 1개 = 몇 개의 코인인지 (체결·호가 수량을 코인 단위로 바꿀 때 씀)
function okxVenue(mk) {
  const spot = mk === 'spot', H = 'https://www.okx.com', TYPE = spot ? 'SPOT' : 'SWAP';
  const rows = d => d.slice().reverse().map(a => ({ t: +a[0], o: +a[1], h: +a[2], l: +a[3], c: +a[4], v: +(spot ? a[5] : a[6]) }));
  const tk = x => ({ c: +x.last, o: +x.open24h, h: +x.high24h, l: +x.low24h, v: +(spot ? x.vol24h : x.volCcy24h), q: spot ? +x.volCcy24h : +x.volCcy24h * +x.last });
  const toInfo = s => {
    const mult = spot ? 1 : +s.ctVal;
    if (!spot) OKX_CT[s.instId] = mult;
    return { base: spot ? s.baseCcy : s.ctValCcy, quote: spot ? s.quoteCcy : s.settleCcy, tick: +s.tickSz, prec: decs(s.tickSz), qtyPrec: spot ? decs(s.lotSz) : decs(s.lotSz) + decs(s.ctVal), mult };
  };
  return {
    ex: 'okx', mk, iv: spot ? Object.keys(OKX_IV) : Object.keys(OKX_IV),
    async klines(native, iv, end) {
      const q = { instId: native, bar: OKX_IV[iv], limit: 300 };
      const d = end ? (await getJSON(`${H}/api/v5/market/history-candles?${qs({ ...q, after: end + 1 })}`)).data : (await getJSON(`${H}/api/v5/market/candles?${qs(q)}`)).data;
      return { bars: rows(d), more: d.length > 0 };
    },
    async info(native) {
      const d = (await getJSON(`${H}/api/v5/public/instruments?${qs({ instType: TYPE, instId: native })}`)).data;
      if (!d || !d.length) { const e = new Error('존재하지 않는 종목이에요'); e.fatal = true; throw e; }
      return toInfo(d[0]);
    },
    async ticker(native) { return tk((await getJSON(`${H}/api/v5/market/ticker?instId=${native}`)).data[0]); },
    async tickers(natives) {
      const d = (await getJSON(`${H}/api/v5/market/tickers?instType=${TYPE}`)).data;
      return d.filter(x => natives ? natives.includes(x.instId) : (spot || x.instId.endsWith('-USDT-SWAP')))
        .map(x => ({ native: x.instId, c: +x.last, o: +x.open24h, qv: tk(x).q }));
    },
    async precs(natives) {
      const d = (await getJSON(`${H}/api/v5/public/instruments?instType=${TYPE}`)).data, o = {};
      for (const s of d) if (natives.includes(s.instId)) o[s.instId] = toInfo(s).prec;
      return o;
    },
    async time() { return +(await getJSON(`${H}/api/v5/public/time`)).data[0].ts; },
    split: native => { const p = native.split('-'); return [p[0], p[1] || '']; },
    disp: native => spot ? native.replace('-', '') : native.replace('-SWAP', '').replace('-', '') + '.P',
    ws: {
      key: kind => kind === 'kline' ? 'okx-business' : 'okx-public',
      urls: kind => [kind === 'kline' ? 'wss://ws.okx.com:8443/ws/v5/business' : 'wss://ws.okx.com:8443/ws/v5/public'], ping: 25000,
      topic(kind, native, iv) {
        return { channel: { trade: 'trades', ticker: 'tickers', mini: 'tickers', book: 'books', kline: 'candle' + OKX_IV[iv] }[kind], instId: native };
      },
      sub: (args, on) => [JSON.stringify({ op: on ? 'subscribe' : 'unsubscribe', args })],
    },
  };
}
// OKX 호가는 처음 400단계를 받고 그 뒤로 바뀐 단계만 온다 → 직접 장부를 유지
const OKX_BOOKS = {};
function parseOkx(m, conn) {
  if (!m.arg || !m.data) return [];
  const id = m.arg.instId, vk = id.endsWith('-SWAP') ? 'okx:perp' : 'okx:spot', base = { vk, native: id }, mult = OKX_CT[id] || 1, ch = m.arg.channel;
  if (ch === 'trades') return m.data.map(x => ({ ...base, kind: 'trade', T: +x.ts, p: +x.px, q: +x.sz * mult, sell: x.side === 'sell' }));
  if (ch === 'tickers') { const x = m.data[0], sp = vk === 'okx:spot'; return [{ ...base, kind: 'ticker', c: +x.last, o: +x.open24h, h: +x.high24h, l: +x.low24h, v: +(sp ? x.vol24h : x.volCcy24h), q: sp ? +x.volCcy24h : +x.volCcy24h * +x.last }]; }
  if (ch.startsWith('candle')) {
    const iv = OKX_IV_BACK[ch.slice(6)], sp = vk === 'okx:spot';
    return m.data.map(r => ({ ...base, kind: 'kline', iv, bar: { t: +r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +(sp ? r[5] : r[6]) } }));
  }
  if (ch === 'books') {
    const d = m.data[0];
    let B = OKX_BOOKS[id];
    if (m.action === 'snapshot' || !B) B = OKX_BOOKS[id] = { bids: new Map(), asks: new Map(), seq: null };
    else if (d.prevSeqId !== undefined && B.seq !== null && d.prevSeqId !== B.seq) { delete OKX_BOOKS[id]; conn.resubscribe({ channel: 'books', instId: id }); return []; }
    for (const side of ['bids', 'asks']) for (const [p, s] of d[side]) { if (+s === 0) B[side].delete(p); else B[side].set(p, +s); }
    B.seq = d.seqId;
    const top = (mp, desc) => [...mp].map(([p, s]) => [+p, s * mult]).sort((a, b) => desc ? b[0] - a[0] : a[0] - b[0]).slice(0, 25);
    return [{ ...base, kind: 'book', bids: top(B.bids, true), asks: top(B.asks, false) }];
  }
  return [];
}

const VENUES = {};
for (const mk of ['spot', 'perp']) {
  VENUES['binance:' + mk] = binanceVenue(mk);
  VENUES['bitget:' + mk] = bitgetVenue(mk);
  VENUES['okx:' + mk] = okxVenue(mk);
}
for (const [k, v] of Object.entries(VENUES)) { v.key = k; v.label = `${EX_LABEL[v.ex]} ${MK_LABEL[v.mk]}`; }
const PARSERS = { 'binance-spot': m => parseBinance(m, 'binance:spot'), 'binance-perp-market': m => parseBinance(m, 'binance:perp'), 'binance-perp-public': m => parseBinance(m, 'binance:perp'), bitget: parseBitget, 'okx-public': parseOkx, 'okx-business': parseOkx };
// 종목 ID 풀기
function sidInfo(sid) {
  const i = sid.indexOf(':'), j = sid.indexOf(':', i + 1), vk = sid.slice(0, j), V = VENUES[vk];
  return V ? { sid, vk, V, native: sid.slice(j + 1) } : null;
}
const sidOf = (vk, native) => vk + ':' + native;

// ── 실시간 연결: 주소마다 연결 하나, 구독 목록을 맞춰 준다 ──
class Conn {
  constructor(key, urls, V) {
    Object.assign(this, { key, urls, V, want: new Map(), live: new Map(), ws: null, url: 0, fails: 0, opened: false, id: 1, timer: null, lastFlush: 0, retryT: null, pingT: null, closed: false });
  }
  set(map) { this.want = map; this.queueFlush(); }
  queueFlush() {
    if (this.timer) return;
    const wait = Math.max(0, 500 - (Date.now() - this.lastFlush)); // 거래소별 초당 메시지 제한을 넘지 않게
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, wait);
  }
  flush() {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.lastFlush = Date.now();
    const add = [...this.want.keys()].filter(k => !this.live.has(k)).map(k => this.want.get(k));
    const del = [...this.live.keys()].filter(k => !this.want.has(k)).map(k => this.live.get(k));
    for (let i = 0; i < del.length; i += 50) for (const s of this.V.ws.sub(del.slice(i, i + 50), false, this.id++)) this.send(s);
    for (let i = 0; i < add.length; i += 50) for (const s of this.V.ws.sub(add.slice(i, i + 50), true, this.id++)) this.send(s);
    this.live = new Map(this.want);
  }
  resubscribe(arg) {
    for (const s of this.V.ws.sub([arg], false, this.id++)) this.send(s);
    setTimeout(() => { for (const s of this.V.ws.sub([arg], true, this.id++)) this.send(s); }, 300);
  }
  send(s) { try { this.ws.send(s); } catch {} }
  connect() {
    if (this.closed) return;
    clearTimeout(this.retryT);
    WSM.status(this, this.opened ? 'reconnecting' : 'connecting');
    let ws;
    try { ws = new WebSocket(this.urls[this.url]); } catch { this.fails++; return this.retry(); }
    this.ws = ws;
    let gotOpen = false;
    ws.onopen = () => {
      gotOpen = true; this.fails = 0; this.live = new Map(); this.lastFlush = 0;
      const again = this.opened; this.opened = true;
      this.flush(); WSM.status(this, 'live');
      clearInterval(this.pingT);
      if (this.V.ws.ping) this.pingT = setInterval(() => this.send('ping'), this.V.ws.ping);
      if (again) WSM.reopened(this);
    };
    ws.onmessage = e => {
      if (e.data === 'pong') return;
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.event === 'error' || m.error) { console.warn(this.key, m.msg || m.error); return; }
      let evs;
      try { evs = PARSERS[this.key](m, this); } catch (err) { console.warn(this.key, err); return; }
      for (const ev of evs) WSM.onEvent(ev);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null; clearInterval(this.pingT);
      if (!gotOpen) { this.fails++; if (this.fails % 2 === 0) this.url = (this.url + 1) % this.urls.length; }
      this.retry();
    };
    ws.onerror = () => {};
  }
  retry() {
    if (this.closed) return;
    WSM.status(this, this.opened ? 'reconnecting' : 'connecting');
    clearTimeout(this.retryT);
    this.retryT = setTimeout(() => this.connect(), Math.min(15000, 800 * Math.pow(1.7, this.fails)));
  }
  close() { this.closed = true; clearTimeout(this.retryT); clearTimeout(this.timer); clearInterval(this.pingT); if (this.ws) { const w = this.ws; this.ws = null; try { w.close(); } catch {} } }
  kick() { if (!this.ws || this.ws.readyState > 1) { this.fails = 0; this.connect(); } }
}
// topics: [{ sid, kind, iv? }] → 거래소 주소별로 묶어 구독
const WSM = {
  conns: new Map(), onEvent: () => {}, status: () => {}, reopened: () => {},
  set(topics) {
    const groups = new Map();
    for (const tp of topics) {
      const s = sidInfo(tp.sid);
      if (!s) continue;
      const w = s.V.ws, key = typeof w.key === 'function' ? w.key(tp.kind) : w.key;
      const arg = w.topic(tp.kind, s.native, tp.iv), argKey = typeof arg === 'string' ? arg : JSON.stringify(arg);
      if (!groups.has(key)) groups.set(key, { V: s.V, urls: typeof w.urls === 'function' ? w.urls(tp.kind) : w.urls, map: new Map() });
      groups.get(key).map.set(argKey, arg);
    }
    for (const [key, g] of groups) {
      let c = this.conns.get(key);
      if (!c) { c = new Conn(key, g.urls, g.V); this.conns.set(key, c); c.set(g.map); c.connect(); }
      else c.set(g.map);
    }
    for (const [key, c] of [...this.conns]) if (!groups.has(key)) { c.close(); this.conns.delete(key); }
  },
  kickAll() { for (const c of this.conns.values()) c.kick(); },
};
