
// ───────── 지표 정의 ─────────
// plots: 그릴 선/막대. shift는 앞(+)·뒤(-)로 미는 봉 수. prec: 'price' | 'price+' | 'vol' | 소수 자릿수
const SRC_OPTS = [['close', '종가'], ['open', '시가'], ['high', '고가'], ['low', '저가'], ['hl2', '(고가+저가)/2'], ['hlc3', '(고가+저가+종가)/3'], ['ohlc4', '(시+고+저+종)/4']];
const SRC_SHORT = { close: '종가', open: '시가', high: '고가', low: '저가', hl2: 'HL2', hlc3: 'HLC3', ohlc4: 'OHLC4' };
const MA_KINDS = [['SMA', '단순 이동평균'], ['EMA', '지수 이동평균'], ['WMA', '가중 이동평균'], ['HMA', '헐 이동평균'], ['RMA', '수정 이동평균 (SMMA)'], ['VWMA', '거래량 가중 이동평균'], ['DEMA', '이중 지수 이동평균'], ['TEMA', '삼중 지수 이동평균'], ['LSMA', '선형 회귀 (LSMA)']];
const MA_OPTS = MA_KINDS.map(([k, l]) => [k, `${k} · ${l}`]);
const pI = (k, label, def, min, max) => ({ t: 'int', k, label, def, min, max });
const pF = (k, label, def, min, max, step) => ({ t: 'num', k, label, def, min, max, step });
const pS = (k, label, def, opts) => ({ t: 'sel', k, label, def, opts });
const pB = (k, label, def) => ({ t: 'bool', k, label, def });
const pSrc = (def = 'close') => pS('src', '기준 가격', def, SRC_OPTS);
const pKind = (def = 'SMA') => pS('kind', '이동평균 종류', def, MA_OPTS);
const L = (k, label, color, x) => Object.assign({ k, label, color }, x);
const H = (k, label, color, x) => Object.assign({ k, label, color, type: 'hist' }, x);
const lv = (...a) => () => a;
// bakkta MA 원본 색·굵기 (Pine v4 color.black/aqua/yellow/purple/green/gray, gray는 투명도 50)
const BK_STYLE = [
  { len: 5, c: 'fg', w: 4 }, { len: 10, c: '#00bcd4', w: 2 }, { len: 20, c: '#e57373', w: 4 }, { len: 40, c: '#ffeb3b', w: 1 }, { len: 60, c: '#dba901', w: 4 },
  { len: 80, c: '#ffeb3b', w: 1 }, { len: 120, c: '#9c27b0', w: 2 }, { len: 240, c: '#4caf50', w: 2 }, { len: 480, c: '#787b86', w: 4, a: 0.5 }, { len: 960, c: '#787b86', w: 4, a: 0.5 },
];
const ST3 = [['#f23645', 5, 3, 3], ['#2962ff', 10, 5, 5], ['#089981', 20, 10, 10]];
const band3 = (m, d, mult) => ({ mid: m, up: zip2(m, d, (a, b) => a + mult * b), lo: zip2(m, d, (a, b) => a - mult * b) });
const chan = (mid, up) => [L('mid', '중심', mid), L('up', '상단', up), L('lo', '하단', up)];
const chanFill = a => () => [{ a: 'up', b: 'lo', color: 'up', alpha: a }];
const barMs = () => ivApproxMs(spec);
const anchorKey = (t, a) => { if (a === 'D') return Math.floor(t / DAY); if (a === 'W') return Math.floor((t - 4 * DAY) / (7 * DAY)); const d = new Date(t); return a === 'M' ? d.getUTCFullYear() * 12 + d.getUTCMonth() : d.getUTCFullYear(); };

