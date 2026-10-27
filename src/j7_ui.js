
// ───────── 팝오버 ─────────
function closePops() {
  $$('.pop').forEach(p => { p.hidden = true; });
  $$('[aria-expanded="true"][data-pop], [aria-expanded="true"][data-flyout]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
function openPop(btn, pop, side) {
  pop.hidden = false;
  const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  let left = side ? r.right + 6 : r.left, top = side ? r.top : r.bottom + 6;
  left = Math.max(8, Math.min(left, innerWidth - w - 8));
  top = Math.max(8, Math.min(top, innerHeight - h - 8));
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  btn.setAttribute('aria-expanded', 'true');
}
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-pop]');
  if (!btn) return;
  const pop = $('#' + btn.dataset.pop), willOpen = pop.hidden;
  closePops();
  if (!willOpen) return;
  if (pop.id === 'ivPop') buildIvMenu();
  if (pop.id === 'latPop') { pop.hidden = false; renderLatency(); }
  if (pop.id === 'tzPop') buildTzMenu();
  if (pop.id === 'layoutPop') buildLayoutPop();
  if (pop.id === 'gotoPop') { prepGoto(); setTimeout(() => $('#gotoIn').focus(), 0); }
  openPop(btn, pop);
});
document.addEventListener('pointerdown', e => { if (!e.target.closest('.pop, [data-pop], [data-flyout]')) closePops(); });
window.addEventListener('resize', closePops);
// 창이 좁아 위쪽 줄(휴대폰은 도구 줄도)이 좌우로 넘치면: 마우스 휠이나 끌기로 좌우로 움직이고, 넘친 쪽 끝을 흐리게 보여 준다
function hScroll(el) {
  const room = () => el.scrollWidth - el.clientWidth;
  const edge = () => { const ov = room(); el.classList.toggle('ov-l', ov > 1 && el.scrollLeft > 1); el.classList.toggle('ov-r', ov > 1 && el.scrollLeft < ov - 1); };
  let er = 0;
  const edgeSoon = () => { if (!er) er = requestAnimationFrame(() => { er = 0; edge(); }); }; // 버튼이 나중에 채워지거나 바뀌어도 다시 본다
  el.addEventListener('scroll', edge, { passive: true });
  window.addEventListener('resize', edgeSoon);
  new MutationObserver(edgeSoon).observe(el, { childList: true, subtree: true });
  el.addEventListener('wheel', e => {
    if (room() <= 1 || el.scrollHeight > el.clientHeight + 1 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // 위아래로 넘치는 줄(PC 도구 줄)은 그대로
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }, { passive: false });
  let drag = null;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0 && room() > 1) drag = { x: e.clientX, s: el.scrollLeft, moved: false }; });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    drag.moved = true; el.scrollLeft = drag.s - dx;
  });
  window.addEventListener('pointerup', () => {
    if (drag && drag.moved) { // 끈 뒤에는 버튼이 눌리지 않게
      const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', stop, true), 50);
    }
    drag = null;
  });
  edge();
}
hScroll($('.topbar')); hScroll($('#tools'));

