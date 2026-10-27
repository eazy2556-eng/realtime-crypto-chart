
// ───────── 알림 (트레이딩뷰의 얼러트) ─────────
// 가격 · 지표 선 · 작도 선을 지나가면 소리 · 화면 · 브라우저 알림으로 알려 준다.
// 서버가 없어서 이 앱(탭)이 열려 있어야 확인된다. 가격 알림은 다른 종목도 실시간 시세를 따로 받아 확인한다.
// 알림 조건은 설정(prefs.alerts, 기기끼리 연동됨)에, 울린 횟수·기록은 기기마다 따로 둔다.
const AL_COND = { up: '위로 돌파', down: '아래로 돌파', cross: '위·아래 돌파' };
const AL_FREQ_P = { once: '한 번만', every: '매번 (1분에 한 번까지)' };
const AL_FREQ_I = { once: '한 번만', bar: '봉마다 한 번', close: '봉 마감 때만' };
const AL_DRAW = ['trend', 'arrow', 'ray', 'ext', 'hray', 'crossline', 'channel']; // 알림을 걸 수 있는 작도
const ICON_BELL = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5V8a4.5 4.5 0 0 1 9 0v4.5l1.5 1.5H3z"/><path d="M7.5 15.5a1.5 1.5 0 0 0 3 0"/></svg>';
const AL = { st: store.get('bc:alertState', {}) || {}, log: store.get('bc:alertLog', []) || [], last: {}, mem: {}, bars: null, unseen: 0, kind: 'price' };
const alSaveSt = () => store.set('bc:alertState', AL.st);
const alNum = v => (+v).toLocaleString('en-US', { maximumFractionDigits: Math.abs(v) >= 1000 ? 2 : Math.abs(v) >= 1 ? 4 : 8 });
const plotName = (R, pl) => { const s = R.def.short(R.inst.p); return s.includes(pl.label) ? s : `${s} ${pl.label}`; }; // 'RSI 14 RSI' 처럼 겹치지 않게
const alSym = sid => { const s = sidInfo(sid); return s ? `${s.V.disp(s.native)} ${EX_SHORT[s.V.ex]}${s.V.mk === 'perp' ? ' 선물' : ''}` : sid; };
const alIvLabel = iv => (parseIv(iv) || { label: iv }).label;
function alDesc(a) {
  const sym = alSym(a.sid);
  if (a.kind === 'price') return `${sym} · 가격 ${alNum(a.price)} ${AL_COND[a.cond]}`;
  if (a.kind === 'ind') return `${sym} ${alIvLabel(a.iv)} · ${a.ind.name} → ${a.tk ? a.tname : alNum(a.tv)} ${AL_COND[a.cond]}`;
  return `${sym} · ${a.dw.name} 선을 가격이 ${AL_COND[a.cond]}`;
}
const crossed = (cond, a0, a1, b0, b1) => { const d0 = a0 - b0, d1 = a1 - b1; return (cond !== 'down' && d0 < 0 && d1 >= 0) || (cond !== 'up' && d0 > 0 && d1 <= 0); };
// 가격 알림이 걸린 종목 중 관심 종목에 없는 것은 시세를 따로 받는다
const alertSids = () => EMBED ? [] : [...new Set(prefs.alerts.filter(a => a.on && a.kind === 'price').map(a => a.sid))];
function alertTick(sid, p) { // 체결(지금 종목)·시세(다른 종목)가 들어올 때
  if (EMBED || !isN(p)) return;
  const prev = AL.last[sid];
  AL.last[sid] = p;
  if (prev == null || prev === p) return;
  for (const a of prefs.alerts) {
    if (!a.on || a.sid !== sid) continue;
    if (a.kind === 'price') { if (crossed(a.cond, prev, p, a.price, a.price)) alFire(a, `현재 ${alNum(p)}`); }
    else if (a.kind === 'draw' && a.freq !== 'close' && sid === cur.sid) {
      const d = alDrawing(a);
      if (d) for (const lp of dwLinePrices(d, S.lastTrade ? S.lastTrade.T : nowSrv())) if (crossed(a.cond, prev, p, lp, lp)) { alFire(a, `현재 ${alNum(p)}`); break; }
    }
  }
}
function alDrawing(a) { return cur && a.dw.key === symKey() ? DW.list.find(x => x.id === a.dw.id) || null : null; }
function dwLinePrices(d, t) { // 작도 선이 t 시점에 지나는 가격들
  const L = tToLogical(t);
  if (L == null || !d.pts.length) return [];
  const lg = prefs.scale === 'log';
  const at = (q0, q1) => {
    const l0 = tToLogical(q0.t), l1 = tToLogical(q1.t);
    if (l0 == null || l1 == null || l0 === l1) return null;
    const k = (L - l0) / (l1 - l0);
    return lg && q0.p > 0 && q1.p > 0 ? Math.exp(Math.log(q0.p) + (Math.log(q1.p) - Math.log(q0.p)) * k) : q0.p + (q1.p - q0.p) * k;
  };
  const [a, b, c] = d.pts;
  let out = [];
  switch (d.type) {
    case 'hray': out = t >= a.t ? [a.p] : []; break;
    case 'crossline': out = [a.p]; break;
    case 'trend': case 'arrow': out = b && t >= Math.min(a.t, b.t) && t <= Math.max(a.t, b.t) ? [at(a, b)] : []; break;
    case 'ray': out = b && (b.t >= a.t ? t >= a.t : t <= a.t) ? [at(a, b)] : []; break;
    case 'ext': out = b ? [at(a, b)] : []; break;
    case 'channel': {
      if (!b || !c) break;
      const base = at(a, b), lc = tToLogical(c.t), l0 = tToLogical(a.t), l1 = tToLogical(b.t);
      if (base == null || lc == null || l0 === l1) break;
      const off = c.p - (a.p + (b.p - a.p) * (lc - l0) / (l1 - l0));
      out = [base, base + off];
      break;
    }
  }
  return out.filter(isN);
}
function alVal(R, k, i) { const pl = R.plots.find(p => p.k === k); if (!pl) return null; const arr = R.data[k], j = i - (pl.shift || 0); return arr && j >= 0 ? arr[j] : null; }
// 지표 알림 (실시간): 지표를 다시 계산할 때마다
function alertInd() {
  if (EMBED || !cur || !S.bars.length || S.loading || RP.on) return;
  const n = S.bars.length, bt = S.bars[n - 1].t;
  for (const a of prefs.alerts) {
    if (!a.on || a.kind !== 'ind' || a.freq === 'close' || a.sid !== cur.sid || a.iv !== spec.id) continue;
    const R = RT.get(a.ind.uid);
    if (!R) continue;
    const v = alVal(R, a.ind.k, n - 1), tv = a.tk ? alVal(R, a.tk, n - 1) : a.tv;
    if (!isN(v) || !isN(tv)) continue;
    const m = AL.mem[a.id];
    AL.mem[a.id] = { v, tv, bt, key: cur.sid + spec.id };
    if (m && m.key === cur.sid + spec.id && crossed(a.cond, m.v, v, m.tv, tv)) alFire(a, `지금 ${alNum(v)}`);
  }
  alertClose();
}
// 봉 마감 때만: 새 봉이 시작되면 방금 끝난 봉과 그 앞 봉을 비교
function alertClose() {
  const n = S.bars.length, key = cur.sid + '|' + spec.id, prev = AL.bars;
  AL.bars = { key, n, t: S.bars[n - 1].t };
  if (!prev || prev.key !== key || n < 3 || S.bars[n - 1].t === prev.t) return;
  if (S.bars[n - 2].t !== prev.t) return; // 봉 하나가 막 끝난 경우만
  for (const a of prefs.alerts) {
    if (!a.on || a.freq !== 'close' || a.sid !== cur.sid) continue;
    if (a.kind === 'ind') {
      if (a.iv !== spec.id) continue;
      const R = RT.get(a.ind.uid);
      if (!R) continue;
      const v0 = alVal(R, a.ind.k, n - 3), v1 = alVal(R, a.ind.k, n - 2), t0 = a.tk ? alVal(R, a.tk, n - 3) : a.tv, t1 = a.tk ? alVal(R, a.tk, n - 2) : a.tv;
      if ([v0, v1, t0, t1].every(isN) && crossed(a.cond, v0, v1, t0, t1)) alFire(a, `봉 마감 값 ${alNum(v1)}`);
    } else if (a.kind === 'draw') {
      const d = alDrawing(a);
      if (!d) continue;
      const b0 = S.bars[n - 3], b1 = S.bars[n - 2], l0 = dwLinePrices(d, b0.t), l1 = dwLinePrices(d, b1.t);
      for (let i = 0; i < Math.min(l0.length, l1.length); i++) if (crossed(a.cond, b0.close, b1.close, l0[i], l1[i])) { alFire(a, `봉 마감 ${alNum(b1.close)}`); break; }
    }
  }
}
function alFire(a, extra) {
  const st = AL.st[a.id] || (AL.st[a.id] = {}), now = Date.now(), bt = S.bars.length ? S.bars[S.bars.length - 1].t : 0;
  if (a.kind === 'price' && a.freq === 'every' && now - (st.t || 0) < 60000) return;
  if (a.freq === 'bar' && st.bar === bt && st.sid === cur.sid) return;
  Object.assign(st, { t: now, bar: bt, sid: cur.sid, n: (st.n || 0) + 1 }); alSaveSt();
  if (a.freq === 'once') { a.on = false; savePrefs(); resubscribe(); }
  const msg = `${alDesc(a)}${extra ? ' · ' + extra : ''}${a.note ? ' · ' + a.note : ''}`;
  AL.log.unshift({ t: now, msg }); if (AL.log.length > 50) AL.log.length = 50; store.set('bc:alertLog', AL.log);
  AL.unseen++; syncAlertBadge();
  toast('알림 · ' + msg, 'up'); beep(true); setTimeout(() => beep(true), 450);
  try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate([150, 80, 150]); } catch {} // 화면을 한 번이라도 누른 뒤에만 된다
  if (window.Notification && Notification.permission === 'granted' && (document.hidden || !document.hasFocus())) { try { new Notification('차트 알림', { body: msg, tag: 'bc-' + a.id }); } catch {} }
  if (!$('#alertDlg').hidden) renderAlerts();
}
function syncAlertBadge() { const b = $('#alertBadge'); b.textContent = AL.unseen > 9 ? '9+' : String(AL.unseen); b.hidden = !AL.unseen; }

