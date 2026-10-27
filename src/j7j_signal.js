
// ───────── 신호 비서 ─────────
// 다중 차트 3단계 조건(재분석53)을 지금 보는 종목에 계산해 근거와 함께 보여 주고, 켜 두면 알림을 띄운다.
// 각 차트는 마감된 봉만 쓴다. 스토캐스틱 5-3-3 · 10-5-5 · 20-10-10, 이평 10·20·60·120·240(단순)
// 1단계 위치: 15·30분·1·4시간 MA20·60·120·240 16개 중 4개 이상이 현재가 ±0.3% 안, 또는 30·45분 스토캐스틱 3개 응축
// 2단계 큰 파동: 30분·1시간 중 하나에서 20 스토캐스틱이 방향으로 열림 + 5·10 방향 교차(3봉 안)
// 3단계 방아쇠: 5·15분 10 스토캐스틱 저점 높임·다이버전스 + 5·10 방향 교차(3봉 안)
// 알림은 5분봉 마감 때 조건이 꺼졌다 켜지면 울리고, 같은 방향은 60분 동안 다시 울리지 않는다
// 표에 보이는 차트. 3단계 조건(알림)은 그중 5·15·30·45분·1·4시간만 쓴다(재분석53에서 검증한 정의 그대로)
const SG_TF = [['1분', 1], ['3분', 3], ['5분', 5], ['15분', 15], ['30분', 30], ['45분', 45], ['1시간', 60], ['90분', 90], ['2시간', 120], ['3시간', 180],
  ['4시간', 240], ['6시간', 360], ['8시간', 480], ['12시간', 720], ['1일', 1440], ['2일', 2880], ['3일', 4320], ['1주', 10080]];
const SG_ST = [[5, 3, 3], [10, 5, 5], [20, 10, 10]];
const SG_MA = [5, 10, 20, 60, 120, 240];
const SG_FRESH = 5; // 패턴은 확정된 지 이 봉 수 안이면 표시
const SG_NEED = 300; // 차트마다 받을 마감 봉 수 (MA240 + 여유)
const SG = { key: null, F: {}, at: {}, res: null, prev: { 1: null, '-1': null }, last: { 1: 0, '-1': 0 }, busy: false, err: null,
  log: store.get('bc:sgLog', []) || [], alarm: !!store.get('bc:sgAlarm', false) };