// ───────── 작도 도구 막대 ─────────
const STAR = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5l1.9 4 4.4.5-3.3 3 .9 4.3L8 11.1l-3.9 2.2.9-4.3-3.3-3 4.4-.5z"/></svg>';
const CARET = '<svg viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><path d="M8 8H0L8 0z"/></svg>';
const TOGGLES = [
  { k: 'magnet', name: '자석 — 시가·고가·저가·종가에 붙이기', icon: svgI('<path d="M5 3v6a4 4 0 0 0 8 0V3M5 6.5h3M10 6.5h3"/>') },
  { k: 'keepTool', name: '그리기 유지 — 그린 뒤에도 같은 도구 유지', icon: svgI('<path d="M12.5 2.5l3 3L6 15H3v-3z"/><path d="M10.5 4.5l3 3"/>') },
  { k: 'hideDw', name: '작도 숨기기', icon: ICON_EYE_OFF },
];
const pickOf = g => g.tools.includes(prefs.toolPick[g.id]) ? prefs.toolPick[g.id] : g.tools[0];
const groupOf = t => DW_GROUPS.find(g => g.tools.includes(t));
function buildTools() {
  const tb = t => DW_TOOLS[t].name + (DW_TOOLS[t].key ? ` (${DW_TOOLS[t].key})` : '');
  let h = `<button type="button" class="tool" data-tool="cursor" aria-pressed="true" aria-label="십자선" title="십자선 (Esc)">${DW_TOOLS.cursor.icon}</button>`;
  for (const g of DW_GROUPS) {
    const t = pickOf(g);
    h += `<div class="tool-wrap"><button type="button" class="tool" data-group="${g.id}" aria-pressed="false" aria-label="${DW_TOOLS[t].name}" title="${tb(t)}">${DW_TOOLS[t].icon}</button>`
      + (g.tools.length > 1 ? `<button type="button" class="caret" data-flyout="${g.id}" aria-haspopup="true" aria-expanded="false" aria-label="${g.label} 도구 모두 보기" title="${g.label} 도구 모두 보기">${CARET}</button>` : '') + '</div>';
  }
  h += '<span class="hsep"></span>';
  for (const t of TOGGLES) h += `<button type="button" class="tool" data-toggle="${t.k}" aria-pressed="${!!prefs[t.k]}" aria-label="${t.name}" title="${t.name}">${t.icon}</button>`;
  h += `<button type="button" class="tool" id="clearDw" aria-label="작도 모두 지우기" title="이 종목의 작도 모두 지우기 (Ctrl+Z로 되돌리기)">${ICON_TRASH}</button>`;
  h += '<span class="hsep"></span>';
  h += '<button type="button" class="tool txt" id="logBtn" aria-pressed="false" title="로그 스케일 (Alt+L)">log</button>';
  h += '<button type="button" class="tool txt" id="pctBtn" aria-pressed="false" title="퍼센트 스케일 (Alt+P)">%</button>';
  h += `<button type="button" class="tool" id="resetBtn" aria-label="화면 초기화" title="화면 초기화 — 최근 봉으로 돌아가고 가격 축 자동 맞춤">${svgI('<path d="M3.5 9a5.5 5.5 0 1 0 1.7-4"/><path d="M3 2.5v3h3"/>')}</button>`;
  h += `<button type="button" class="tool" id="shotBtn" aria-label="차트 이미지 저장" title="차트 이미지 저장 (PNG)">${svgI('<path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h1.6l1.2-1.8h4.4L12.4 5H14a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 14 14.5H4A1.5 1.5 0 0 1 2.5 13z"/><circle cx="9" cy="9.5" r="2.6"/>')}</button>`;
  h += `<button type="button" class="tool" id="replayBtn" aria-pressed="false" aria-label="바 리플레이" title="바 리플레이 — 과거의 한 봉부터 다시 펼쳐 보기">${svgI('<path d="M3 3v12"/><path d="M15 3.5v11L6 9z"/>')}</button>`;
  h += `<button type="button" class="tool" id="gotoBtn" data-pop="gotoPop" aria-haspopup="true" aria-expanded="false" aria-label="날짜로 이동" title="날짜로 이동 (Alt+G)">${svgI('<rect x="2.5" y="3.5" width="13" height="12" rx="1.5"/><path d="M2.5 7.5h13M6 2v3M12 2v3M9 10v3M7.5 11.5L9 13l1.5-1.5"/>')}</button>`;
  $('#tools').innerHTML = h;
}
function syncToolButtons() {
  $('#tools [data-tool="cursor"]').setAttribute('aria-pressed', String(S.tool === 'cursor'));
  for (const g of DW_GROUPS) {
    const b = $(`#tools [data-group="${g.id}"]`), t = pickOf(g);
    b.innerHTML = DW_TOOLS[t].icon;
    b.setAttribute('aria-label', DW_TOOLS[t].name);
    b.title = DW_TOOLS[t].name + (DW_TOOLS[t].key ? ` (${DW_TOOLS[t].key})` : '');
    b.setAttribute('aria-pressed', String(S.tool === t));
  }
  for (const t of TOGGLES) $(`#tools [data-toggle="${t.k}"]`).setAttribute('aria-pressed', String(!!prefs[t.k]));
  $('#logBtn').setAttribute('aria-pressed', String(prefs.scale === 'log'));
  $('#pctBtn').setAttribute('aria-pressed', String(prefs.scale === 'pct'));
}
function pickTool(t) {
  const g = groupOf(t);
  if (g) { prefs.toolPick[g.id] = t; savePrefs(); }
  setTool(t);
}
$('#tools').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.tool) return setTool('cursor');
  if (b.dataset.group) { const t = pickOf(DW_GROUPS.find(g => g.id === b.dataset.group)); return setTool(S.tool === t ? 'cursor' : t); }
  if (b.dataset.flyout) {
    const pop = $('#toolPop'), willOpen = pop.hidden || pop.dataset.g !== b.dataset.flyout;
    closePops();
    if (!willOpen) return;
    const g = DW_GROUPS.find(x => x.id === b.dataset.flyout);
    pop.dataset.g = g.id;
    pop.innerHTML = `<div class="pop-title">${g.label}</div>` + g.tools.map(t => `<button type="button" class="pop-item" role="menuitemradio" data-pick="${t}" aria-checked="${t === pickOf(g)}">${DW_TOOLS[t].icon}${DW_TOOLS[t].name}${DW_TOOLS[t].key ? `<span class="key">${DW_TOOLS[t].key}</span>` : ''}</button>`).join('');
    openPop(b.closest('.tool-wrap'), pop, innerWidth > 900);
    return;
  }
  if (b.dataset.toggle) { prefs[b.dataset.toggle] = !prefs[b.dataset.toggle]; savePrefs(); syncToolButtons(); dwRedraw(); if (b.dataset.toggle === 'hideDw' && prefs.hideDw) dwSelect(null); return; }
  if (b.id === 'clearDw') {
    const n = DW.list.length + S.hlines.length;
    if (!n) { toast('지울 작도가 없어요.'); return; }
    dwSnap();
    DW.list = []; DW.sel = null; dwSave(); renderDwBar();
    for (const h of S.hlines) { try { mainSeries.removePriceLine(h.line); } catch {} }
    S.hlines = []; S.selHline = -1; saveHlines(); dwRedraw();
    toast(`작도 ${n}개를 지웠어요. Ctrl+Z로 되돌릴 수 있어요.`);
    return;
  }
  if (b.id === 'logBtn') return setScale(prefs.scale === 'log' ? 'n' : 'log');
  if (b.id === 'pctBtn') return setScale(prefs.scale === 'pct' ? 'n' : 'pct');
  if (b.id === 'resetBtn') {
    pzResetAll();
    for (const c of charts) c.priceScale('right').applyOptions({ autoScale: true });
    chart.timeScale().applyOptions({ barSpacing: 7 });
    const n = S.bars.length;
    if (n) chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 140), to: n + 8 });
    return;
  }
  if (b.id === 'shotBtn') screenshot();
  if (b.id === 'replayBtn') rpPick();
});
$('#toolPop').addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (!b) return; closePops(); pickTool(b.dataset.pick); });
function screenshot() {
  const shots = charts.map(c => c.takeScreenshot());
  const ratio = shots[0].width / ($('#mainChart').clientWidth || shots[0].width);
  const w = Math.max(...shots.map(s => s.width)), h = shots.reduce((a, s) => a + s.height, 0);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
  let y = 0;
  for (const s of shots) { ctx.drawImage(s, 0, y); y += s.height; }
  const now = zDate(nowSrv()), ymd = `${now.getUTCFullYear()}.${pad(now.getUTCMonth() + 1)}.${pad(now.getUTCDate())}`, hm = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
  const stamp = ymd.replace(/\./g, '') + '_' + hm.replace(':', '');
  ctx.fillStyle = C.fg; ctx.font = `600 ${Math.round(14 * ratio)}px "IBM Plex Sans KR", sans-serif`;
  ctx.fillText(`${S.base}/${S.quote} · ${spec.label} · ${cur.V.label} · ${ymd} ${hm} (${tzLabelOf(TZ)})`, 12 * ratio, 22 * ratio);
  cv.toBlob(b => {
    if (!b) { toast('이미지를 만들지 못했어요.', 'err'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = `${cur.ex}_${cur.title}_${spec.id}_${stamp}.png`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('차트 이미지를 저장했어요.');
  });
}

// ───────── 시간 단위 ─────────
function buildIvBar() {
  const favs = prefs.favIv.map(parseIv).filter(Boolean).sort((a, b) => ivApproxMs(a) - ivApproxMs(b));
  $('#ivs').innerHTML = favs.map(sp => `<button type="button" class="iv" data-iv="${sp.id}" aria-pressed="${sp.id === spec.id}" title="${sp.label} 봉${sp.native ? '' : ' (작은 봉 합성)'}">${sp.label}</button>`).join('');
  const isFav = prefs.favIv.includes(spec.id);
  $('#ivDropLabel').textContent = isFav ? '' : spec.label;
  $('#ivDrop').classList.toggle('on', !isFav);
}
function buildIvMenu() {
  const all = NATIVE.concat(prefs.customIv.filter(x => !NATIVE.includes(x))).map(parseIv).filter(Boolean);
  let h = `<div class="pop-title">시간 단위 (${cur ? cur.V.label : ''}) — ★를 누르면 툴바에 고정돼요</div>`;
  for (const u of UNIT_ORDER) {
    const items = all.filter(sp => sp.unit === u).sort((a, b) => a.n - b.n);
    if (!items.length) continue;
    h += `<div class="iv-group"><div class="iv-gtitle">${UNITS[u].label}</div><div class="iv-grid">` + items.map(sp => {
      const fav = prefs.favIv.includes(sp.id);
      return `<div class="iv-cell${sp.id === spec.id ? ' cur' : ''}"><button type="button" class="iv-pick" data-iv="${sp.id}" title="${sp.native ? '바이낸스 기본 단위' : `${parseIv(sp.base).label} 봉 ${sp.k}개를 합쳐 만든 단위`}">${sp.label}</button>`
        + `<button type="button" class="iv-star" data-star="${sp.id}" aria-pressed="${fav}" aria-label="${sp.label} 툴바 ${fav ? '고정 해제' : '고정'}" title="${fav ? '툴바에서 빼기' : '툴바에 고정'}">${STAR}</button>`
        + (prefs.customIv.includes(sp.id) ? `<button type="button" class="iv-rm" data-rmiv="${sp.id}" aria-label="${sp.label} 목록에서 삭제" title="목록에서 삭제">${ICON_X}</button>` : '') + '</div>';
    }).join('') + '</div></div>';
  }
  h += `<form class="iv-add" id="ivAddForm"><span class="lbl">직접 추가</span><input class="field num-in" id="ivAddN" type="number" min="1" max="9999" placeholder="예: 10" aria-label="숫자" required>`
    + `<select class="field" id="ivAddU" aria-label="단위">${UNIT_ORDER.map(u => `<option value="${u}"${u === 'm' ? ' selected' : ''}>${UNITS[u].label}</option>`).join('')}</select><button type="submit" class="btn-primary">추가</button></form>`
    + '<p class="iv-note">바이낸스에 없는 단위(10분, 45분, 2일 등)는 더 작은 봉을 합쳐서 만들어요. 차트에서 숫자를 바로 쳐도 바뀌어요.</p>';
  $('#ivPop').innerHTML = h;
}
function selectIv(id, fav) {
  const sp = parseIv(id);
  if (!sp) return;
  if (!sp.native && !prefs.customIv.includes(sp.id)) prefs.customIv.push(sp.id);
  if (fav && !prefs.favIv.includes(sp.id)) prefs.favIv.push(sp.id);
  savePrefs();
  if (sp.id !== spec.id || S.loading) load(prefs.sym, sp.id); else syncControls();
}
$('#ivs').addEventListener('click', e => { const b = e.target.closest('[data-iv]'); if (b) selectIv(b.dataset.iv); });
$('#ivPop').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.iv) { closePops(); selectIv(b.dataset.iv); }
  else if (b.dataset.star) {
    const id = b.dataset.star;
    if (prefs.favIv.includes(id)) { if (prefs.favIv.length <= 1) { toast('툴바에 하나는 남겨 둬야 해요.'); return; } prefs.favIv = prefs.favIv.filter(x => x !== id); }
    else prefs.favIv.push(id);
    savePrefs(); buildIvMenu(); buildIvBar();
  } else if (b.dataset.rmiv) {
    const id = b.dataset.rmiv;
    prefs.customIv = prefs.customIv.filter(x => x !== id);
    if (prefs.favIv.length > 1) prefs.favIv = prefs.favIv.filter(x => x !== id);
    savePrefs(); buildIvMenu(); buildIvBar();
  }
});
$('#ivPop').addEventListener('submit', e => {
  e.preventDefault();
  const n = Math.round(+$('#ivAddN').value), r = n >= 1 ? canonIv(n, $('#ivAddU').value) : { err: '1 이상의 숫자를 넣으세요.' };
  if (r.err) { toast(r.err, 'err'); return; }
  closePops(); selectIv(r.id, true);
  toast(`${parseIv(r.id).label} 단위를 추가했어요.`);
});
function openIvQuick(first) {
  const q = $('#ivQuick'), inp = $('#ivQuickIn');
  q.hidden = false; inp.value = first || '';
  $('#ivQuickHint').textContent = '숫자만 쓰면 분 단위 · 예: 10, 45분, 4h, 2일, 3개월 · Enter';
  $('#ivQuickHint').classList.remove('err');
  inp.focus();
}
$('#ivQuickIn').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); $('#ivQuick').hidden = true; return; }
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const r = parseUserIv($('#ivQuickIn').value);
  if (r.err) { $('#ivQuickHint').textContent = r.err; $('#ivQuickHint').classList.add('err'); return; }
  $('#ivQuick').hidden = true;
  selectIv(r.id);
});
$('#ivQuickIn').addEventListener('blur', () => setTimeout(() => { $('#ivQuick').hidden = true; }, 150));

