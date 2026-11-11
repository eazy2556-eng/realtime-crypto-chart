// ───────── 도미넌스 (USDT.D · BTC.D) ─────────
// 코인 하나의 시가총액 ÷ 코인 전체 시가총액. 거래소가 주는 값이 아니고 무료 공개 API로는 과거 흐름을 받을 수 없어서
// TradingView 무료 위젯(CRYPTOCAP:…)을 띄운다. 위쪽 USDT.D 버튼과 종목 검색은 큰 창으로, 멀티 차트에서는 마지막 칸(USDT.D)으로 띄울 수 있다.
const TV_EMBED = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
// 종목 검색에서 찾을 수 있는 도미넌스. hit(검색어) → 'top'(맨 위) · 'near'(첫 결과 바로 아래) · null
// 검색어는 대문자에 점·공백을 지운 것 (BTC.D → BTCD). 바이낸스 선물 BTCDOMUSDT는 다른 지수라서 BTCDOM으로 찾으면 그쪽이 나오게 둔다
const DOMS = {
  'USDT.D': { name: '테더 도미넌스', coin: 'USDT', hit: q => q.startsWith('USDTD') || (q.length >= 4 && 'USDTD'.startsWith(q)) || /테더/.test(q) ? 'top' : null },
  'BTC.D': { name: '비트코인 도미넌스', coin: 'BTC', hit: q => q === 'BTCD' || q.startsWith('BTCDOMI') || /비트/.test(q) ? 'top' : q === 'BTC' ? 'near' : null },
};
// 이 앱의 시간대는 고정 시차라서, 서머타임이 없는 도시를 골라 TradingView에 넘긴다
const DOM_TZ = { utc: 'Etc/UTC', '+9': 'Asia/Seoul', '+8': 'Asia/Singapore', '+7': 'Asia/Bangkok', '+5.5': 'Asia/Kolkata', '+4': 'Asia/Dubai', '+3': 'Europe/Istanbul',
  '+2': 'Africa/Johannesburg', '+1': 'Africa/Lagos', '-3': 'America/Sao_Paulo', '-4': 'America/Caracas', '-5': 'America/Bogota', '-6': 'America/El_Salvador',
  '-7': 'America/Phoenix', '-8': 'America/Los_Angeles', '-10': 'Pacific/Honolulu' };
const domTz = () => DOM_TZ[prefs.tz] || (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC'; } catch { return 'Etc/UTC'; } })();
// TradingView 무료 위젯이 받는 시간 단위 중 지금 단위와 같거나 바로 아래 것
function domIv(id) {
  const sp = parseIv(id) || spec;
  if (sp.unit === 'd') return 'D';
  if (sp.unit === 'w') return 'W';
  if (sp.unit === 'M') return 'M';
  const min = sp.ms / 60000;
  return String([1, 3, 5, 15, 30, 60, 120, 180, 240].filter(m => m <= min).pop() || 1);
}
const domSig = (id, sym) => [sym, prefs.theme, prefs.tz, prefs.grid, domIv(id)].join('|');
// box 안에 위젯을 만든다. 기호·테마·시간대·시간 단위가 그대로면 다시 만들지 않는다 (위젯 안에서 바꾼 것이 유지되게)
function domMount(box, id, sym = 'USDT.D') {
  const sig = domSig(id, sym);
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig; box.dataset.iv = id; box.dataset.sym = sym;
  box.textContent = '';
  const msg = document.createElement('p');
  msg.className = 'dom-load'; msg.textContent = 'TradingView 차트 불러오는 중…';
  const w = document.createElement('div'), inner = document.createElement('div'), s = document.createElement('script');
  w.className = 'tradingview-widget-container';
  inner.className = 'tradingview-widget-container__widget';
  s.type = 'text/javascript'; s.src = TV_EMBED; s.async = true;
  s.textContent = JSON.stringify({
    autosize: true, symbol: 'CRYPTOCAP:' + sym, interval: domIv(id), timezone: domTz(), theme: prefs.theme === 'light' ? 'light' : 'dark', style: '1', locale: 'kr',
    backgroundColor: C.bg, gridColor: prefs.grid ? C.grid : 'rgba(0,0,0,0)', hide_volume: true, allow_symbol_change: true, save_image: false, calendar: false,
    support_host: 'https://www.tradingview.com',
  });
  s.onerror = () => { msg.textContent = 'TradingView 차트를 불러오지 못했어요. 인터넷 연결을 확인하세요.'; box.dataset.sig = ''; };
  w.append(inner, s);
  box.append(msg, w);
}
function openDom(sym = 'USDT.D') {
  const d = DOMS[sym] || DOMS['USDT.D'];
  closePops();
  $('#domName').textContent = d.name;
  $('#domSub').textContent = `${sym} · ${d.coin} 시가총액 ÷ 코인 전체 시가총액`;
  $('#domDlg').hidden = false;
  domMount($('#domBox'), spec.id, sym);
}
// 테마·시간대가 바뀌면 열려 있는 위젯을 다시 만든다 (닫힌 창은 다음에 열 때)
function domRefresh() {
  for (const f of MC.frames) if (f.dataset.kind === 'dom') domMount(f, f.dataset.iv || spec.id);
  if (!$('#domDlg').hidden) domMount($('#domBox'), $('#domBox').dataset.iv || spec.id, $('#domBox').dataset.sym);
}
$('#domBtn').addEventListener('click', () => openDom('USDT.D'));
// 종목 검색: 검색어에 맞는 도미넌스 [{ sym, at }]. 도미넌스·도미로 찾으면 전부 맨 위에
function domHits(q) {
  if (!q) return [];
  const all = q.startsWith('DOMIN') || /도미/.test(q);
  return Object.keys(DOMS).map(sym => ({ sym, at: all ? 'top' : DOMS[sym].hit(q) })).filter(x => x.at);
}
const domOfSid = sid => typeof sid === 'string' && sid.startsWith('tv:') && DOMS[sid.slice(3)] ? sid.slice(3) : null;
function domRow(sym, i, sel) {
  const d = DOMS[sym];
  return `<li role="option" id="so${i}" class="s-row${sel ? ' sel' : ''}" data-s="tv:${sym}" aria-selected="${sel}">
    <span class="coin" style="--h:${hue(d.coin)}">${d.coin[0]}</span>
    <span class="s-name"><span><b>${sym}</b><small> ${d.name}</small></span><span class="s-sub">TradingView · ${d.coin} 시가총액 ÷ 코인 전체 시가총액</span></span>
    <span class="s-last muted">창으로 열기</span><span class="s-chg"></span></li>`;
}