// ── 알림 창 ──
function alPriceOf(sid) { if (cur && sid === cur.sid) return S.lastPrice != null ? S.lastPrice : S.bars.length ? S.bars[S.bars.length - 1].close : null; const w = watchCache[sid]; return w ? w.c : AL.last[sid] ?? null; }
function alIndPlots() { // 지금 차트의 지표 선 목록
  const out = [];
  for (const R of RT.values()) for (const pl of R.plots) if (!pl.ext) out.push({ v: `${R.inst.uid}|${pl.k}`, uid: R.inst.uid, k: pl.k, label: plotName(R, pl) });
  return out;
}
function alFormHTML() {
  const opt = (o, sel) => Object.entries(o).map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${l}</option>`).join('');
  if (AL.kind === 'price') {
    const sids = [cur.sid].concat(prefs.watch.filter(s => s !== cur.sid)), p = alPriceOf(cur.sid);
    return `<label class="fld wide"><span>종목</span><select class="field" id="alSym">${sids.map(s => `<option value="${esc(s)}">${esc(alSym(s))}${s === cur.sid ? ' (지금 차트)' : ''}</option>`).join('')}</select></label>
      <label class="fld"><span>조건</span><select class="field" id="alCond">${opt(AL_COND, 'cross')}</select></label>
      <label class="fld"><span>가격</span><input class="field" id="alVal" type="number" inputmode="decimal" step="any" value="${p != null ? p : ''}"></label>
      <label class="fld"><span>얼마나 자주</span><select class="field" id="alFreq">${opt(AL_FREQ_P, 'once')}</select></label>
      <label class="fld"><span>메모 (선택)</span><input class="field" id="alNote" maxlength="60" placeholder="예: 손절 확인"></label>`;
  }
  const plots = alIndPlots();
  if (!plots.length) return '<p class="al-empty wide">지금 차트에 지표가 없어요. 지표를 먼저 추가하세요.</p>';
  return `<label class="fld wide"><span>지표 선</span><select class="field" id="alInd">${plots.map(p => `<option value="${esc(p.v)}">${esc(p.label)}</option>`).join('')}</select></label>
      <label class="fld"><span>조건</span><select class="field" id="alCond">${opt(AL_COND, 'up')}</select></label>
      <label class="fld"><span>기준</span><select class="field" id="alTgt"></select></label>
      <label class="fld" id="alValWrap"><span>값</span><input class="field" id="alVal" type="number" inputmode="decimal" step="any"></label>
      <label class="fld"><span>얼마나 자주</span><select class="field" id="alFreq">${opt(AL_FREQ_I, 'bar')}</select></label>
      <label class="fld wide"><span>메모 (선택)</span><input class="field" id="alNote" maxlength="60"></label>
      <p class="al-empty wide">${esc(alSym(cur.sid))} ${spec.label} 차트를 열어 둔 동안 확인해요.</p>`;
}
function alFillTarget() { // 지표 알림: 같은 지표의 다른 선이나 값
  const sel = $('#alInd'), tg = $('#alTgt');
  if (!sel || !tg) return;
  const [uid, k] = sel.value.split('|'), R = RT.get(uid);
  const others = R ? R.plots.filter(pl => pl.k !== k && !pl.ext) : [];
  tg.innerHTML = '<option value="">값</option>' + others.map(pl => `<option value="${esc(pl.k)}">${esc(pl.label)} 선</option>`).join('');
  const v = R ? alVal(R, k, S.bars.length - 1) : null;
  $('#alVal').value = isN(v) ? +v.toFixed(4) : '';
  $('#alValWrap').hidden = false;
}
function alStatus(a) {
  const st = AL.st[a.id], fired = st && st.n ? ` · ${st.n}번 울림` : '';
  if (!a.on) return '꺼짐' + fired;
  if (a.kind === 'price') return '확인 중' + fired;
  if (a.kind === 'draw') return (cur && a.sid === cur.sid ? (alDrawing(a) ? '확인 중' : '도형이 지워졌어요') : '이 종목 차트를 열면 확인해요') + fired;
  return (cur && a.sid === cur.sid && a.iv === spec.id ? (RT.has(a.ind.uid) ? '확인 중' : '지표가 지워졌어요') : `${alIvLabel(a.iv)} 차트를 열면 확인해요`) + fired;
}
function renderAlerts() {
  const perm = window.Notification ? Notification.permission : 'unsupported';
  const fmtT = t => { const z = zDate(t); return `${pad(z.getUTCMonth() + 1)}.${pad(z.getUTCDate())} ${pad(z.getUTCHours())}:${pad(z.getUTCMinutes())}:${pad(z.getUTCSeconds())}`; };
  $('#alertBody').innerHTML = `<section class="al-sec"><h3>새 알림</h3>
      <div class="seg" role="group" aria-label="알림 종류"><button type="button" data-alk="price" aria-pressed="${AL.kind === 'price'}">가격</button><button type="button" data-alk="ind" aria-pressed="${AL.kind === 'ind'}">지표</button></div>
      <form class="al-form" id="alForm">${alFormHTML()}<div class="sync-actions wide"><button type="submit" class="btn-primary">알림 만들기</button></div></form>
      <p class="sync-hint">작도 선(추세선·레이·연장선·수평 레이·교차선·평행 채널) 알림은 도형을 누른 뒤 위에 뜨는 막대의 종 버튼으로 만들어요. 수평선은 그리기만 해도 가격 알림이 돼요.</p>
    </section>
    <section class="al-sec"><h3>알림 목록<small>${prefs.alerts.length}개</small></h3>
      ${prefs.alerts.length ? `<ul class="al-list">${prefs.alerts.map(a => `<li class="al-item${a.on ? '' : ' off'}"><span class="al-dot"></span><span class="al-txt">${esc(alDesc(a))}${a.note ? ` · ${esc(a.note)}` : ''}<small>${esc(alStatus(a))} · ${esc((a.kind === 'price' ? AL_FREQ_P : AL_FREQ_I)[a.freq] || '')}</small></span><button type="button" class="btn-ghost" data-alt="${esc(a.id)}">${a.on ? '끄기' : '켜기'}</button><button type="button" class="icon-btn" data-ald="${esc(a.id)}" aria-label="알림 지우기" title="지우기">${ICON_TRASH}</button></li>`).join('')}</ul>` : '<p class="al-empty">아직 만든 알림이 없어요.</p>'}
    </section>
    <section class="al-sec"><h3>최근 울린 알림</h3>
      ${AL.log.length ? `<ul class="al-log">${AL.log.slice(0, 20).map(l => `<li><time>${fmtT(l.t)}</time><span>${esc(l.msg)}</span></li>`).join('')}</ul><div class="sync-actions"><button type="button" class="btn-ghost" id="alClearLog">기록 지우기</button></div>` : '<p class="al-empty">아직 울린 알림이 없어요.</p>'}
    </section>
    <section class="al-sec"><h3>알림 받는 방법</h3>
      <p class="sync-hint">화면 알림과 소리(휴대폰은 진동도)로 알려 드려요.${perm === 'granted' ? ' 다른 창을 보고 있을 때는 브라우저 알림도 떠요.' : ''} <b>이 차트가 열려 있어야</b> 알림을 확인할 수 있어요 (서버 없이 브라우저에서 돌아가서, 창을 닫거나 휴대폰 화면을 끄면 확인이 멈춰요).</p>
      ${perm === 'default' ? '<div class="sync-actions"><button type="button" class="btn-ghost" id="alPerm">다른 창을 볼 때도 브라우저 알림 받기</button></div>' : perm === 'denied' ? '<p class="sync-hint">브라우저 알림이 막혀 있어요. 주소창 왼쪽 자물쇠 아이콘에서 알림을 허용할 수 있어요.</p>' : ''}
    </section>`;
  alFillTarget();
}
function openAlerts(kind) {
  closePops();
  if (kind) AL.kind = kind;
  AL.unseen = 0; syncAlertBadge();
  renderAlerts();
  $('#alertDlg').hidden = false;
}
function addAlert(a) {
  if (prefs.alerts.length >= 50) { toast('알림은 50개까지예요. 안 쓰는 알림을 지운 뒤 만드세요.', 'err'); return false; }
  a.id = newUid(); a.on = true; a.at = Date.now();
  prefs.alerts.push(a); savePrefs(); resubscribe();
  if (window.Notification && Notification.permission === 'default') { try { Notification.requestPermission().then(() => { if (!$('#alertDlg').hidden) renderAlerts(); }); } catch {} }
  return true;
}
$('#alertBtn').addEventListener('click', () => openAlerts());
$('#alertBody').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.alk) { AL.kind = b.dataset.alk; renderAlerts(); return; }
  if (b.dataset.alt) { const a = prefs.alerts.find(x => x.id === b.dataset.alt); if (a) { a.on = !a.on; delete AL.mem[a.id]; savePrefs(); resubscribe(); renderAlerts(); } return; }
  if (b.dataset.ald) { prefs.alerts = prefs.alerts.filter(x => x.id !== b.dataset.ald); delete AL.st[b.dataset.ald]; alSaveSt(); savePrefs(); resubscribe(); renderAlerts(); return; }
  if (b.id === 'alClearLog') { AL.log = []; store.set('bc:alertLog', []); renderAlerts(); return; }
  if (b.id === 'alPerm') { try { Notification.requestPermission().then(renderAlerts); } catch {} }
});
$('#alertBody').addEventListener('change', e => {
  if (e.target.id === 'alInd') alFillTarget();
  else if (e.target.id === 'alTgt') $('#alValWrap').hidden = !!e.target.value;
  else if (e.target.id === 'alSym') { const p = alPriceOf(e.target.value); $('#alVal').value = p != null ? p : ''; }
});
$('#alertBody').addEventListener('submit', e => {
  e.preventDefault();
  const cond = $('#alCond') && $('#alCond').value, freq = $('#alFreq') && $('#alFreq').value, note = ($('#alNote') ? $('#alNote').value : '').trim().slice(0, 60), v = parseFloat($('#alVal') ? $('#alVal').value : '');
  if (!cond) return;
  let a;
  if (AL.kind === 'price') {
    const sid = $('#alSym').value;
    if (!isFinite(v) || v <= 0) { toast('가격을 넣으세요.', 'err'); return; }
    a = { kind: 'price', sid, price: +v.toFixed(8), cond, freq, note };
  } else {
    const [uid, k] = $('#alInd').value.split('|'), R = RT.get(uid), tk = $('#alTgt').value;
    if (!R) return;
    const pl = R.plots.find(p => p.k === k), tp = tk && R.plots.find(p => p.k === tk);
    if (!tk && !isFinite(v)) { toast('기준 값을 넣으세요.', 'err'); return; }
    a = { kind: 'ind', sid: cur.sid, iv: spec.id, ind: { uid, k, name: plotName(R, pl) }, cond, freq, note };
    if (tp) Object.assign(a, { tk, tname: tp.label + ' 선' }); else a.tv = +v.toFixed(8);
  }
  if (addAlert(a)) { toast('알림을 만들었어요 · ' + alDesc(a)); renderAlerts(); }
});
function addDrawAlert(d) { // 선택한 작도 선에 알림 걸기
  const a = { kind: 'draw', sid: cur.sid, iv: null, dw: { id: d.id, key: symKey(), name: DW_TOOLS[d.type].name }, cond: 'cross', freq: 'bar', note: '' };
  if (addAlert(a)) toast(`${DW_TOOLS[d.type].name}에 알림을 걸었어요. 가격이 선을 지나가면 알려 드려요 (봉마다 한 번). 상단 종 버튼에서 바꿀 수 있어요.`);
}
syncAlertBadge();