// ───────── 차트 유형 ─────────
const CHART_TYPES = [['candle', '캔들'], ['hollow', '속 빈 캔들'], ['heikin', '하이킨 아시'], ['bar', '바'], ['line', '라인'], ['step', '계단식 라인'], ['markers', '점 찍힌 라인'], ['area', '영역'], ['baseline', '베이스라인']];
function buildTypeMenu() {
  $('#typePop').innerHTML = '<div class="pop-title">차트 유형</div>' + CHART_TYPES.map(([id, l]) => `<button type="button" class="pop-item type-item" role="menuitemradio" data-type="${id}" aria-checked="${id === prefs.type}">${l}<span class="check">✓</span></button>`).join('');
}
$('#typePop').addEventListener('click', e => {
  const b = e.target.closest('[data-type]');
  if (!b) return;
  prefs.type = b.dataset.type; savePrefs(); closePops(); syncControls();
  keepRange(() => { rebuildIndicators(); if (S.bars.length && !S.loading) renderAll(); });
});
function syncControls() {
  buildIvBar();
  if (!$('#ivPop').hidden) buildIvMenu();
  $('#typeLabel').textContent = CHART_TYPES.find(t => t[0] === prefs.type)[1];
  $$('#typePop [data-type]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.type === prefs.type)));
  $('#themeBtn').innerHTML = prefs.theme === 'dark' ? '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="9" r="3.2"/><path d="M9 1.8v1.6M9 14.6v1.6M1.8 9h1.6M14.6 9h1.6M3.9 3.9l1.1 1.1M13 13l1.1 1.1M3.9 14.1L5 13M13 5l1.1-1.1"/></svg>' : '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 11.2A6 6 0 0 1 6.8 3.5a6 6 0 1 0 7.7 7.7z"/></svg>';
  $('#themeBtn').setAttribute('aria-label', prefs.theme === 'dark' ? '밝은 테마로 전환' : '어두운 테마로 전환');
  syncToolButtons();
}
$('#themeBtn').addEventListener('click', () => {
  prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark'; savePrefs();
  applyTheme();
  keepRange(() => { chart.applyOptions(mainOptions()); rebuildIndicators(); if (S.bars.length && !S.loading) renderAll(); });
  syncControls(); renderDwBar();
});

// ───────── 지표 창 ─────────
let indCat = 'all';
function applyInds() {
  normalizePanes();
  savePrefs();
  keepRange(() => { rebuildIndicators(); if (S.bars.length && !S.loading) renderAll(); });
  if (!$('#indDlg').hidden) { renderIndCats(); renderIndList(); }
}
function nextMaColor() { const used = new Set(prefs.inds.filter(i => i.type === 'ma').map(i => i.colors.v)); return MA_COLORS.find(c => !used.has(c)) || MA_COLORS[prefs.inds.length % MA_COLORS.length]; }
function addInst(inst) {
  if (prefs.inds.length >= 60) { toast('지표는 60개까지 넣을 수 있어요.', 'err'); return; }
  if (inst.type === 'ma' && !inst.colors.v) inst.colors.v = nextMaColor();
  prefs.inds.push(inst); applyInds();
  toast(`${TYPES[inst.type].short(inst.p)} 추가했어요.`);
}
function openIndDlg(cat) {
  closePops();
  if (cat) indCat = cat;
  $('#indDlg').hidden = false;
  $('#indSearch').value = '';
  renderIndCats(); renderIndList();
  setTimeout(() => $('#indSearch').focus(), 0);
}
function renderIndCats() {
  const cnt = id => id === 'applied' ? prefs.inds.length : id === 'all' ? CATALOG.length : CATALOG.filter(c => c.cat === id).length;
  $('#indCats').innerHTML = CATS.map(([id, l]) => `<button type="button" data-cat="${id}" aria-pressed="${id === indCat}">${l}<small>${cnt(id)}</small></button>`).join('');
}
function renderIndList() {
  const q = $('#indSearch').value.trim().toLowerCase(), list = $('#indList');
  if (indCat === 'applied' && !q) {
    list.innerHTML = prefs.inds.map(i => {
      const d = TYPES[i.type], pl = d.plots(i.p).find(p => !p.nocolor) || d.plots(i.p)[0], col = i.colors[pl.k] || pl.color, hid = i.hidden;
      return `<li class="ind-item ap-item${hid ? ' off' : ''}" data-uid="${i.uid}"><span class="ap-swatch" style="background:${col}"></span><span class="ind-name">${esc(d.short(i.p))}</span><span class="ind-en">${d.name}</span><span class="badge">${placeName(i.pane)}</span>`
        + `<span class="ap-btns"><button type="button" data-act="move" aria-label="위치 옮기기" title="위치 옮기기">${ICON_MOVE}</button><button type="button" data-act="vis" aria-label="${hid ? '보이기' : '숨기기'}" title="${hid ? '보이기' : '숨기기'}">${hid ? ICON_EYE_OFF : ICON_EYE}</button><button type="button" data-act="set" aria-label="설정" title="설정">${ICON_GEAR}</button><button type="button" data-act="del" aria-label="삭제" title="삭제">${ICON_X}</button></span></li>`;
    }).join('') + `${prefs.inds.length ? '' : '<li class="empty">적용한 지표가 없어요. 왼쪽 분류에서 골라 추가하세요.</li>'}<li class="ap-foot"><button type="button" class="btn-ghost" data-indall="reset">기본 구성으로</button><button type="button" class="btn-ghost" data-indall="clear">모두 지우기</button></li>`;
    return;
  }
  const items = CATALOG.map((c, idx) => ({ c, idx })).filter(({ c }) => (q ? (c.label + ' ' + c.en).toLowerCase().includes(q) : indCat === 'all' || c.cat === indCat));
  list.innerHTML = items.map(({ c, idx }) => {
    const n = prefs.inds.filter(i => i.type === c.type && (!c.preset || i.p.kind === c.preset.kind)).length;
    return `<li><button type="button" class="ind-item" data-add="${idx}"><span class="ind-name">${c.label}</span><span class="ind-en">${esc(c.en)}</span><span class="badge">${TYPES[c.type].pane ? '아래 창' : '차트 위'}</span><span class="ind-cnt">${n ? '적용 ' + n : ''}</span></button></li>`;
  }).join('') || '<li class="empty">찾는 지표가 없어요. 다른 이름으로 검색해 보세요.</li>';
}
$('#indBtn').addEventListener('click', () => openIndDlg());
$('#indCats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; indCat = b.dataset.cat; $('#indSearch').value = ''; renderIndCats(); renderIndList(); });
$('#indSearch').addEventListener('input', renderIndList);
$('#indList').addEventListener('click', e => {
  const a = e.target.closest('[data-add]');
  if (a) { const c = CATALOG[+a.dataset.add]; addInst(mk(c.type, c.preset)); return; }
  const all = e.target.closest('[data-indall]');
  if (all) {
    if (all.dataset.indall === 'reset') { prefs.inds = DEFAULT_INDS(); applyInds(); toast('지표를 기본 구성으로 되돌렸어요.'); }
    else { prefs.inds = []; applyInds(); toast('지표를 모두 지웠어요.'); }
  }
});
function buildMq() {
  $('#mqKind').innerHTML = MA_OPTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
  $('#mqSrc').innerHTML = SRC_OPTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
  $('#mqChips').insertAdjacentHTML('beforeend', [5, 10, 20, 60, 120, 200].map(n => `<button type="button" class="chip" data-len="${n}">${n}</button>`).join(''));
}
const addMa = len => addInst(mk('ma', { kind: $('#mqKind').value, len, src: $('#mqSrc').value }));
$('#mqAdd').addEventListener('click', () => { const n = Math.round(+$('#mqLen').value); if (!(n >= 1 && n <= 2000)) { toast('기간은 1에서 2000 사이로 넣으세요.', 'err'); return; } addMa(n); });
$('#mqLen').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#mqAdd').click(); } });
$('#mqChips').addEventListener('click', e => { const b = e.target.closest('[data-len]'); if (b) addMa(+b.dataset.len); });

// 범례·적용 목록의 눈/설정/삭제 버튼
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const host = b.closest('[data-uid]');
  if (!host) return;
  const inst = prefs.inds.find(i => i.uid === host.dataset.uid);
  if (!inst) return;
  if (b.dataset.act === 'del') { prefs.inds = prefs.inds.filter(i => i !== inst); applyInds(); toast(`${TYPES[inst.type].short(inst.p)} 지표를 지웠어요.`); }
  else if (b.dataset.act === 'vis') { inst.hidden = !inst.hidden; applyInds(); }
  else if (b.dataset.act === 'set') openSettings(inst.uid);
  else if (b.dataset.act === 'move') openMoveMenu(inst.uid, b);
});