const sgName = m => (SG_TF.find(x => x[1] === m) || [m + '분'])[0];
const sgHM = t => { const z = zDate(t); return `${pad(z.getUTCMonth() + 1)}-${pad(z.getUTCDate())} ${pad(z.getUTCHours())}:${pad(z.getUTCMinutes())}`; };
function sgMean(a, p) {
  const o = new Array(a.length).fill(NaN);
  for (let i = p - 1; i < a.length; i++) { let s = 0, ok = true; for (let j = i - p + 1; j <= i; j++) { if (!isN(a[j])) { ok = false; break; } s += a[j]; } if (ok) o[i] = s / p; }
  return o;
}
function sgExt(a, p, isMax) {
  const o = new Array(a.length).fill(NaN);
  for (let i = p - 1; i < a.length; i++) { let m = a[i]; for (let j = i - p + 1; j < i; j++) m = isMax ? Math.max(m, a[j]) : Math.min(m, a[j]); o[i] = m; }
  return o;
}
// 거래소가 주는 가장 큰 단위로 받아 m분 칸(1970-01-01 UTC 기준)으로 묶고, 마감된 칸만 남긴다
async function sgFetch(V, native, m) {
  const span = m * 6e4;
  const nat = V.iv.map(id => [id, ivMsOf(id)]).filter(([, ms]) => ms && ms >= 6e4 && span % ms === 0).sort((a, b) => b[1] - a[1])[0];
  if (!nat) throw new Error(`${sgName(m)} 봉을 만들 수 없어요`);
  const k = span / nat[1], want = (SG_NEED + 2) * k;
  let raw = [], end;
  for (let pg = 0; pg < 6 && raw.length < want; pg++) {
    const r = await V.klines(native, nat[0], end);
    const part = r.bars.slice().sort((a, b) => a.t - b.t);
    if (!part.length) break;
    const first = raw.length ? raw[0].t : Infinity;
    raw = part.filter(b => b.t < first).concat(raw);
    if (!r.more) break;
    end = part[0].t - 1;
  }
  const out = []; let c = null;
  for (const b of raw) {
    if (k === 1) { out.push({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, n: 1 }); continue; } // 거래소 봉 그대로 (주봉은 월요일 시작 등 거래소 기준)
    const t0 = Math.floor(b.t / span) * span;
    if (!c || c.t !== t0) { c = { t: t0, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, n: 1 }; out.push(c); }
    else { c.h = Math.max(c.h, b.h); c.l = Math.min(c.l, b.l); c.c = b.c; c.v += b.v; c.n++; }
  }
  const now = nowSrv();
  while (out.length && out[out.length - 1].t + span > now) out.pop(); // 진행 중인 봉은 뺀다
  if (k > 1 && out.length && out[0].n < k) out.shift();               // 앞쪽 덜 찬 칸
  return out.slice(-SG_NEED - 20);
}
function sgCalc(B, m) {
  const o = B.map(b => b.o), h = B.map(b => b.h), l = B.map(b => b.l), c = B.map(b => b.c), v = B.map(b => b.v), n = B.length;
  const F = { m, t: B.map(b => b.t), ct: B.map(b => b.t + m * 6e4), o, h, l, c };
  for (const [p, k, d] of SG_ST) {
    const ll = sgExt(l, p, false), hh = sgExt(h, p, true);
    const raw = c.map((x, i) => isN(ll[i]) && hh[i] !== ll[i] ? 100 * (x - ll[i]) / (hh[i] - ll[i]) : NaN);
    F['K' + p] = sgMean(raw, k); F['D' + p] = sgMean(F['K' + p], d);
  }
  for (const p of SG_MA) F['ma' + p] = sgMean(c, p);
  const sd = c.map((_, i) => { if (i < 19) return NaN; const w = c.slice(i - 19, i + 1), mu = w.reduce((s, x) => s + x, 0) / 20; return Math.sqrt(w.reduce((s, x) => s + (x - mu) ** 2, 0) / 20); });
  F.bbu = F.ma20.map((x, i) => x + 2 * sd[i]); F.bbl = F.ma20.map((x, i) => x - 2 * sd[i]);
  const vm = sgMean(v, 20);
  F.volr = v.map((x, i) => i > 0 && vm[i - 1] > 0 ? x / vm[i - 1] : NaN);
  F.swh = new Array(n).fill(NaN); F.swl = new Array(n).fill(NaN); // 5봉 프랙탈, 오른쪽 2봉이 마감된 뒤에 보임
  for (let i = 0; i < n; i++) {
    F.swh[i] = i ? F.swh[i - 1] : NaN; F.swl[i] = i ? F.swl[i - 1] : NaN;
    if (i >= 4) { const w = i - 2; if (h[w] === Math.max(...h.slice(i - 4, i + 1))) F.swh[i] = h[w]; if (l[w] === Math.min(...l.slice(i - 4, i + 1))) F.swl[i] = l[w]; }
  }
  const emaA = p => { const o = new Array(n).fill(NaN), a = 2 / (p + 1); let e = NaN; for (let i = 0; i < n; i++) { e = isN(e) ? e + a * (c[i] - e) : c[i]; if (i >= p - 1) o[i] = e; } return o; };
  const e12 = emaA(12), e26 = emaA(26);
  F.macd = c.map((_, i) => e12[i] - e26[i]);
  return F;
}
// ── 바닥·봉우리 찾기 (모두 마감된 봉만, 확정된 봉 번호 at을 함께 둔다) ──
function sgStochPiv(K, D, rise = 10) { // 스토캐스틱: 저점에서 10 넘게 올라오고 K가 D 위로 가면 바닥 확정(백타 정의), 봉우리는 반대
  const P = []; let mode = 0, lo = Infinity, hi = -Infinity;
  for (let i = 0; i < K.length; i++) {
    const k = K[i], d = D[i];
    if (!isN(k) || !isN(d)) continue;
    lo = Math.min(lo, k); hi = Math.max(hi, k);
    if (mode !== 1 && k >= lo + rise && k > d) { P.push({ b: true, v: lo, at: i }); mode = 1; hi = k; }
    else if (mode !== -1 && k <= hi - rise && k < d) { P.push({ b: false, v: hi, at: i }); mode = -1; lo = k; }
  }
  return P;
}
function sgTurns(a) { // 선(이평·MACD)이 2봉 내려가다 2봉 올라서면 바닥, 반대면 봉우리 (꺾인 뒤 2번째 봉에 확정)
  const P = [];
  for (let i = 4; i < a.length; i++) {
    const [p2, p1, y, n1, n2] = a.slice(i - 4, i + 1);
    if (![p2, p1, y, n1, n2].every(isN)) continue;
    if (p1 < p2 && y < p1 && n1 > y && n2 > n1) P.push({ b: true, v: y, at: i });
    else if (p1 > p2 && y > p1 && n1 < y && n2 < n1) P.push({ b: false, v: y, at: i });
  }
  return P;
}
function sgPricePiv(c) { // 종가 기준(고승덕): 앞 3봉·뒤 2봉보다 낮은 종가가 바닥, 높은 종가가 봉우리 (뒤 2봉 마감 뒤 확정)
  const P = [];
  for (let i = 5; i < c.length; i++) {
    const w = i - 2, win = c.slice(w - 3, i + 1);
    if (c[w] === Math.min(...win)) P.push({ b: true, v: c[w], at: i });
    else if (c[w] === Math.max(...win)) P.push({ b: false, v: c[w], at: i });
  }
  return P;
}
// 최근 바닥 2·3개가 차례로 높아짐(쌍바닥·쓰리바닥), 봉우리 2·3개가 차례로 낮아짐(쌍봉·쓰리봉).
// 가장 최근에 확정된 것이 바닥이면 바닥만, 봉우리면 봉우리만 보고, 그것이 SG_FRESH봉 안에 확정됐을 때만
function sgSeq(P, n, okB = () => true, okT = () => true) {
  const out = [];
  if (!P.length) return out;
  for (const b of [P[P.length - 1].b]) {
    const L = P.filter(p => p.b === b && (b ? okB(p) : okT(p)));
    if (!L.length || n - 1 - L[L.length - 1].at >= SG_FRESH) continue;
    for (const k of [3, 2]) {
      if (L.length < k) continue;
      const s = L.slice(-k);
      if (s.every((p, i) => !i || (b ? p.v > s[i - 1].v : p.v < s[i - 1].v))) { out.push({ s: b ? 1 : -1, k }); break; }
    }
  }
  return out;
}
const SG_PAT_TIP = {
  스토: '스토캐스틱 K의 바닥(봉우리)이 연달아 높아짐(낮아짐). 숫자는 어느 스토캐스틱인지(5 = 5-3-3, 10 = 10-5-5, 20 = 20-10-10)',
  가격: '종가 기준 저점(고점)이 연달아 높아짐(낮아짐)',
  '5선': '5이평선이 내려가다 올라선 바닥(올라가다 꺾인 봉우리)이 연달아 높아짐(낮아짐) — 고승덕 "5일선 쌍바닥·쌍봉"',
  '20선': '20이평선의 바닥(봉우리)이 연달아 높아짐(낮아짐) — 고승덕 "20일선 쌍바닥·쌍봉"',
  MACD: 'MACD선(12·26)이 0 아래에서 만든 바닥이 높아짐(0 위에서 만든 봉우리가 낮아짐)',
};
function sgPatterns(F) { // 표의 패턴 칸: [{ s: +1 롱 쪽 / −1 숏 쪽, txt, tip }]
  const n = F.c.length, out = [];
  const name = (s, k) => s > 0 ? (k === 3 ? '쓰리바닥' : '쌍바닥') : (k === 3 ? '쓰리봉' : '쌍봉');
  const st = {};
  for (const [p] of SG_ST) for (const r of sgSeq(sgStochPiv(F['K' + p], F['D' + p]), n)) (st[r.s + ':' + r.k] = st[r.s + ':' + r.k] || []).push(p);
  for (const [key, ps] of Object.entries(st)) { const [s, k] = key.split(':').map(Number); out.push({ s, txt: `스토 ${name(s, k)} ${ps.join('·')}`, tip: SG_PAT_TIP.스토 }); }
  const fam = [['가격', sgPricePiv(F.c)], ['5선', sgTurns(F.ma5)], ['20선', sgTurns(F.ma20)]];
  for (const [nm, P] of fam) for (const r of sgSeq(P, n)) out.push({ s: r.s, txt: `${nm} ${name(r.s, r.k)}`, tip: SG_PAT_TIP[nm] });
  for (const r of sgSeq(sgTurns(F.macd), n, p => p.v < 0, p => p.v > 0)) out.push({ s: r.s, txt: `MACD ${name(r.s, r.k)}`, tip: SG_PAT_TIP.MACD });
  return out;
}
const sgAt = (F, k, b = 0) => { const j = F.c.length - 1 - b; return j >= 0 ? F[k][j] : NaN; };
const sgNMin = a => { const f = a.filter(isN); return f.length ? Math.min(...f) : NaN; };
const sgNMax = a => { const f = a.filter(isN); return f.length ? Math.max(...f) : NaN; };
function sgSide(F, s) { // 방향 s(+1 롱, −1 숏)에 맞춘 스토캐스틱 상태
  const r = {}, sk = (k, b) => s > 0 ? sgAt(F, k, b) : 100 - sgAt(F, k, b);
  for (const [p] of SG_ST) {
    let x = false, xa = false;
    for (let b = 0; b < 3; b++) {
      const a1 = s * (sgAt(F, 'K' + p, b) - sgAt(F, 'D' + p, b)), a0 = s * (sgAt(F, 'K' + p, b + 1) - sgAt(F, 'D' + p, b + 1));
      if (a1 > 0 && a0 <= 0) x = true;
      if (a1 < 0 && a0 >= 0) xa = true;
    }
    r['x' + p] = x; r['xa' + p] = xa;
  }
  r.open20 = s * (sgAt(F, 'K20') - sgAt(F, 'D20')) > 0 || s * (sgAt(F, 'K20') - sgAt(F, 'K20', 3)) > 0;
  r.wave = r.open20 && (r.x5 || r.x10);
  const Ks = [], Pl = [];
  for (let b = 0; b < 15; b++) { Ks.push(sk('K10', b)); Pl.push(s > 0 ? sgAt(F, 'l', b) : -sgAt(F, 'h', b)); }
  r.hl10 = sgNMin(Ks.slice(0, 7)) > sgNMin(Ks.slice(7));
  r.div10 = r.hl10 && sgNMin(Pl.slice(0, 7)) < sgNMin(Pl.slice(7));
  return r;
}
function sgSq(F) { // 스토캐스틱 3개가 한 점으로 모였다가(직전 3봉 중 폭 15 이하) 지금 벌어지기 시작
  const rng = b => { const v = SG_ST.map(([p]) => sgAt(F, 'K' + p, b)); return sgNMax(v) - sgNMin(v); };
  const r0 = rng(0), r1 = rng(1), mn = sgNMin([r1, rng(2), rng(3)]);
  return mn <= 15 && r0 > r1;
}
function sgEval(at5) {
  const F = SG.F;
  if (![1, 5, 15, 30, 45, 60, 240].every(m => F[m] && F[m].c.length)) return; // 3단계 조건에 쓰는 차트
  const p1 = sgAt(F[1], 'c'), conf = [];
  for (const m of [15, 30, 60, 240]) for (const p of [20, 60, 120, 240]) { const v = sgAt(F[m], 'ma' + p); if (isN(v) && Math.abs(v / p1 - 1) <= 0.003) conf.push(`${sgName(m)} MA${p}`); }
  const sq30 = sgSq(F[30]), sq45 = sgSq(F[45]);
  const res = { p1, t: sgAt(F[1], 'ct'), conf, side: {} };
  const ok1 = conf.length >= 4 || sq30 || sq45;
  const why1 = ok1 ? [conf.length >= 4 ? `현재가 ±0.3% 안에 이평선 ${conf.length}개가 모여 있음 (${conf.join(', ')})` : '', sq30 ? '30분 스토캐스틱 3개가 한 점에 모였다가 벌어지기 시작(응축)' : '', sq45 ? '45분 스토캐스틱 응축' : ''].filter(Boolean).join(' · ')
    : `현재가 ±0.3% 안 이평선 ${conf.length}개(4개 이상 필요)${conf.length ? ': ' + conf.join(', ') : ''} · 30·45분 응축 없음`;
  for (const s of [1, -1]) {
    const S30 = sgSide(F[30], s), S60 = sgSide(F[60], s), S5 = sgSide(F[5], s), S15 = sgSide(F[15], s);
    const up = s > 0, X = up ? '골든크로스' : '데드크로스', dir = up ? '위' : '아래';
    const ok2 = S30.wave || S60.wave;
    const w2 = [['30분', S30], ['1시간', S60]].map(([n, q]) => q.wave ? `${n}: 큰 스토캐스틱(20-10-10)이 ${dir}로 열림 + ${q.x5 ? '5-3-3' : '10-5-5'} ${X}`
      : `${n}: 큰 스토캐스틱 ${q.open20 ? `${dir}로 열림` : '안 열림'}, 5-3-3·10-5-5 ${X} ${q.x5 || q.x10 ? '있음' : '없음'}`);
    const bot = [['5분', S5], ['15분', S15]].flatMap(([n, q]) => [q.div10 ? `${n} 다이버전스(가격 ${up ? '저점은 낮아졌는데 스토캐스틱 저점은 높아짐' : '고점은 높아졌는데 스토캐스틱 고점은 낮아짐'})`
      : q.hl10 ? `${n} 10-5-5 ${up ? '저점이 높아짐' : '고점이 낮아짐'}` : ''].filter(Boolean));
    const crs = [['5분', S5], ['15분', S15]].flatMap(([n, q]) => [q.x5 ? `${n} 5-3-3 ${X}` : '', q.x10 ? `${n} 10-5-5 ${X}` : ''].filter(Boolean));
    const ok3 = bot.length > 0 && crs.length > 0;
    const w3 = `${bot.length ? bot.join(', ') : `5·15분 ${up ? '저점 높아짐' : '고점 낮아짐'}·다이버전스 없음`} / ${crs.length ? crs.join(', ') : `5·15분 ${X} 없음`}`;
    const all = ok1 && ok2 && ok3;
    res.side[s] = { all, st: [{ ok: ok1, why: why1 }, { ok: ok2, why: w2.join(' · ') }, { ok: ok3, why: w3 }] };
    if (at5) {
      if (SG.prev[s] === false && all && nowSrv() - SG.last[s] >= 3600e3) sgFire(s, res);
      SG.prev[s] = all;
    }
  }
  res.rows = SG_TF.filter(([, m]) => F[m] && F[m].c.length).map(([name, m]) => {
    const G = F[m], c = sgAt(G, 'c'), a = sgAt(G, 'ma20'), b = sgAt(G, 'ma60'), d = sgAt(G, 'ma120');
    const arr = c > a && a > b && b > d ? 'u' : c < a && a < b && b < d ? 'd' : 'm';
    const L = sgSide(G, 1), Sh = sgSide(G, -1), tags = [];
    const tg = (cls, txt, tip) => tags.push(`<span class="${cls}" title="${esc(tip)}">${esc(txt)}</span>`);
    const sets = q => [q.x5 ? 5 : 0, q.x10 ? 10 : 0].filter(Boolean), nm = { 5: '5-3-3', 10: '10-5-5' };
    if (L.x5 || L.x10) tg('u', `↑골든 ${sets(L).join('·')}`, `최근 3봉 안에 스토캐스틱 ${sets(L).map(p => nm[p]).join('·')}의 K가 D를 아래에서 위로 뚫음`);
    if (Sh.x5 || Sh.x10) tg('d', `↓데드 ${sets(Sh).join('·')}`, `최근 3봉 안에 스토캐스틱 ${sets(Sh).map(p => nm[p]).join('·')}의 K가 D를 위에서 아래로 뚫음`);
    if (L.div10) tg('u', '↑다이버', '최근 15봉: 가격 저점은 더 낮아졌는데 10-5-5 스토캐스틱 저점은 더 높아짐 (내려가는 힘이 약해짐)');
    if (Sh.div10) tg('d', '↓다이버', '최근 15봉: 가격 고점은 더 높아졌는데 10-5-5 스토캐스틱 고점은 더 낮아짐 (올라가는 힘이 약해짐)');
    if (sgSq(G)) tg('', '응축', '스토캐스틱 3개(5·10·20)가 15 안쪽으로 모여 있다가 지금 벌어지기 시작함');
    for (const p of sgPatterns(G)) tg(p.s > 0 ? 'u' : 'd', p.txt, p.tip);
    const k = p => { const K = sgAt(G, 'K' + p), D = sgAt(G, 'D' + p); return isN(K) ? `<span class="${K >= D ? 'u' : 'd'}">${K.toFixed(0)}</span>` : '<span class="m">—</span>'; };
    return { name, arr, k5: k(5), k10: k(10), k20: k(20), tags: tags.join(' ') };
  });
  SG.res = res;
}
function sgFire(s, res) {
  SG.last[s] = nowSrv();
  const st = res.side[s].st, side = s > 0 ? '롱' : '숏';
  SG.log.unshift({ t: nowSrv(), sid: cur.sid, sym: cur.title, side: s, p: res.p1, why: st.map(x => x.why) });
  if (SG.log.length > 50) SG.log.length = 50;
  store.set('bc:sgLog', SG.log);
  if (!SG.alarm) return;
  const msg = `${cur.title} ${side} 3단계 조건 · ${fp(res.p1)} · ${st.map((x, i) => `${i + 1}단계 ${x.why}`).join(' / ')}`;
  AL.log.unshift({ t: Date.now(), msg: '신호 비서 · ' + msg }); if (AL.log.length > 50) AL.log.length = 50; store.set('bc:alertLog', AL.log);
  AL.unseen++; syncAlertBadge();
  toast('신호 비서 · ' + msg, s > 0 ? 'up' : 'down'); beep(s > 0); setTimeout(() => beep(s > 0), 450);
  if (window.Notification && Notification.permission === 'granted' && (document.hidden || !document.hasFocus())) { try { new Notification(`신호 비서 · ${cur.title} ${side}`, { body: msg, tag: 'bc-sg' }); } catch {} }
}
async function sgTick() {
  if (EMBED || !cur || !cur.V) return;
  if (prefs.tab !== 'sig' && !SG.alarm) return; // 신호 탭을 보거나 알림을 켰을 때만 받는다
  if (cur.sid !== SG.key) { Object.assign(SG, { key: cur.sid, F: {}, at: {}, res: null, prev: { 1: null, '-1': null }, err: null }); sgRender(); }
  if (SG.busy) return;
  const key = SG.key, now = nowSrv(), due = SG_TF.map(x => x[1]).filter(m => !SG.F[m] || (SG.at[m] || 0) < Math.floor(now / (m * 6e4)) * m * 6e4);
  if (!due.length) return;
  SG.busy = true;
  try {
    for (const m of due) {
      const B = await sgFetch(cur.V, cur.native, m);
      if (SG.key !== key) return;
      if (!B.length) continue;
      SG.F[m] = sgCalc(B, m);
      const span = m * 6e4, close = Math.floor(nowSrv() / span) * span;
      if (B[B.length - 1].t + span >= close) SG.at[m] = close; // 거래소가 아직 새 봉을 안 줬으면 다음에 다시 받는다
    }
    SG.err = null;
    sgEval(due.includes(5));
  } catch (e) { SG.err = e && e.message ? e.message : String(e); }
  finally { SG.busy = false; }
  sgRender();
}
const SG_HELP = `<details class="sg-help"><summary>신호 글자 뜻</summary><dl>
<dt>↑골든 · ↓데드</dt><dd>스토캐스틱의 빠른 선(K)이 느린 선(D)을 아래에서 위로 뚫으면 골든크로스, 위에서 아래로 뚫으면 데드크로스입니다. 최근 3봉 안에 5-3-3이나 10-5-5에서 난 것만 표시하고, 뒤 숫자가 어느 스토캐스틱인지입니다(예: '↑골든 10' = 10-5-5 골든크로스). 짧은 흐름이 그쪽으로 돌아섰다는 뜻입니다. 작은 것과 큰 것이 서로 반대로 꺾이면 둘 다 보일 수 있습니다.</dd>
<dt>응축</dt><dd>세 스토캐스틱(5-3-3 · 10-5-5 · 20-10-10) 값이 15 안쪽으로 한데 모여 있다가 지금 벌어지기 시작한 상태입니다. 작은·중간·큰 흐름이 한 점에서 만난 뒤 한쪽으로 움직이기 시작했다는 뜻입니다.</dd>
<dt>↑다이버 · ↓다이버</dt><dd>최근 15봉에서 가격 저점은 더 낮아졌는데 10-5-5 스토캐스틱 저점은 오히려 높아졌으면 ↑다이버(상승 다이버전스)입니다. 내려가는 힘이 약해졌다는 뜻입니다. 가격 고점은 높아졌는데 스토캐스틱 고점이 낮아졌으면 ↓다이버입니다.</dd>
<dt>쌍바닥 · 쓰리바닥</dt><dd>바닥이 2번(쓰리바닥은 3번) 연달아 높아진 것입니다(고승덕 '높은 쌍바닥'). 쌍봉·쓰리봉은 봉우리가 연달아 낮아진 것입니다. 가장 최근에 확정된 바닥(봉우리)이 5봉 안에 생겼을 때만 표시합니다. 앞 글자는 무엇의 바닥인지입니다.
<br>· 스토: 스토캐스틱 K. 저점에서 10 넘게 올라오고 K가 D 위로 가면 바닥으로 확정합니다(백타 정의). 뒤 숫자는 어느 스토캐스틱인지입니다(5 = 5-3-3).
<br>· 가격: 종가 기준. 앞 3봉·뒤 2봉보다 낮은 종가를 바닥으로 봅니다.
<br>· 5선 · 20선: 이동평균선이 2봉 내려가다 2봉 올라선 점을 바닥으로 봅니다(고승덕 '5일선·20일선 쌍바닥').
<br>· MACD: MACD선(12·26)이 0 아래에서 만든 바닥, 0 위에서 만든 봉우리만 셉니다.</dd>
<dt>배열 ▲ · ▼</dt><dd>종가 &gt; MA20 &gt; MA60 &gt; MA120이면 ▲(정배열), 반대면 ▼(역배열), 섞여 있으면 –입니다.</dd>
<dt>초록 · 빨강 숫자</dt><dd>스토캐스틱 K 값입니다. 초록은 K가 D 위, 빨강은 아래입니다. 80 위는 과열, 20 아래는 침체로 봅니다.</dd>
<dt>참고</dt><dd>표와 패턴은 정리용입니다. 책 규칙을 그대로 BTC에 시험한 과거 결과는 파동에너지(4시간봉) 7년 0.30배, 고승덕 기법 중 가장 나은 것 1.3 ~ 1.5배였습니다. 알림은 위의 3단계 조건에만 걸립니다.</dd>
</dl></details>`;
function sgRender() {
  if (prefs.tab !== 'sig') return;
  $('#sgAlarm').checked = SG.alarm;
  const r = SG.res;
  $('#sgMeta').textContent = SG.err ? `받기 실패 · ${SG.err}` : r ? `${cur.title} · ${sgHM(r.t)} 마감 기준` : '차트 10개 받는 중…';
  const note = '<p class="sg-note">참고용 정보입니다. 과거 BTC 검증(2019-12 ~ 2026-10, 재분석53)에서 세 단계가 모두 켜지는 알림은 하루 약 14번 울렸고, 알림 뒤 4시간 움직임은 무작위 시각과 같았습니다. 기대값이 확인된 매매 신호가 아닙니다.</p>';
  if (!r) { $('#sgBody').innerHTML = note; return; }
  const card = s => {
    const q = r.side[s], nm = s > 0 ? '롱' : '숏';
    return `<div class="sg-side${q.all ? ' on' : ''}"><h3 class="${s > 0 ? 'long' : 'short'}">${nm}<span>${q.all ? '3단계 모두 충족' : q.st.filter(x => x.ok).length + ' / 3'}</span></h3>`
      + q.st.map((x, i) => `<div class="sg-st"><span class="${x.ok ? 'ok' : 'no'}">${x.ok ? '✓' : '·'}</span><b>${['1 위치', '2 큰 파동', '3 방아쇠'][i]}</b><small>${esc(x.why)}</small></div>`).join('') + '</div>';
  };
  const ARR = { u: '<span class="u">▲</span>', d: '<span class="d">▼</span>', m: '<span class="m">–</span>' };
  const tbl = `<table class="sg-tbl"><thead><tr><th>차트</th><th title="종가·MA20·60·120 정배열(▲)·역배열(▼)">배열</th><th title="5-3-3 스토캐스틱 K">5</th><th title="10-5-5 스토캐스틱 K">10</th><th title="20-10-10 스토캐스틱 K">20</th><th>신호 (글자에 마우스를 올리면 설명)</th></tr></thead><tbody>`
    + r.rows.map(x => `<tr><td>${x.name}</td><td>${ARR[x.arr]}</td><td>${x.k5}</td><td>${x.k10}</td><td>${x.k20}</td><td style="white-space:normal">${x.tags}</td></tr>`).join('') + '</tbody></table>';
  const logs = SG.log.filter(x => x.sid === cur.sid).slice(0, 20);
  const lg = `<div class="sg-sec">신호 기록 (${esc(cur.title)}, 이 기기에서 계산한 것만)</div><ul class="sg-log">`
    + (logs.length ? logs.map(x => `<li><b class="${x.side > 0 ? 'long' : 'short'}">${x.side > 0 ? '롱' : '숏'}</b> ${sgHM(x.t)} · ${fp(x.p)}<br>${x.why.map((w, i) => `${i + 1}) ${esc(w)}`).join('<br>')}</li>`).join('') : '<li class="m">아직 없음</li>') + '</ul>';
  $('#sgBody').innerHTML = note + card(1) + card(-1) + `<div class="sg-sec">차트별 상태 (숫자는 스토캐스틱 K · 초록 = K가 D 위, 빨강 = 아래)</div>` + tbl + SG_HELP + lg;
}
$('#sgAlarm').addEventListener('change', e => {
  SG.alarm = e.target.checked; store.set('bc:sgAlarm', SG.alarm);
  if (SG.alarm && window.Notification && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  toast(SG.alarm ? '신호 비서 알림을 켰어요. 이 차트가 열려 있을 때만 확인해요.' : '신호 비서 알림을 껐어요.');
  sgTick();
});
if (!EMBED) setInterval(sgTick, 5000);
