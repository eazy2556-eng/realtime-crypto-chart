
// ───────── 멀티 차트 ─────────
// 화면을 1~4칸으로 나눈다. 첫 칸은 이 페이지의 차트(오른쪽 시세 패널과 이어짐), 나머지 칸은 같은 앱을 작게 띄운 것.
// 칸마다 종목·시간 단위·지표를 따로 저장한다. 테마·캔들 색·시간대 같은 모양 설정은 첫 칸을 따른다.
const MC_LAYOUTS = [['1', '1칸'], ['2v', '좌우 2칸'], ['2h', '위아래 2칸'], ['3', '3칸'], ['4', '4칸']];
const MC_CELLS = { 1: 1, '2v': 2, '2h': 2, 3: 3, 4: 4 };
const MC = { applying: false, frames: [], look: '', lt: null, wide: null, xPend: undefined, xLast: undefined, xRaf: 0, xIn: false, xHid: false };
const mcOrigin = location.origin === 'null' ? '*' : location.origin; // 파일로 열었을 때는 출처가 없다
const mcWide = () => innerWidth >= 900;
const lookSig = () => JSON.stringify(LOOK_KEYS.map(k => prefs[k]));
function mcIcon(v) {
  const r = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"/>`;
  const g = { 1: r(1, 1, 28, 20), '2v': r(1, 1, 13.5, 20) + r(15.5, 1, 13.5, 20), '2h': r(1, 1, 28, 9.5) + r(1, 11.5, 28, 9.5), 3: r(1, 1, 15, 20) + r(17, 1, 12, 9.5) + r(17, 11.5, 12, 9.5), 4: r(1, 1, 13.5, 9.5) + r(15.5, 1, 13.5, 9.5) + r(1, 11.5, 13.5, 9.5) + r(15.5, 11.5, 13.5, 9.5) };
  return `<svg viewBox="0 0 30 22" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${g[v]}</svg>`;
}
function mcApply() {
  if (EMBED) return;
  const L = prefs.layout, n = mcWide() ? MC_CELLS[L.n] || 1 : 1, g = $('#mcGrid');
  MC.wide = mcWide();
  g.className = 'mc-grid' + (n > 1 ? ` mc-on l-${L.n}` : '');
  while (MC.frames.length > n - 1) MC.frames.pop().remove();
  for (let k = MC.frames.length + 1; k < n; k++) {
    const f = document.createElement('iframe');
    f.className = 'mc-cell'; f.title = `차트 ${k + 1}`;
    f.src = `${location.pathname}?embed=1&slot=${k}&v=${encodeURIComponent(document.lastModified)}`; // 새로 배포하면 칸도 새 파일을 받게
    g.append(f); MC.frames.push(f);
  }
  $('#layoutBtn').setAttribute('aria-pressed', String(n > 1));
  $('#layoutBtn').innerHTML = mcIcon(n > 1 ? L.n : '1');
}
function buildLayoutPop() {
  const L = prefs.layout;
  $('#layoutPop').innerHTML = '<div class="pop-title">차트 배치</div><div class="mc-opts">'
    + MC_LAYOUTS.map(([v, l]) => `<button type="button" class="mc-opt" data-mcl="${v}" aria-pressed="${L.n === v}">${mcIcon(v)}<span>${l}</span></button>`).join('') + '</div>'
    + `<label class="cs-chk"><input type="checkbox" data-mcs="syncSym"${L.syncSym ? ' checked' : ''}><span>모든 칸 같은 종목<small>한 칸에서 종목을 바꾸면 다른 칸도 바뀌어요</small></span></label>`
    + `<label class="cs-chk"><input type="checkbox" data-mcs="syncIv"${L.syncIv ? ' checked' : ''}><span>모든 칸 같은 시간 단위</span></label>`
    + `<label class="cs-chk"><input type="checkbox" data-mcs="syncX"${L.syncX ? ' checked' : ''}><span>십자선 맞추기<small>마우스를 올린 칸과 같은 시각에 다른 칸도 세로 점선을 그려요</small></span></label>`
    + `<p class="pop-hint">${mcWide() ? '칸마다 종목·시간 단위·지표·작도 도구를 따로 써요. 왼쪽 위 칸이 오른쪽 시세 패널과 이어져 있어요.' : '멀티 차트는 가로 900px 이상인 넓은 화면에서 보여요. (휴대폰은 한 칸)'}</p>`;
}
$('#layoutPop').addEventListener('click', e => {
  const b = e.target.closest('[data-mcl]');
  if (!b) return;
  prefs.layout.n = b.dataset.mcl; savePrefs(); mcApply(); buildLayoutPop();
  if (!mcWide() && b.dataset.mcl !== '1') toast('멀티 차트는 넓은 화면에서 보여요. 이 기기에서는 한 칸으로 보여요.');
});
$('#layoutPop').addEventListener('change', e => { const k = e.target.dataset.mcs; if (k) { prefs.layout[k] = e.target.checked; savePrefs(); } });
window.addEventListener('resize', () => { if (!EMBED && MC.wide !== null && MC.wide !== mcWide()) mcApply(); });