// ───────── 지표 위치 옮기기 ─────────
// 메인 차트 ↔ 아래 창, 다른 창에 합치기, 새 창으로 분리, 창 순서 바꾸기
let movingUid = null;
const placeName = key => key === 'main' ? '메인 차트' : `창 ${prefs.panes.indexOf(key) + 1}`;
function openMoveMenu(uid, btn) {
  const inst = prefs.inds.find(i => i.uid === uid);
  if (!inst) return;
  movingUid = uid;
  const cur = inst.pane, idx = prefs.panes.indexOf(cur), alone = cur !== 'main' && !prefs.inds.some(i => i !== inst && i.pane === cur);
  const item = (mv, label) => `<button type="button" class="pop-item" data-mv="${mv}">${label}</button>`;
  let h = `<div class="pop-title">${esc(TYPES[inst.type].short(inst.p))} — 지금 ${placeName(cur)}</div>`;
  if (cur !== 'main') h += item('main', '메인 차트(가격 차트)로 옮기기');
  for (const k of prefs.panes) if (k !== cur) h += item('into:' + k, `${placeName(k)}에 합치기 <span class="note">${esc(paneLabel(k))}</span>`);
  if (!(alone && idx === 0)) h += item('new:0', '새 창으로 — 맨 위');
  if (!(alone && idx === prefs.panes.length - 1)) h += item('new:' + prefs.panes.length, '새 창으로 — 맨 아래');
  if (cur !== 'main') {
    if (idx > 0) h += item('up', '이 창을 한 칸 위로');
    if (idx < prefs.panes.length - 1) h += item('down', '이 창을 한 칸 아래로');
  }
  h += '<p class="pop-hint">범례의 지표 이름을 끌어서 다른 창이나 창 사이에 놓아도 돼요.</p>';
  const pop = $('#movePop');
  closePops();
  pop.innerHTML = h;
  openPop(btn, pop);
}
function doMove(uid, mv) {
  const inst = prefs.inds.find(i => i.uid === uid);
  if (!inst) return;
  const [kind, arg] = mv.split(':'), old = inst.pane;
  const oldEmpty = old !== 'main' && !prefs.inds.some(i => i !== inst && i.pane === old);
  if (kind === 'main') inst.pane = 'main';
  else if (kind === 'into') inst.pane = arg;
  else if (kind === 'new') {
    const key = newPaneKey(), pos = Math.max(0, Math.min(prefs.panes.length, +arg));
    prefs.panes.splice(pos, 0, key);
    if (oldEmpty && prefs.paneH[old]) prefs.paneH[key] = prefs.paneH[old];
    inst.pane = key;
  } else if (kind === 'up' || kind === 'down') {
    const i = prefs.panes.indexOf(old), j = kind === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= prefs.panes.length) return;
    [prefs.panes[i], prefs.panes[j]] = [prefs.panes[j], prefs.panes[i]];
  }
  if (inst.pane === old && kind !== 'up' && kind !== 'down') return;
  applyInds();
  toast(`${TYPES[inst.type].short(inst.p)} → ${placeName(inst.pane)}`);
}
$('#movePop').addEventListener('click', e => { const b = e.target.closest('[data-mv]'); if (!b) return; closePops(); doMove(movingUid, b.dataset.mv); });

