
// ───────── 테더 ↔ 원화 계산기 (체결·호가 옆 탭) ─────────
// 업비트 테더 시세(원/USDT)를 기준으로 테더와 원화를 서로 환산한다. 어느 칸에 넣든 다른 칸이 바로 바뀐다.
// 시세는 계산기 탭을 연 동안 업비트 공개 시세 API(api.upbit.com, 키 필요 없음)에서 5초마다 불러온다. 직접 고치는 중에는 덮어쓰지 않는다.
const UPBIT_USDT = 'https://api.upbit.com/v1/ticker?markets=KRW-USDT';
const CALC = { busy: false };
const numIn = s => { const v = parseFloat(String(s || '').replace(/[,\s원₩]/g, '')); return isFinite(v) && v >= 0 ? v : null; };
const fmtIn = (v, d = 8) => v == null ? '' : v.toLocaleString('en-US', { maximumFractionDigits: d });
function calcRender(skip) { // 마지막에 넣은 칸을 기준으로 다른 칸을 계산 (skip: 지금 입력 중인 칸은 건드리지 않음)
  const c = prefs.calc, r = c.rate;
  if (r) { if (c.last === 'krw') c.usdt = c.krw == null ? null : +(c.krw / r).toFixed(2); else c.krw = c.usdt == null ? null : Math.round(c.usdt * r); }
  if (skip !== 'cRate' && document.activeElement !== $('#cRate')) $('#cRate').value = fmtIn(r, 2);
  if (skip !== 'cUsdt') $('#cUsdt').value = fmtIn(c.usdt, 6);
  if (skip !== 'cKrw') $('#cKrw').value = fmtIn(c.krw, 0);
}
async function calcFetch(quiet) { // 업비트에서 테더 시세 불러오기
  if (CALC.busy || (quiet && document.activeElement === $('#cRate'))) return;
  CALC.busy = true;
  try {
    const r = await fetch(UPBIT_USDT, { cache: 'no-store' });
    if (!r.ok) throw new Error('업비트 응답 ' + r.status);
    const t = (await r.json()).find(x => x.market === 'KRW-USDT');
    if (!t || !isN(t.trade_price)) throw new Error('테더 시세가 없어요');
    prefs.calc.rate = t.trade_price; savePrefs();
    $('#cSrc').textContent = `업비트 ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 기준`;
    calcRender(document.activeElement && document.activeElement.id);
    if (!quiet) toast(`업비트 테더 시세 ₩${fmtIn(t.trade_price, 2)}을 넣었어요.`);
  } catch (e) {
    if (!quiet) toast('업비트 시세를 불러오지 못했어요. 직접 입력하세요.', 'err');
  } finally { CALC.busy = false; }
}
function calcShow() { // 계산기 탭을 열 때 바로 한 번 불러온다
  calcRender();
  calcFetch(true);
}
$('#panelCalc').addEventListener('input', e => {
  const id = e.target.id, v = numIn(e.target.value), c = prefs.calc;
  if (id === 'cRate') { c.rate = v || null; $('#cSrc').textContent = '직접 입력'; }
  else if (id === 'cUsdt') { c.usdt = v; c.last = 'usdt'; }
  else if (id === 'cKrw') { c.krw = v; c.last = 'krw'; }
  else return;
  calcRender(id); savePrefs();
});
$('#panelCalc').addEventListener('focusout', e => { if (['cRate', 'cUsdt', 'cKrw'].includes(e.target.id)) calcRender(); }); // 칸을 벗어나면 천 단위 쉼표
if (!EMBED) setInterval(() => { if (prefs.tab === 'calc' && !document.hidden) calcFetch(true); }, 5000); // 계산기 탭을 연 동안 5초마다