// 종목·시간 단위 맞추기: 바꾼 칸이 알리면 첫 칸이 나머지 칸에 전한다
function mcMoved(sid, iv) {
  if (MC.applying) return;
  if (EMBED) { if (window.parent !== window) window.parent.postMessage({ bc: 'moved', sym: sid, iv }, mcOrigin); return; }
  mcSpread(0, sid, iv);
}
function mcSpread(from, sid, iv) {
  const L = prefs.layout;
  if (!L.syncSym && !L.syncIv) return;
  const msg = { bc: 'go', sym: L.syncSym ? sid : null, iv: L.syncIv ? iv : null };
  MC.frames.forEach((f, i) => { if (i + 1 !== from && f.contentWindow) f.contentWindow.postMessage(msg, mcOrigin); });
  if (from !== 0) mcGo(msg);
}
function mcGo(m) {
  if (!cur) return;
  const sid = typeof m.sym === 'string' && SID_RE.test(m.sym) ? m.sym : cur.sid, iv = typeof m.iv === 'string' && parseIv(m.iv) ? m.iv : spec.id;
  if (sid === cur.sid && iv === spec.id) return;
  MC.applying = true;
  try { load(sid, iv); } finally { MC.applying = false; }
}
// 칸끼리 십자선 맞추기: 마우스가 있는 칸의 시각(ms)을 다른 칸에 보내 같은 시각에 세로 점선을 그린다
function mcCrossOut(t) {
  if (!EMBED && !MC.frames.length) return;
  MC.xPend = t;
  if (MC.xRaf) return;
  MC.xRaf = requestAnimationFrame(() => { // 한 화면에 한 번만 보낸다
    MC.xRaf = 0;
    const v = MC.xPend;
    if (v === MC.xLast) return;
    MC.xLast = v;
    if (EMBED) window.parent.postMessage({ bc: 'xh', t: v }, mcOrigin); else mcCrossSpread(0, v);
  });
}
function mcCrossSpread(from, t) {
  if (!prefs.layout.syncX) return;
  MC.frames.forEach((f, i) => { if (i + 1 !== from && f.contentWindow) f.contentWindow.postMessage({ bc: 'xh', t }, mcOrigin); });
  if (from !== 0) mcCrossIn(t);
}
function mcCrossIn(t) {
  if (!mainSeries || !S.bars.length || hoverChart) return; // 이 칸에 마우스가 있으면 그대로 둔다
  const b = S.bars, n = b.length;
  if (t == null || !isN(t) || t < b[0].t || t >= nextBucket(b[n - 1].t, spec)) {
    if (MC.xIn) { MC.xIn = false; hoverIdx = null; for (const o of charts) { try { o.clearCrosshairPosition(); } catch {} } renderLegends(); }
    return;
  }
  let lo = 0, hi = n - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (b[m].t <= t) lo = m; else hi = m - 1; }
  if (!MC.xHid) { MC.xHid = true; for (const o of charts) o.applyOptions({ crosshair: { horzLine: { visible: false, labelVisible: false } } }); } // 다른 칸에서 온 십자선은 세로 점선만
  MC.xIn = true; hoverIdx = lo;
  for (const o of charts) setCross(o, lo, b[lo].time);
  renderLegends();
}
$('.chart-area').addEventListener('pointerover', () => { // 이 칸에 마우스가 오면 가로 점선을 다시 보인다
  if (!MC.xHid) return;
  MC.xHid = false; MC.xIn = false;
  for (const o of charts) o.applyOptions({ crosshair: { horzLine: { visible: true, labelVisible: true } } });
}, true);
window.addEventListener('message', e => {
  const m = e.data;
  if (!m || typeof m !== 'object' || typeof m.bc !== 'string') return;
  if (mcOrigin !== '*' && e.origin !== location.origin) return;
  if (EMBED) {
    if (e.source !== window.parent) return;
    if (m.bc === 'look') location.reload(); // 첫 칸의 모양 설정이 바뀜
    else if (m.bc === 'go') mcGo(m);
    else if (m.bc === 'xh') mcCrossIn(m.t);
    return;
  }
  const i = MC.frames.findIndex(f => f.contentWindow === e.source);
  if (i >= 0 && m.bc === 'moved') mcSpread(i + 1, m.sym, m.iv);
  else if (i >= 0 && m.bc === 'xh') mcCrossSpread(i + 1, m.t);
});
if (!EMBED) {
  MC.look = lookSig();
  SYNC.onSave = () => { // 테마·색·시간대가 바뀌면 다른 칸도 다시 그리게
    const sig = lookSig();
    if (sig === MC.look) return;
    MC.look = sig;
    clearTimeout(MC.lt);
    MC.lt = setTimeout(() => MC.frames.forEach(f => f.contentWindow && f.contentWindow.postMessage({ bc: 'look' }, mcOrigin)), 400);
  };
  mcApply();
}