// 범례 이름 끌어다 놓기: 창 가운데 = 그 창에 합치기, 창 위·아래 끝 = 그 자리에 새 창
let dragInd = null;
document.addEventListener('pointerdown', e => {
  const nm = e.target.closest('.lg-row .lg-name');
  if (!nm || e.button !== 0) return;
  e.preventDefault();
  dragInd = { uid: nm.closest('.lg-row').dataset.uid, x0: e.clientX, y0: e.clientY, on: false, target: null };
});
function dropTarget(x, y) {
  const el = document.elementFromPoint(x, y), pane = el && el.closest('.chart-area .pane');
  if (!pane) return null;
  const key = pane.dataset.pane, r = pane.getBoundingClientRect(), f = (y - r.top) / r.height;
  if (key === 'main') return f > 0.8 ? { kind: 'new', pos: 0, rect: r, edge: 'bottom' } : { kind: 'into', key, rect: r };
  const idx = prefs.panes.indexOf(key);
  if (f < 0.25) return { kind: 'new', pos: idx, rect: r, edge: 'top' };
  if (f > 0.75) return { kind: 'new', pos: idx + 1, rect: r, edge: 'bottom' };
  return { kind: 'into', key, rect: r };
}
function showDropMark(t) {
  const m = $('#dropMark');
  if (!t) { m.hidden = true; return; }
  const r = t.rect;
  m.hidden = false;
  m.className = 'drop-mark ' + (t.kind === 'into' ? 'into' : 'line');
  m.style.left = r.left + 'px'; m.style.width = r.width + 'px';
  if (t.kind === 'into') { m.style.top = r.top + 'px'; m.style.height = r.height + 'px'; m.textContent = `${placeName(t.key)}에 합치기`; }
  else { m.style.top = (t.edge === 'top' ? r.top : r.bottom) - 2 + 'px'; m.style.height = '4px'; m.textContent = ''; }
}
window.addEventListener('pointermove', e => {
  if (!dragInd) return;
  if (!dragInd.on) {
    if (Math.hypot(e.clientX - dragInd.x0, e.clientY - dragInd.y0) < 6) return;
    const inst = prefs.inds.find(i => i.uid === dragInd.uid);
    if (!inst) { dragInd = null; return; }
    dragInd.on = true;
    $('#dragGhost').textContent = TYPES[inst.type].short(inst.p);
    $('#dragGhost').hidden = false;
    document.body.classList.add('ind-dragging');
  }
  const g = $('#dragGhost');
  g.style.left = e.clientX + 14 + 'px'; g.style.top = e.clientY + 10 + 'px';
  dragInd.target = dropTarget(e.clientX, e.clientY);
  showDropMark(dragInd.target);
});
function endIndDrag() {
  if (!dragInd) return;
  const d = dragInd;
  dragInd = null;
  $('#dragGhost').hidden = true; $('#dropMark').hidden = true;
  document.body.classList.remove('ind-dragging');
  if (!d.on || !d.target) return;
  const t = d.target;
  if (t.kind === 'into') doMove(d.uid, t.key === 'main' ? 'main' : 'into:' + t.key);
  else doMove(d.uid, 'new:' + t.pos);
}
window.addEventListener('pointerup', endIndDrag);
window.addEventListener('pointercancel', () => { if (dragInd) { dragInd.target = null; endIndDrag(); } });