const TYPES = {
  // ── 차트 위 ──
  vol: { name: '거래량', en: 'Volume', cat: 'vol', under: true, ownScale: true,
    params: [pI('maLen', '이동평균 기간 (0이면 끔)', 0, 0, 500)],
    short: () => '거래량',
    plots: p => [H('v', '거래량', '#26a69a', { prec: 'vol', nocolor: true, colorAt: i => S.bars[i].close >= S.bars[i].open ? C.upVol : C.downVol, textAt: i => S.bars[i].close >= S.bars[i].open ? C.up : C.down })]
      .concat(p.maLen ? [L('ma', 'MA', '#2962ff', { prec: 'vol' })] : []),
    calc: (x, p) => ({ v: x.src('volume'), ma: p.maLen ? sma(x.src('volume'), p.maLen) : NA }) },
  ma: { name: '이동평균선', en: 'Moving Average', cat: 'ma',
    params: [pKind('SMA'), pI('len', '기간', 20, 1, 2000), pSrc(), pI('offset', '오프셋 (봉)', 0, -500, 500)],
    short: p => `${p.kind} ${p.len}${p.src !== 'close' ? ' ' + SRC_SHORT[p.src] : ''}${p.offset ? ` (${p.offset > 0 ? '+' : ''}${p.offset})` : ''}`,
    plots: p => [L('v', p.kind, '#f0b90b', { shift: p.offset })],
    calc: (x, p) => ({ v: maOf(p.kind, x.src(p.src), p.len, x.src('volume')) }) },
  // [bakkta] Theory : the wave & energy, MA — 원본 Pine 스크립트(v4)를 옮김.
  // SMA 10개 + 앞 4봉 예측점(현재가가 그대로라고 가정한 flat 방식) + 정배열(초록)·역배열(빨강) 배경
  bakkta: { name: 'bakkta MA (파동과 에너지)', en: 'bakkta Theory wave energy MA 정배열 역배열 예측', cat: 'ma',
    params: BK_STYLE.map((s, i) => pI('l' + i, `${i + 1}MA 기간`, s.len, 1, 3000))
      .concat([pB('fc', '예측점 표시 (앞 4봉)', true), pB('bg', '정배열·역배열 배경', true), pI('bgOp', '배경 진하기 (%)', 50, 5, 100)]),
    short: () => 'bakkta MA',
    plots: p => BK_STYLE.map((s, i) => L('m' + i, `${i + 1}MA(${p['l' + i]})`, s.c === 'fg' ? C.fg : s.c, { width: s.w, alpha: s.a }))
      .concat(p.fc ? BK_STYLE.map((s, i) => L('f' + i, `${i + 1}MA 예측`, s.c, { type: 'dots', ext: 4, radius: 3, legend: false, nocolor: true, colorFrom: 'm' + i, alpha: s.a })) : []),
    bgFill: p => p.bg ? { key: 'bg', up: '#4caf50', down: '#ff5252', alpha: p.bgOp / 100, futAlpha: p.bgOp / 100 * 0.6 } : null,
    calc: (x, p) => {
      const c = x.src('close'), n = x.n, Ls = BK_STYLE.map((_, i) => p['l' + i]), o = {};
      const P = new Float64Array(n + 1);
      for (let i = 0; i < n; i++) P[i + 1] = P[i] + c[i];
      const ms = Ls.map(len => { const a = new Array(n); for (let i = len - 1; i < n; i++) a[i] = (P[i + 1] - P[i + 1 - len]) / len; return a; });
      // maNforecastK = (sma(src, len-K) * (len-K) + K × 현재가) / len
      const fc = Ls.map(len => {
        const a = new Array(n + 4);
        if (n) for (let f = 1; f <= 4; f++) { const m = len - f; if (m >= 0 && m <= n) a[n - 1 + f] = (P[n] - P[n - m] + f * c[n - 1]) / len; }
        return a;
      });
      ms.forEach((a, i) => { o['m' + i] = a; });
      if (p.fc) fc.forEach((a, i) => { o['f' + i] = a; });
      if (p.bg) {
        const order = get => {
          let up = true, dn = true;
          for (let k = 0; k < 9; k++) { const a = get(k), b = get(k + 1); if (!isN(a) || !isN(b)) return 0; if (!(a > b)) up = false; if (!(a < b)) dn = false; }
          return up ? 1 : dn ? -1 : 0;
        };
        const bg = new Array(n + 4);
        for (let i = 0; i < n; i++) bg[i] = order(k => ms[k][i]);
        if (n) for (let f = 1; f <= 4; f++) bg[n - 1 + f] = order(k => fc[k][n - 1 + f]);
        o.bg = bg;
      }
      return o;
    } },
  bb: { name: '볼린저 밴드', en: 'Bollinger Bands BB', cat: 'volat',
    params: [pI('len', '기간', 20, 1, 1000), pF('mult', '표준편차 배수', 2, 0.1, 10, 0.1), pSrc()],
    short: p => `BB ${p.len} ${p.mult}`, plots: () => chan('#ff6d00', '#2962ff'), fills: chanFill(.07),
    calc: (x, p) => { const s = x.src(p.src); return band3(sma(s, p.len), stdev(s, p.len), p.mult); } },
  kc: { name: '켈트너 채널', en: 'Keltner Channels KC', cat: 'volat',
    params: [pI('len', '기간 (EMA)', 20, 1, 1000), pF('mult', '배수', 2, 0.1, 10, 0.1), pI('atrLen', 'ATR 기간', 10, 1, 500), pSrc()],
    short: p => `KC ${p.len} ${p.mult}`, plots: () => chan('#2962ff', '#2962ff'), fills: chanFill(.06),
    calc: (x, p) => band3(ema(x.src(p.src), p.len), rma(trueRange(x), p.atrLen), p.mult) },
  dc: { name: '돈치안 채널', en: 'Donchian Channels DC', cat: 'volat',
    params: [pI('len', '기간', 20, 1, 1000)], short: p => `DC ${p.len}`, plots: () => chan('#ff6d00', '#2962ff'), fills: chanFill(.06),
    calc: (x, p) => { const up = extreme(x.src('high'), p.len, true), lo = extreme(x.src('low'), p.len, false); return { up, lo, mid: zip2(up, lo, (a, b) => (a + b) / 2) }; } },
  env: { name: '엔벨로프', en: 'Envelope', cat: 'volat',
    params: [pI('len', '기간', 20, 1, 1000), pF('pct', '폭 (%)', 2, 0.1, 50, 0.1), pKind('SMA'), pSrc()],
    short: p => `Env ${p.len} ${p.pct}%`, plots: () => chan('#ff6d00', '#2962ff'), fills: chanFill(.06),
    calc: (x, p) => { const m = maOf(p.kind, x.src(p.src), p.len, x.src('volume')); return { mid: m, up: map1(m, v => v * (1 + p.pct / 100)), lo: map1(m, v => v * (1 - p.pct / 100)) }; } },
  ichimoku: { name: '일목균형표', en: 'Ichimoku Cloud', cat: 'trend',
    params: [pI('conv', '전환선 기간', 9, 1, 200), pI('base', '기준선 기간', 26, 1, 200), pI('spanB', '선행스팬2 기간', 52, 1, 400), pI('disp', '선행·후행 이동', 26, 1, 200)],
    short: p => `일목 ${p.conv} ${p.base} ${p.spanB} ${p.disp}`,
    plots: p => [L('tenkan', '전환선', '#2962ff'), L('kijun', '기준선', '#e53935'), L('chikou', '후행스팬', '#43a047', { shift: -(p.disp - 1) }),
      L('spanA', '선행스팬1', '#66bb6a', { shift: p.disp - 1 }), L('spanB', '선행스팬2', '#ef5350', { shift: p.disp - 1 })],
    fills: p => [{ a: 'spanA', b: 'spanB', color: 'spanA', down: 'spanB', alpha: .13, shift: p.disp - 1 }],
    calc: (x, p) => {
      const h = x.src('high'), l = x.src('low'), mid = n => zip2(extreme(h, n, true), extreme(l, n, false), (a, b) => (a + b) / 2);
      const tenkan = mid(p.conv), kijun = mid(p.base);
      return { tenkan, kijun, chikou: x.src('close'), spanA: zip2(tenkan, kijun, (a, b) => (a + b) / 2), spanB: mid(p.spanB) };
    } },
  sar: { name: '파라볼릭 SAR', en: 'Parabolic SAR', cat: 'trend',
    params: [pF('start', '시작', 0.02, 0.001, 1, 0.001), pF('inc', '증가', 0.02, 0.001, 1, 0.001), pF('max', '최대', 0.2, 0.01, 1, 0.01)],
    short: p => `SAR ${p.start} ${p.inc} ${p.max}`, plots: () => [L('v', 'SAR', '#2962ff', { type: 'dots' })],
    calc: (x, p) => ({ v: psar(x.src('high'), x.src('low'), x.src('close'), p.start, p.inc, p.max) }) },
  st: { name: '슈퍼트렌드', en: 'SuperTrend', cat: 'trend', w: 2,
    params: [pI('atrLen', 'ATR 기간', 10, 1, 500), pF('factor', '배수', 3, 0.1, 20, 0.1)],
    short: p => `슈퍼트렌드 ${p.atrLen} ${p.factor}`, plots: () => [L('up', '상승', '#089981'), L('dn', '하락', '#f23645')],
    calc: (x, p) => {
      const n = x.n, c = x.src('close'), hl = x.src('hl2'), a = rma(trueRange(x), p.atrLen), U = new Array(n), D = new Array(n);
      let up1, dn1, tr = 1;
      for (let i = 0; i < n; i++) {
        if (!isN(a[i])) continue;
        let up = hl[i] - p.factor * a[i], dn = hl[i] + p.factor * a[i];
        if (up1 !== undefined) {
          if (c[i - 1] > up1) up = Math.max(up, up1);
          if (c[i - 1] < dn1) dn = Math.min(dn, dn1);
          if (tr === -1 && c[i] > dn1) tr = 1; else if (tr === 1 && c[i] < up1) tr = -1;
        }
        if (tr === 1) U[i] = up; else D[i] = dn;
        up1 = up; dn1 = dn;
      }
      return { up: U, dn: D };
    } },
  vwap: { name: 'VWAP', en: 'VWAP Volume Weighted Average Price 거래량가중평균가', cat: 'vol',
    params: [pS('anchor', '기준 구간', 'D', [['D', '일 (UTC)'], ['W', '주'], ['M', '월']]), pSrc('hlc3'), pF('band', '표준편차 밴드 (0이면 끔)', 0, 0, 5, 0.5)],
    short: p => `VWAP ${p.anchor}`,
    plots: p => [L('v', 'VWAP', '#2962ff')].concat(p.band > 0 ? [L('up', '상단', '#43a047'), L('lo', '하단', '#43a047')] : []),
    fills: p => p.band > 0 ? [{ a: 'up', b: 'lo', color: 'up', alpha: .05 }] : [],
    calc: (x, p) => {
      const tp = x.src(p.src), v = x.src('volume'), n = x.n, o = new Array(n), up = new Array(n), lo = new Array(n);
      let key = null, sPV = 0, sV = 0, sPV2 = 0;
      for (let i = 0; i < n; i++) {
        const k = anchorKey(S.bars[i].t, p.anchor);
        if (k !== key) { key = k; sPV = sV = sPV2 = 0; }
        sPV += tp[i] * v[i]; sV += v[i]; sPV2 += tp[i] * tp[i] * v[i];
        if (sV > 0) { const w = sPV / sV; o[i] = w; if (p.band > 0) { const sd = Math.sqrt(Math.max(0, sPV2 / sV - w * w)); up[i] = w + p.band * sd; lo[i] = w - p.band * sd; } }
      }
      return { v: o, up, lo };
    } },
  alligator: { name: '윌리엄스 앨리게이터', en: 'Williams Alligator', cat: 'ma',
    params: [pI('jaw', '턱 기간', 13, 1, 200), pI('jawOff', '턱 이동', 8, 0, 100), pI('teeth', '이빨 기간', 8, 1, 200), pI('teethOff', '이빨 이동', 5, 0, 100), pI('lips', '입술 기간', 5, 1, 200), pI('lipsOff', '입술 이동', 3, 0, 100)],
    short: () => '앨리게이터',
    plots: p => [L('jaw', '턱', '#2962ff', { shift: p.jawOff }), L('teeth', '이빨', '#e91e63', { shift: p.teethOff }), L('lips', '입술', '#66bb6a', { shift: p.lipsOff })],
    calc: (x, p) => { const s = x.src('hl2'); return { jaw: rma(s, p.jaw), teeth: rma(s, p.teeth), lips: rma(s, p.lips) }; } },
  pivot: { name: '피봇 포인트', en: 'Pivot Points Standard', cat: 'trend', noScale: true,
    params: [pS('tf', '기준 기간', 'auto', [['auto', '자동'], ['D', '일'], ['W', '주'], ['M', '월'], ['Y', '년']])],
    short: p => `피봇 ${p.tf === 'auto' ? '자동' : p.tf}`,
    plots: () => [['p', 'P', '#ff9800'], ['r1', 'R1', '#ef5350'], ['s1', 'S1', '#26a69a'], ['r2', 'R2', '#ef5350'], ['s2', 'S2', '#26a69a'], ['r3', 'R3', '#ef5350'], ['s3', 'S3', '#26a69a']]
      .map(([k, l, c], i) => L(k, l, c, { type: 'step', legend: i < 3 })),
    calc: (x, p) => {
      const tf = p.tf !== 'auto' ? p.tf : spec.intraday ? 'D' : spec.unit === 'd' ? 'W' : spec.unit === 'w' ? 'M' : 'Y';
      const b = S.bars, n = b.length, o = {}; for (const k of ['p', 'r1', 's1', 'r2', 's2', 'r3', 's3']) o[k] = new Array(n);
      const m = htfMap(tf); // 직전 일·주·월·년의 고가·저가·종가 (따로 받아 둠)
      if (!m) return o;
      for (let i = 0; i < n; i++) {
        const prev = m.get(anchorKey(b[i].t, tf) - 1);
        if (prev) {
          const pp = (prev.h + prev.l + prev.c) / 3, r = prev.h - prev.l;
          o.p[i] = pp; o.r1[i] = 2 * pp - prev.l; o.s1[i] = 2 * pp - prev.h; o.r2[i] = pp + r; o.s2[i] = pp - r;
          o.r3[i] = prev.h + 2 * (pp - prev.l); o.s3[i] = prev.l - 2 * (prev.h - pp);
        }
      }
      return o;
    } },

  // ── 아래 창: 모멘텀·오실레이터 ──
  rsi: { name: 'RSI', en: 'Relative Strength Index 상대강도지수', cat: 'mom', pane: true, range: [0, 100], levels: lv(70, 30),
    params: [pI('len', '기간', 14, 1, 500), pSrc(), pI('maLen', '신호선 기간 (0이면 끔)', 0, 0, 500)],
    short: p => `RSI ${p.len}`, plots: p => [L('v', 'RSI', '#7e57c2')].concat(p.maLen ? [L('ma', 'MA', '#f0b90b')] : []),
    calc: (x, p) => { const r = rsiOf(x.src(p.src), p.len); return { v: r, ma: p.maLen ? sma(r, p.maLen) : NA }; } },
  macd: { name: 'MACD', en: 'MACD Moving Average Convergence Divergence', cat: 'mom', pane: true, prec: 'price+', levels: lv(0),
    params: [pI('fast', '단기', 12, 1, 500), pI('slow', '장기', 26, 1, 500), pI('sig', '신호', 9, 1, 500), pSrc()],
    short: p => `MACD ${p.fast} ${p.slow} ${p.sig}`,
    plots: () => [H('hist', '히스토그램', '#26a69a', { colorAt: histSign('hist'), nocolor: true }), L('macd', 'MACD', '#2962ff'), L('sig', '신호', '#ff6d00')],
    calc: (x, p) => { const s = x.src(p.src), m = zip2(ema(s, p.fast), ema(s, p.slow), (a, b) => a - b), g = ema(m, p.sig); return { macd: m, sig: g, hist: zip2(m, g, (a, b) => a - b) }; } },
  stoch: { name: '스토캐스틱', en: 'Stochastic Slow', cat: 'mom', pane: true, range: [0, 100], levels: lv(80, 20),
    params: [pI('k', '%K 기간', 14, 1, 500), pI('ks', '%K 평활', 3, 1, 100), pI('d', '%D 평활', 3, 1, 100)],
    short: p => `Stoch ${p.k} ${p.ks} ${p.d}`, plots: () => [L('k', '%K', '#2962ff'), L('d', '%D', '#ff6d00')],
    calc: (x, p) => { const k = sma(stochRaw(x.src('close'), x.src('high'), x.src('low'), p.k), p.ks); return { k, d: sma(k, p.d) }; } },
  // 세 개를 한 지표로 묶고, 기본은 창을 위·가운데·아래 3칸으로 나눠 칸마다 따로 그린다
  stoch3: { name: '스토캐스틱 3중 (5-3-3 · 10-5-5 · 20-10-10)', en: 'Stochastic triple slow 5-3-3 10-5-5 20-10-10 묶음', cat: 'mom', pane: true, range: [0, 100],
    params: [pS('view', '보는 방식', 'split', [['split', '3칸으로 나눠 보기'], ['overlay', '한 칸에 겹쳐 보기']])]
      .concat(ST3.flatMap(([, k, s, d], j) => [pI('k' + j, `${'①②③'[j]} %K 기간`, k, 1, 500), pI('s' + j, `${'①②③'[j]} %K 평활`, s, 1, 100), pI('d' + j, `${'①②③'[j]} %D 평활`, d, 1, 100)])),
    bands: p => p.view === 'split' ? 3 : 0,
    bandLevels: [80, 20],
    levels: p => p.view === 'split' ? [] : [80, 20],
    paneH: p => p.view === 'split' ? 270 : 140,
    short: p => p.view === 'split' ? 'Stoch 3중' : 'Stoch ' + [0, 1, 2].map(j => `${p['k' + j]}-${p['s' + j]}-${p['d' + j]}`).join(' · '),
    plots: p => ST3.flatMap(([c], j) => {
      const split = p.view === 'split', tag = `${p['k' + j]}-${p['s' + j]}-${p['d' + j]}`;
      return [L('k' + j, `%K ${tag}`, c, { band: split ? j : undefined, tag: split ? tag : undefined, width: split ? 2 : 1 }),
        L('d' + j, `%D ${tag}`, c, { dashed: true, band: split ? j : undefined })];
    }),
    calc: (x, p) => {
      const c = x.src('close'), h = x.src('high'), l = x.src('low'), o = {};
      for (let j = 0; j < 3; j++) { const k = sma(stochRaw(c, h, l, p['k' + j]), p['s' + j]); o['k' + j] = k; o['d' + j] = sma(k, p['d' + j]); }
      return o;
    } },
  stochrsi: { name: '스토캐스틱 RSI', en: 'Stochastic RSI', cat: 'mom', pane: true, range: [0, 100], levels: lv(80, 20),
    params: [pI('rsiLen', 'RSI 기간', 14, 1, 500), pI('stLen', '스토캐스틱 기간', 14, 1, 500), pI('k', '%K', 3, 1, 100), pI('d', '%D', 3, 1, 100), pSrc()],
    short: p => `StochRSI ${p.rsiLen} ${p.stLen} ${p.k} ${p.d}`, plots: () => [L('k', '%K', '#2962ff'), L('d', '%D', '#ff6d00')],
    calc: (x, p) => { const r = rsiOf(x.src(p.src), p.rsiLen), k = sma(stochRaw(r, r, r, p.stLen), p.k); return { k, d: sma(k, p.d) }; } },
  kdj: { name: 'KDJ', en: 'KDJ', cat: 'mom', pane: true, levels: lv(80, 20),
    params: [pI('len', '기간', 9, 1, 500), pI('m1', 'K 평활', 3, 1, 50), pI('m2', 'D 평활', 3, 1, 50)],
    short: p => `KDJ ${p.len} ${p.m1} ${p.m2}`, plots: () => [L('k', 'K', '#f0b90b'), L('d', 'D', '#eb40b5'), L('j', 'J', '#b385f8')],
    calc: (x, p) => {
      const rsv = stochRaw(x.src('close'), x.src('high'), x.src('low'), p.len), n = x.n, K = new Array(n), D = new Array(n), J = new Array(n);
      let k = 50, d = 50;
      for (let i = 0; i < n; i++) { if (!isN(rsv[i])) continue; k = ((p.m1 - 1) * k + rsv[i]) / p.m1; d = ((p.m2 - 1) * d + k) / p.m2; K[i] = k; D[i] = d; J[i] = 3 * k - 2 * d; }
      return { k: K, d: D, j: J };
    } },
  cci: { name: 'CCI', en: 'Commodity Channel Index', cat: 'mom', pane: true, levels: lv(100, 0, -100),
    params: [pI('len', '기간', 20, 1, 300), pSrc('hlc3')], short: p => `CCI ${p.len}`, plots: () => [L('v', 'CCI', '#2962ff')],
    calc: (x, p) => {
      const s = x.src(p.src), m = sma(s, p.len), n = x.n, o = new Array(n);
      for (let i = 0; i < n; i++) { if (!isN(m[i])) continue; let md = 0; for (let j = i - p.len + 1; j <= i; j++) md += Math.abs(s[j] - m[i]); md /= p.len; o[i] = md === 0 ? 0 : (s[i] - m[i]) / (0.015 * md); }
      return { v: o };
    } },
  willr: { name: '윌리엄스 %R', en: 'Williams %R', cat: 'mom', pane: true, range: [-100, 0], levels: lv(-20, -80),
    params: [pI('len', '기간', 14, 1, 500)], short: p => `%R ${p.len}`, plots: () => [L('v', '%R', '#7e57c2')],
    calc: (x, p) => { const c = x.src('close'), hh = extreme(x.src('high'), p.len, true), ll = extreme(x.src('low'), p.len, false); return { v: c.map((v, i) => isN(hh[i]) ? (hh[i] === ll[i] ? -50 : -100 * (hh[i] - v) / (hh[i] - ll[i])) : NA) }; } },
  mom: { name: '모멘텀', en: 'Momentum', cat: 'mom', pane: true, prec: 'price', levels: lv(0),
    params: [pI('len', '기간', 10, 1, 500), pSrc()], short: p => `Mom ${p.len}`, plots: () => [L('v', 'Mom', '#2962ff')],
    calc: (x, p) => ({ v: change(x.src(p.src), p.len) }) },
  roc: { name: '변화율 (ROC)', en: 'Rate of Change ROC', cat: 'mom', pane: true, levels: lv(0),
    params: [pI('len', '기간', 9, 1, 500), pSrc()], short: p => `ROC ${p.len}`, plots: () => [L('v', 'ROC', '#2962ff')],
    calc: (x, p) => ({ v: rocOf(x.src(p.src), p.len) }) },
  ao: { name: '어썸 오실레이터', en: 'Awesome Oscillator AO', cat: 'mom', pane: true, prec: 'price+', levels: lv(0),
    params: [pI('fast', '단기', 5, 1, 200), pI('slow', '장기', 34, 1, 500)], short: p => `AO ${p.fast} ${p.slow}`,
    plots: () => [H('v', 'AO', '#26a69a', { colorAt: histRise('v'), nocolor: true })],
    calc: (x, p) => { const s = x.src('hl2'); return { v: zip2(sma(s, p.fast), sma(s, p.slow), (a, b) => a - b) }; } },
  ac: { name: '가속 오실레이터', en: 'Accelerator Oscillator AC', cat: 'mom', pane: true, prec: 'price+', levels: lv(0),
    params: [pI('fast', '단기', 5, 1, 200), pI('slow', '장기', 34, 1, 500), pI('sig', '평활', 5, 1, 100)], short: () => 'AC',
    plots: () => [H('v', 'AC', '#26a69a', { colorAt: histRise('v'), nocolor: true })],
    calc: (x, p) => { const s = x.src('hl2'), ao = zip2(sma(s, p.fast), sma(s, p.slow), (a, b) => a - b); return { v: zip2(ao, sma(ao, p.sig), (a, b) => a - b) }; } },
  trix: { name: 'TRIX', en: 'TRIX Triple Exponential', cat: 'mom', pane: true, prec: 3, levels: lv(0),
    params: [pI('len', '기간', 18, 1, 500)], short: p => `TRIX ${p.len}`, plots: () => [L('v', 'TRIX', '#ef5350')],
    calc: (x, p) => { const t = ema(ema(ema(map1(x.src('close'), Math.log), p.len), p.len), p.len); return { v: map1(change(t, 1), v => v * 10000) }; } },
  uo: { name: '얼티밋 오실레이터', en: 'Ultimate Oscillator UO', cat: 'mom', pane: true, range: [0, 100], levels: lv(70, 30),
    params: [pI('f', '단기', 7, 1, 200), pI('m', '중기', 14, 1, 200), pI('s', '장기', 28, 1, 400)], short: p => `UO ${p.f} ${p.m} ${p.s}`,
    plots: () => [L('v', 'UO', '#e91e63')],
    calc: (x, p) => {
      const h = x.src('high'), l = x.src('low'), c = x.src('close'), n = x.n, bp = new Array(n), tr = new Array(n);
      for (let i = 1; i < n; i++) { const lo = Math.min(l[i], c[i - 1]); bp[i] = c[i] - lo; tr[i] = Math.max(h[i], c[i - 1]) - lo; }
      const avg = k => zip2(sumN(bp, k), sumN(tr, k), (a, b) => b === 0 ? 0 : a / b), a1 = avg(p.f), a2 = avg(p.m), a3 = avg(p.s), o = new Array(n);
      for (let i = 0; i < n; i++) if (isN(a1[i]) && isN(a2[i]) && isN(a3[i])) o[i] = 100 * (4 * a1[i] + 2 * a2[i] + a3[i]) / 7;
      return { v: o };
    } },
  cmo: { name: '챈드 모멘텀 (CMO)', en: 'Chande Momentum Oscillator CMO', cat: 'mom', pane: true, range: [-100, 100], levels: lv(50, -50),
    params: [pI('len', '기간', 9, 1, 500), pSrc()], short: p => `CMO ${p.len}`, plots: () => [L('v', 'CMO', '#2962ff')],
    calc: (x, p) => { const ch = change(x.src(p.src), 1), su = sumN(map1(ch, v => v > 0 ? v : 0), p.len), sd = sumN(map1(ch, v => v < 0 ? -v : 0), p.len); return { v: zip2(su, sd, (a, b) => a + b === 0 ? 0 : 100 * (a - b) / (a + b)) }; } },
  tsi: { name: 'TSI', en: 'True Strength Index', cat: 'mom', pane: true, levels: lv(0),
    params: [pI('long', '장기', 25, 1, 300), pI('short', '단기', 13, 1, 300), pI('sig', '신호', 13, 1, 300)], short: p => `TSI ${p.long} ${p.short} ${p.sig}`,
    plots: () => [L('v', 'TSI', '#2962ff'), L('sig', '신호', '#e91e63')],
    calc: (x, p) => { const pc = change(x.src('close'), 1), dbl = a => ema(ema(a, p.long), p.short), t = zip2(dbl(pc), dbl(map1(pc, Math.abs)), (a, b) => b === 0 ? 0 : 100 * a / b); return { v: t, sig: ema(t, p.sig) }; } },
  ppo: { name: 'PPO', en: 'Percentage Price Oscillator', cat: 'mom', pane: true, prec: 3, levels: lv(0),
    params: [pI('fast', '단기', 12, 1, 500), pI('slow', '장기', 26, 1, 500), pI('sig', '신호', 9, 1, 500)], short: p => `PPO ${p.fast} ${p.slow} ${p.sig}`,
    plots: () => [H('hist', '히스토그램', '#26a69a', { colorAt: histSign('hist'), nocolor: true }), L('v', 'PPO', '#2962ff'), L('sig', '신호', '#ff6d00')],
    calc: (x, p) => { const c = x.src('close'), v = zip2(ema(c, p.fast), ema(c, p.slow), (a, b) => 100 * (a - b) / b), g = ema(v, p.sig); return { v, sig: g, hist: zip2(v, g, (a, b) => a - b) }; } },
  fisher: { name: '피셔 변환', en: 'Fisher Transform', cat: 'mom', pane: true, prec: 3, levels: lv(1.5, 0, -1.5),
    params: [pI('len', '기간', 9, 1, 300)], short: p => `Fisher ${p.len}`, plots: () => [L('v', 'Fisher', '#2962ff'), L('t', '트리거', '#ff6d00')],
    calc: (x, p) => {
      const s = x.src('hl2'), hh = extreme(s, p.len, true), ll = extreme(s, p.len, false), n = x.n, F = new Array(n), T = new Array(n);
      const rnd = v => v > .99 ? .999 : v < -.99 ? -.999 : v; let val = 0, fish = 0;
      for (let i = 0; i < n; i++) { if (!isN(hh[i])) continue; val = rnd(.66 * ((s[i] - ll[i]) / Math.max(hh[i] - ll[i], .001) - .5) + .67 * val); T[i] = F[i - 1]; fish = .5 * Math.log((1 + val) / Math.max(1 - val, .001)) + .5 * fish; F[i] = fish; }
      return { v: F, t: T };
    } },
  rvi: { name: 'RVI', en: 'Relative Vigor Index', cat: 'mom', pane: true, prec: 3, levels: lv(0),
    params: [pI('len', '기간', 10, 1, 300)], short: p => `RVI ${p.len}`, plots: () => [L('v', 'RVI', '#26a69a'), L('sig', '신호', '#ef5350')],
    calc: (x, p) => {
      const o = x.src('open'), c = x.src('close'), h = x.src('high'), l = x.src('low');
      const r = zip2(sumN(swma(zip2(c, o, (a, b) => a - b)), p.len), sumN(swma(zip2(h, l, (a, b) => a - b)), p.len), (a, b) => b === 0 ? 0 : a / b);
      return { v: r, sig: swma(r) };
    } },
  coppock: { name: '코폭 곡선', en: 'Coppock Curve', cat: 'mom', pane: true, levels: lv(0),
    params: [pI('wl', 'WMA 기간', 10, 1, 300), pI('lr', '긴 ROC', 14, 1, 300), pI('sr', '짧은 ROC', 11, 1, 300)], short: p => `Coppock ${p.wl} ${p.lr} ${p.sr}`,
    plots: () => [L('v', 'Coppock', '#2962ff')], calc: (x, p) => { const c = x.src('close'); return { v: wma(zip2(rocOf(c, p.lr), rocOf(c, p.sr), (a, b) => a + b), p.wl) }; } },
  bop: { name: '세력 균형 (BOP)', en: 'Balance of Power BOP', cat: 'mom', pane: true, prec: 3, range: [-1, 1], levels: lv(0),
    params: [pI('len', '평활 기간 (1이면 없음)', 1, 1, 200)], short: p => `BOP${p.len > 1 ? ' ' + p.len : ''}`, plots: () => [L('v', 'BOP', '#ef5350')],
    calc: (x, p) => { const o = x.src('open'), h = x.src('high'), l = x.src('low'), raw = x.src('close').map((c, i) => h[i] === l[i] ? 0 : (c - o[i]) / (h[i] - l[i])); return { v: p.len > 1 ? sma(raw, p.len) : raw }; } },
  bbp: { name: '불 베어 파워', en: 'Bull Bear Power Elder Ray', cat: 'mom', pane: true, prec: 'price', levels: lv(0),
    params: [pI('len', '기간', 13, 1, 300)], short: p => `BBP ${p.len}`,
    plots: () => [H('v', 'BBP', '#26a69a', { colorAt: histSign('v'), nocolor: true })],
    calc: (x, p) => { const e = ema(x.src('close'), p.len), h = x.src('high'), l = x.src('low'); return { v: map1(e, (v, i) => (h[i] - v) + (l[i] - v)) }; } },
  disparity: { name: '이격도', en: 'Disparity Index', cat: 'mom', pane: true, levels: lv(100),
    params: [pI('len', '기간', 20, 1, 1000), pKind('SMA')], short: p => `이격도 ${p.len}`, plots: () => [L('v', '이격도', '#ff9800')],
    calc: (x, p) => { const c = x.src('close'); return { v: zip2(c, maOf(p.kind, c, p.len, x.src('volume')), (a, b) => 100 * a / b) }; } },
  psy: { name: '투자심리선', en: 'Psychological Line', cat: 'mom', pane: true, range: [0, 100], levels: lv(75, 25),
    params: [pI('len', '기간', 10, 1, 500)], short: p => `투자심리 ${p.len}`, plots: () => [L('v', '투자심리', '#ab47bc')],
    calc: (x, p) => { const ch = change(x.src('close'), 1); return { v: map1(sumN(map1(ch, v => v > 0 ? 1 : 0), p.len), v => 100 * v / p.len) }; } },

  // ── 아래 창: 추세 ──
  adx: { name: 'ADX / DMI', en: 'Average Directional Index DMI', cat: 'trend', pane: true, levels: lv(20),
    params: [pI('di', 'DI 기간', 14, 1, 300), pI('adx', 'ADX 평활', 14, 1, 300)], short: p => `ADX ${p.di} ${p.adx}`,
    plots: () => [L('adx', 'ADX', '#f23645'), L('pdi', '+DI', '#2962ff'), L('mdi', '-DI', '#ff6d00')],
    calc: (x, p) => {
      const h = x.src('high'), l = x.src('low'), n = x.n, pd = new Array(n), md = new Array(n), tr = trueRange(x).map((v, i) => i === 0 ? NA : v);
      for (let i = 1; i < n; i++) { const up = h[i] - h[i - 1], dn = l[i - 1] - l[i]; pd[i] = up > dn && up > 0 ? up : 0; md[i] = dn > up && dn > 0 ? dn : 0; }
      const trr = rma(tr, p.di), plus = zip2(rma(pd, p.di), trr, (a, b) => b === 0 ? 0 : 100 * a / b), minus = zip2(rma(md, p.di), trr, (a, b) => b === 0 ? 0 : 100 * a / b);
      return { pdi: plus, mdi: minus, adx: rma(zip2(plus, minus, (a, b) => 100 * Math.abs(a - b) / (a + b === 0 ? 1 : a + b)), p.adx) };
    } },
  aroon: { name: '아룬', en: 'Aroon', cat: 'trend', pane: true, range: [0, 100],
    params: [pI('len', '기간', 14, 1, 500)], short: p => `Aroon ${p.len}`, plots: () => [L('up', '상승', '#ff6d00'), L('dn', '하락', '#2962ff')],
    calc: (x, p) => { const ih = extremeIdx(x.src('high'), p.len + 1, true), il = extremeIdx(x.src('low'), p.len + 1, false), f = (j, i) => 100 * (p.len - (i - j)) / p.len; return { up: map1(ih, f), dn: map1(il, f) }; } },
  vortex: { name: '보텍스', en: 'Vortex Indicator VI', cat: 'trend', pane: true, prec: 3,
    params: [pI('len', '기간', 14, 2, 500)], short: p => `VI ${p.len}`, plots: () => [L('p', 'VI+', '#2962ff'), L('m', 'VI-', '#e91e63')],
    calc: (x, p) => {
      const h = x.src('high'), l = x.src('low'), n = x.n, vp = new Array(n), vm = new Array(n), tr = trueRange(x).map((v, i) => i === 0 ? NA : v);
      for (let i = 1; i < n; i++) { vp[i] = Math.abs(h[i] - l[i - 1]); vm[i] = Math.abs(l[i] - h[i - 1]); }
      const st = sumN(tr, p.len); return { p: zip2(sumN(vp, p.len), st, (a, b) => b === 0 ? 0 : a / b), m: zip2(sumN(vm, p.len), st, (a, b) => b === 0 ? 0 : a / b) };
    } },
  dpo: { name: 'DPO', en: 'Detrended Price Oscillator', cat: 'trend', pane: true, prec: 'price', levels: lv(0),
    params: [pI('len', '기간', 21, 2, 500)], short: p => `DPO ${p.len}`, plots: () => [L('v', 'DPO', '#43a047')],
    calc: (x, p) => { const c = x.src('close'), m = sma(c, p.len), bb = Math.floor(p.len / 2) + 1; return { v: c.map((v, i) => isN(m[i - bb]) ? v - m[i - bb] : NA) }; } },
  chop: { name: '초피니스 지수', en: 'Choppiness Index CHOP', cat: 'trend', pane: true, range: [0, 100], levels: lv(61.8, 38.2),
    params: [pI('len', '기간', 14, 2, 500)], short: p => `CHOP ${p.len}`, plots: () => [L('v', 'CHOP', '#2962ff')],
    calc: (x, p) => { const s = sumN(trueRange(x), p.len), hh = extreme(x.src('high'), p.len, true), ll = extreme(x.src('low'), p.len, false); return { v: map1(s, (v, i) => hh[i] === ll[i] ? NA : 100 * Math.log10(v / (hh[i] - ll[i])) / Math.log10(p.len)) }; } },

  // ── 아래 창: 변동성 ──
  atr: { name: 'ATR', en: 'Average True Range', cat: 'volat', pane: true, prec: 'price',
    params: [pI('len', '기간', 14, 1, 500), pKind('RMA')], short: p => `ATR ${p.len}`, plots: () => [L('v', 'ATR', '#ff5252')],
    calc: (x, p) => ({ v: maOf(p.kind, trueRange(x), p.len, x.src('volume')) }) },
  bbpct: { name: '볼린저 %B', en: 'Bollinger Bands %B', cat: 'volat', pane: true, prec: 3, levels: lv(1, 0),
    params: [pI('len', '기간', 20, 1, 1000), pF('mult', '배수', 2, 0.1, 10, 0.1), pSrc()], short: p => `%B ${p.len} ${p.mult}`, plots: () => [L('v', '%B', '#26a69a')],
    calc: (x, p) => { const s = x.src(p.src), b = band3(sma(s, p.len), stdev(s, p.len), p.mult); return { v: zip2(b.up, b.lo, (u, l, i) => u === l ? NA : (s[i] - l) / (u - l)) }; } },
  bbw: { name: '볼린저 밴드폭', en: 'Bollinger BandWidth BBW', cat: 'volat', pane: true, prec: 4,
    params: [pI('len', '기간', 20, 1, 1000), pF('mult', '배수', 2, 0.1, 10, 0.1), pSrc()], short: p => `BBW ${p.len} ${p.mult}`, plots: () => [L('v', 'BBW', '#2962ff')],
    calc: (x, p) => { const s = x.src(p.src), b = band3(sma(s, p.len), stdev(s, p.len), p.mult); return { v: zip2(b.up, b.lo, (u, l, i) => (u - l) / b.mid[i]) }; } },
  stdev: { name: '표준편차', en: 'Standard Deviation', cat: 'volat', pane: true, prec: 'price',
    params: [pI('len', '기간', 20, 2, 1000), pSrc()], short: p => `StdDev ${p.len}`, plots: () => [L('v', 'StdDev', '#ff9800')],
    calc: (x, p) => ({ v: stdev(x.src(p.src), p.len) }) },
  hv: { name: '역사적 변동성', en: 'Historical Volatility HV', cat: 'volat', pane: true,
    params: [pI('len', '기간', 10, 2, 500)], short: p => `HV ${p.len}`, plots: () => [L('v', 'HV (연율 %)', '#2962ff')],
    calc: (x, p) => { const c = x.src('close'), lr = c.map((v, i) => i > 0 && c[i - 1] > 0 ? Math.log(v / c[i - 1]) : NA), k = Math.sqrt(365 * DAY / barMs()); return { v: map1(stdev(lr, p.len), s => 100 * s * k) }; } },

  // ── 아래 창: 거래량 ──
  obv: { name: 'OBV', en: 'On Balance Volume', cat: 'vol', pane: true, prec: 'vol',
    params: [], short: () => 'OBV', plots: () => [L('v', 'OBV', '#2962ff')],
    calc: x => { const c = x.src('close'), v = x.src('volume'); return { v: cum(c.map((a, i) => i === 0 ? 0 : Math.sign(a - c[i - 1]) * v[i])) }; } },
  mfi: { name: 'MFI', en: 'Money Flow Index 자금흐름지수', cat: 'vol', pane: true, range: [0, 100], levels: lv(80, 20),
    params: [pI('len', '기간', 14, 1, 500)], short: p => `MFI ${p.len}`, plots: () => [L('v', 'MFI', '#7e57c2')],
    calc: (x, p) => {
      const tp = x.src('hlc3'), v = x.src('volume'), n = x.n, pos = new Array(n), neg = new Array(n);
      for (let i = 1; i < n; i++) { const r = tp[i] * v[i]; pos[i] = tp[i] > tp[i - 1] ? r : 0; neg[i] = tp[i] < tp[i - 1] ? r : 0; }
      return { v: zip2(sumN(pos, p.len), sumN(neg, p.len), (a, b) => b === 0 ? 100 : 100 - 100 / (1 + a / b)) };
    } },
  cmf: { name: '차이킨 자금흐름 (CMF)', en: 'Chaikin Money Flow CMF', cat: 'vol', pane: true, prec: 3, levels: lv(0),
    params: [pI('len', '기간', 20, 1, 500)], short: p => `CMF ${p.len}`, plots: () => [L('v', 'CMF', '#43a047')],
    calc: (x, p) => { const m = mfmOf(x), v = x.src('volume'); return { v: zip2(sumN(m.map((a, i) => a * v[i]), p.len), sumN(v, p.len), (a, b) => b === 0 ? 0 : a / b) }; } },
  ad: { name: '매집/분산 (A/D)', en: 'Accumulation Distribution A/D', cat: 'vol', pane: true, prec: 'vol',
    params: [], short: () => 'A/D', plots: () => [L('v', 'A/D', '#2962ff')], calc: x => ({ v: adLine(x) }) },
  chosc: { name: '차이킨 오실레이터', en: 'Chaikin Oscillator', cat: 'vol', pane: true, prec: 'vol', levels: lv(0),
    params: [pI('fast', '단기', 3, 1, 100), pI('slow', '장기', 10, 1, 300)], short: p => `ChaikinOsc ${p.fast} ${p.slow}`, plots: () => [L('v', 'Chaikin', '#ec407a')],
    calc: (x, p) => { const a = adLine(x); return { v: zip2(ema(a, p.fast), ema(a, p.slow), (u, w) => u - w) }; } },
  pvt: { name: '가격 거래량 추세 (PVT)', en: 'Price Volume Trend PVT', cat: 'vol', pane: true, prec: 'vol',
    params: [], short: () => 'PVT', plots: () => [L('v', 'PVT', '#2962ff')],
    calc: x => { const c = x.src('close'), v = x.src('volume'); return { v: cum(c.map((a, i) => i === 0 || !c[i - 1] ? 0 : (a - c[i - 1]) / c[i - 1] * v[i])) }; } },
  vo: { name: '거래량 오실레이터', en: 'Volume Oscillator', cat: 'vol', pane: true, levels: lv(0),
    params: [pI('s', '단기', 5, 1, 300), pI('l', '장기', 10, 1, 500)], short: p => `VO ${p.s} ${p.l}`, plots: () => [L('v', 'VO %', '#2962ff')],
    calc: (x, p) => { const v = x.src('volume'); return { v: zip2(ema(v, p.s), ema(v, p.l), (a, b) => b === 0 ? 0 : 100 * (a - b) / b) }; } },
  efi: { name: '엘더 강도 지수', en: 'Elder Force Index EFI', cat: 'vol', pane: true, prec: 'vol', levels: lv(0),
    params: [pI('len', '기간', 13, 1, 300)], short: p => `EFI ${p.len}`, plots: () => [L('v', 'EFI', '#e91e63')],
    calc: (x, p) => { const v = x.src('volume'); return { v: ema(map1(change(x.src('close'), 1), (d, i) => d * v[i]), p.len) }; } },
  eom: { name: '이용 편의성 (EOM)', en: 'Ease of Movement EOM', cat: 'vol', pane: true, prec: 'vol', levels: lv(0),
    params: [pI('len', '기간', 14, 1, 300), pI('div', '나눗수', 10000, 1, 1000000000)], short: p => `EOM ${p.len}`, plots: () => [L('v', 'EOM', '#43a047')],
    calc: (x, p) => { const h = x.src('high'), l = x.src('low'), v = x.src('volume'); return { v: sma(map1(change(x.src('hl2'), 1), (d, i) => v[i] === 0 ? NA : p.div * d * (h[i] - l[i]) / v[i]), p.len) }; } },
};
const CATS = [['all', '전체'], ['ma', '이동평균'], ['trend', '추세'], ['mom', '모멘텀·오실레이터'], ['volat', '변동성·채널'], ['vol', '거래량'], ['applied', '적용됨']];
const CATALOG = [
  ...MA_KINDS.map(([k, l]) => ({ type: 'ma', label: l, en: `${k} moving average 이평선`, cat: 'ma', preset: { kind: k } })),
  ...Object.entries(TYPES).filter(([t]) => t !== 'ma').map(([type, d]) => ({ type, label: d.name, en: d.en, cat: d.cat })),
];
const MA_COLORS = ['#f0b90b', '#eb40b5', '#b385f8', '#2962ff', '#26a69a', '#ff6d00', '#00bcd4', '#e91e63', '#8bc34a', '#ff5252', '#a1887f', '#9e9e9e'];