// ───────── 지표 설정 ─────────
let setUid = null;
function openSettings(uid) {
  const inst = prefs.inds.find(i => i.uid === uid);
  if (!inst) return;
  setUid = uid;
  const def = TYPES[inst.type];
  $('#setTitle').textContent = `${def.name} 설정`;
  let h = '';
  for (const p of def.params) {
    const v = inst.p[p.k];
    if (p.t === 'sel') h += `<label class="fld"><span>${p.label}</span><select class="field" data-k="${p.k}">${p.opts.map(([ov, ol]) => `<option value="${ov}"${String(ov) === String(v) ? ' selected' : ''}>${ol}</option>`).join('')}</select></label>`;
    else if (p.t === 'bool') h += `<label class="fld check"><input type="checkbox" data-k="${p.k}"${v ? ' checked' : ''}><span>${p.label}</span></label>`;
    else h += `<label class="fld"><span>${p.label}</span><input class="field" data-k="${p.k}" type="number" inputmode="decimal" min="${p.min}" max="${p.max}" step="${p.t === 'int' ? 1 : p.step}" value="${v}"></label>`;
  }
  const R = RT.get(inst.uid), plots = def.plots(inst.p).filter(pl => !pl.nocolor);
  if (plots.length) h += '<div class="fld-sep">색과 선 두께</div>' + plots.map(pl => {
    const w = inst.widths[pl.k] || pl.width || inst.w || 1;
    return `<div class="fld plot-row"><input type="color" data-color="${pl.k}" value="${inst.colors[pl.k] || pl.color}" aria-label="${esc(pl.label)} 색"><span>${esc(pl.label)}</span>`
      + (pl.type === 'hist' ? '' : `<select class="field" data-pw="${pl.k}" aria-label="${esc(pl.label)} 두께">${[1, 2, 3, 4].map(x => `<option value="${x}"${x === w ? ' selected' : ''}>${x}px</option>`).join('')}</select>`) + '</div>';
  }).join('');
  if (R) h += `<p class="fld-note">지금 위치: ${placeName(inst.pane)} · 범례의 이름을 끌어서 옮길 수 있어요.</p>`;
  $('#setForm').innerHTML = h;
  $('#setDlg').hidden = false;
}
$('#setForm').addEventListener('submit', e => e.preventDefault());
$('#setForm').addEventListener('change', e => {
  const inst = prefs.inds.find(i => i.uid === setUid);
  if (!inst) return;
  const t = e.target, def = TYPES[inst.type], before = def.plots(inst.p).map(p => p.k).join();
  if (t.dataset.k) {
    const pd = def.params.find(p => p.k === t.dataset.k);
    let v = t.value;
    if (pd.t === 'bool') v = t.checked;
    else if (pd.t !== 'sel') { v = +v; if (!isFinite(v)) v = pd.def; v = Math.min(pd.max, Math.max(pd.min, v)); if (pd.t === 'int') v = Math.round(v); t.value = v; }
    inst.p[pd.k] = v;
  } else if (t.dataset.color) inst.colors[t.dataset.color] = t.value;
  else if (t.dataset.pw) inst.widths[t.dataset.pw] = +t.value;
  applyInds();
  if (def.plots(inst.p).map(p => p.k).join() !== before) openSettings(inst.uid);
});
$('#setReset').addEventListener('click', () => {
  const inst = prefs.inds.find(i => i.uid === setUid);
  if (!inst) return;
  const keep = inst.type === 'ma' ? { v: inst.colors.v } : {};
  inst.p = defaultsOf(inst.type); inst.colors = keep; inst.widths = {}; inst.w = TYPES[inst.type].w || 1;
  applyInds(); openSettings(inst.uid);
});

// ───────── 심볼 검색 (거래소 · 시장 고르기) ─────────
let searchMode = 'open', searchQuote = 'ALL', searchSel = 0, searchItems = [], lastFocus = null, searchVk = 'binance:spot';
const TK = {}; // 거래소·시장별 종목 목록
const QTABS = ['ALL', 'USDT', 'USDC', 'FDUSD', 'BTC', 'ETH', 'BNB'];
async function loadTickers(vk) {
  if (TK[vk] && Date.now() - TK[vk].at < 60000) return TK[vk]; // 1분이 지나면 가격을 새로 받는다
  const V = VENUES[vk], d = await V.tickers(), px = {};
  for (const x of d) { const [b, q] = V.split(x.native); if (q === 'USDT') px[b] = x.c; }
  const usd = q => STABLE.has(q) ? 1 : (px[q] || 0);
  TK[vk] = d.filter(x => x.c > 0).map(x => {
    const [base, quote] = V.split(x.native);
    return { sid: sidOf(vk, x.native), native: x.native, base, quote, title: V.disp(x.native), last: x.c, pct: x.o ? (x.c - x.o) / x.o * 100 : 0, usd: (x.qv || 0) * usd(quote) };
  });
  TK[vk].at = Date.now();
  return TK[vk];
}
function buildVtabs() {
  const [ex, mk] = searchVk.split(':');
  $('#vtabs').innerHTML = '<div class="seg" role="group" aria-label="거래소">' + Object.keys(EX_LABEL).map(e => `<button type="button" data-vex="${e}" aria-pressed="${e === ex}">${EX_LABEL[e]}</button>`).join('') + '</div>'
    + '<div class="seg" role="group" aria-label="시장">' + ['spot', 'perp'].map(m => `<button type="button" data-vmk="${m}" aria-pressed="${m === mk}">${MK_LABEL[m]}</button>`).join('') + '</div>';
}
async function showVenueList() {
  buildVtabs(); buildQtabs();
  const vk = searchVk;
  if (TK[vk]) renderSearch(); // 받아 둔 목록을 먼저 보여 주고 오래됐으면 새로 받는다
  else $('#searchList').innerHTML = `<li class="empty">${VENUES[vk].label} 종목 목록 불러오는 중…</li>`;
  try { await loadTickers(vk); } catch (e) { if (vk === searchVk && !TK[vk]) $('#searchList').innerHTML = `<li class="empty">${VENUES[vk].label} 목록을 불러오지 못했어요. 인터넷 연결을 확인하세요.</li>`; return; }
  if (vk === searchVk) { const keep = searchSel; renderSearch(); if (keep) moveSel(keep); }
}
function renderSearch() {
  const list = TK[searchVk];
  if (!list) return;
  const q = $('#searchInput').value.toUpperCase().replace(/[\s/\-_.]/g, ''), scored = [];
  for (const t of list) {
    if (searchQuote !== 'ALL' && t.quote !== searchQuote) continue;
    const key = t.base + t.quote;
    let r;
    if (!q) r = 1; else if (key === q || t.base === q) r = 0; else if (key.startsWith(q) || t.base.startsWith(q)) r = 1; else if (key.includes(q)) r = 2; else continue;
    scored.push([r, t]);
  }
  scored.sort((a, b) => a[0] - b[0] || b[1].usd - a[1].usd);
  searchItems = scored.slice(0, 80).map(x => x[1]); searchSel = 0;
  const inWatch = new Set(prefs.watch), V = VENUES[searchVk];
  $('#searchList').innerHTML = searchItems.map((t, i) => `<li role="option" id="so${i}" class="s-row${i === 0 ? ' sel' : ''}" data-s="${esc(t.sid)}" aria-selected="${i === 0}">
    <span class="coin" style="--h:${hue(t.base)}">${esc(t.base.slice(0, 1))}</span>
    <span class="s-name"><span><b>${esc(t.base)}</b><small>/${esc(t.quote)}${V.mk === 'perp' ? ' 무기한' : ''}</small></span><span class="s-sub">${V.label}${searchMode === 'add' && inWatch.has(t.sid) ? ' · 관심 종목에 있음' : ''} · 거래대금 $${fvol(t.usd)}</span></span>
    <span class="s-last num">${fmt(t.last, autoPrec(t.last))}</span><span class="s-chg num ${t.pct >= 0 ? 'up' : 'down'}">${fpct(t.pct)}</span></li>`).join('') || '<li class="empty">일치하는 종목이 없어요.</li>';
  $('#searchInput').setAttribute('aria-activedescendant', searchItems.length ? 'so0' : '');
  $('#searchList').scrollTop = 0;
}
function moveSel(d) {
  if (!searchItems.length) return;
  searchSel = (searchSel + d + searchItems.length) % searchItems.length;
  $$('#searchList .s-row').forEach((li, i) => { li.classList.toggle('sel', i === searchSel); li.setAttribute('aria-selected', String(i === searchSel)); });
  const c = $('#so' + searchSel);
  if (c) c.scrollIntoView({ block: 'nearest' });
  $('#searchInput').setAttribute('aria-activedescendant', 'so' + searchSel);
}
const buildQtabs = () => {
  const qs2 = VENUES[searchVk].mk === 'perp' ? ['ALL', 'USDT', 'USDC'] : QTABS;
  if (!qs2.includes(searchQuote)) searchQuote = 'ALL';
  $('#qtabs').innerHTML = qs2.map(q => `<button type="button" data-q="${q}" aria-pressed="${q === searchQuote}">${q === 'ALL' ? '전체' : q}</button>`).join('');
};
function openSearch(mode, initial) {
  closePops();
  lastFocus = document.activeElement; searchMode = mode;
  searchVk = cur ? cur.vk : 'binance:spot';
  $('#searchTitle').textContent = mode === 'add' ? '관심 종목 추가' : mode === 'cmp' ? '비교할 종목 고르기' : '종목 검색';
  $('#search').hidden = false;
  const inp = $('#searchInput');
  inp.value = initial || ''; inp.focus();
  showVenueList();
}
function closeSearch() {
  if ($('#search').hidden) return;
  $('#search').hidden = true;
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
function choose(sid) {
  const mode = searchMode;
  closeSearch();
  const s = sidInfo(sid);
  if (!s) return;
  if (mode === 'cmp') return addCompare(sid);
  if (mode === 'add') {
    const name = `${s.V.disp(s.native)} (${s.V.label})`;
    if (prefs.watch.includes(sid)) { toast(`${name} · 이미 관심 종목에 있어요.`); return; }
    prefs.watch.push(sid); savePrefs();
    const t = TK[s.vk] && TK[s.vk].find(x => x.sid === sid);
    if (t) watchCache[sid] = { c: t.last, o: t.last / (1 + t.pct / 100) };
    renderWatch(); resubscribe();
    fetchPrec([sid]).then(() => { const r = watchRows.get(sid); if (r && watchCache[sid]) updateWatchRow(sid, r, false); });
    toast(`${name} · 관심 종목에 추가했어요.`);
  } else if (sid !== cur.sid) load(sid, prefs.interval);
}
$('#vtabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const [ex, mk] = searchVk.split(':');
  searchVk = (b.dataset.vex || ex) + ':' + (b.dataset.vmk || mk);
  showVenueList();
  $('#searchInput').focus();
});
$('#qtabs').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (!b) return; searchQuote = b.dataset.q; buildQtabs(); renderSearch(); $('#searchInput').focus(); });
$('#searchInput').addEventListener('input', renderSearch);
$('#searchInput').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
  else if (e.key === 'Enter') { e.preventDefault(); const t = searchItems[searchSel]; if (t) choose(t.sid); }
});
$('#searchList').addEventListener('click', e => { const li = e.target.closest('[data-s]'); if (li) choose(li.dataset.s); });
$('#symBtn').addEventListener('click', () => openSearch('open', ''));
$('#addWatch').addEventListener('click', () => openSearch('add', ''));

// ───────── 모달 공통 · 단축키 ─────────
function closeModal(id) { if (id === 'search') closeSearch(); else $('#' + id).hidden = true; if (id === 'syncDlg') clearHash(); }
$$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
$$('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m) closeModal(m.id); }));
$('#toRT').addEventListener('click', () => chart.timeScale().scrollToRealTime());
$('#retryBtn').addEventListener('click', () => load(prefs.sym, prefs.interval));
document.addEventListener('keydown', e => {
  const open = ['setDlg', 'syncDlg', 'chartDlg', 'alertDlg', 'indDlg', 'search'].find(id => !$('#' + id).hidden);
  if (open) { if (e.key === 'Escape') { e.preventDefault(); closeModal(open); } return; }
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  if (typing) return;
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); dwUndo(); return; }
  if (RP.on && e.shiftKey && e.key === 'ArrowRight') { e.preventDefault(); rpPause(); rpStep(); return; }
  if (e.key === 'Escape' && RP.picking) { rpCancelPick(); return; }
  if (e.key === 'Escape' && DW.qm) { DW.qm = null; $('#drawHint').hidden = true; dwRedraw(); return; }
  if (e.key === 'Escape') { closePops(); if (DW.draft || S.tool !== 'cursor') setTool('cursor'); else { dwSelect(null); selectHline(-1); } return; }
  if (e.ctrlKey || e.metaKey) return;
  if (e.altKey) {
    const map = { KeyH: 'hline', KeyT: 'trend', KeyV: 'vline', KeyF: 'fib', KeyM: 'measure' };
    if (map[e.code]) { e.preventDefault(); pickTool(map[e.code]); return; }
    const act = { KeyA: () => { if (!EMBED) openAlerts('price'); }, KeyR: () => $('#resetBtn').click(), KeyG: openGoto, KeyL: () => setScale(prefs.scale === 'log' ? 'n' : 'log'), KeyP: () => setScale(prefs.scale === 'pct' ? 'n' : 'pct'), KeyI: toggleInvert }[e.code];
    if (act) { e.preventDefault(); act(); }
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (DW.sel) { e.preventDefault(); dwDelete(DW.sel); return; }
    if (S.selHline >= 0) { e.preventDefault(); removeHline(S.selHline); return; }
  }
  if (e.key === '/') { e.preventDefault(); openIndDlg(); return; }
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); openIvQuick(e.key); return; }
  if (e.key.length === 1 && /[a-z]/i.test(e.key)) { e.preventDefault(); openSearch('open', e.key.toUpperCase()); }
});
window.addEventListener('online', () => WSM.kickAll());

// ───────── 시작 ─────────
if (!EMBED && /^https?:$/.test(location.protocol)) { // 웹 주소로 열었을 때만: 홈 화면에 추가하면 앱처럼 열리게
  const l = document.createElement('link');
  l.rel = 'manifest'; l.href = 'manifest.webmanifest';
  document.head.append(l);
}
linkChart(chart, $('#mainPane'));
buildTools(); buildTypeMenu(); buildMq();
setTab(prefs.tab);
if (!EMBED) { renderWatch(); fetchWatchInit(); }
rebuildIndicators();
load(prefs.sym, prefs.interval);
