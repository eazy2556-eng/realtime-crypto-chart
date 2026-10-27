
// ───────── 다른 기기로 설정 옮기기 ─────────
// 설정(지표·관심 종목·작도·수평선·화면 배치)을 압축해 링크 '#s=…' 또는 파일로 주고받는다.
// '#' 뒤는 서버로 전송되지 않으므로 설정 내용이 GitHub에 남지 않는다.
const PUBLIC_URL = 'https://eazy2556-eng.github.io/realtime-crypto-chart/binance-chart.html';
const SYNC_KEY_RE = /^[A-Za-z0-9:._-]{1,60}$/;
function collectBundle(noSave) {
  if (!noSave) savePrefs();
  const b = { v: 1, at: Date.now(), prefs: store.get('bc:prefs', prefs), dw: {}, hl: {} };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i), m = /^bc:(dw|hl):(.+)$/.exec(k);
      if (!m) continue;
      const v = store.get(k, []);
      if (Array.isArray(v) && v.length) b[m[1]][m[2]] = v;
    }
  } catch {}
  return b;
}
function b64u(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
}
async function encodeBundle(b) {
  const raw = new TextEncoder().encode(JSON.stringify(b));
  if (window.CompressionStream) {
    const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    return 'BC1.' + b64u(z);
  }
  return 'BC0.' + b64u(raw);
}
async function decodeBundle(text) {
  text = String(text || '').trim();
  let obj;
  if (text.startsWith('{')) obj = JSON.parse(text); // 파일
  else {
    const m = /(BC[01])\.([A-Za-z0-9_-]+)/.exec(text);
    if (!m) throw new Error('설정 링크나 코드가 아니에요');
    let bytes = unb64u(m[2]);
    if (m[1] === 'BC1') {
      if (!window.DecompressionStream) throw new Error('이 브라우저는 압축된 설정을 풀 수 없어요. 파일로 옮겨 주세요');
      bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    }
    obj = JSON.parse(new TextDecoder().decode(bytes));
  }
  if (!obj || obj.v !== 1 || !obj.prefs || typeof obj.prefs !== 'object') throw new Error('알아볼 수 없는 설정이에요');
  const clean = (src, fn) => { const o = {}; if (src && typeof src === 'object') for (const [k, v] of Object.entries(src)) if (SYNC_KEY_RE.test(k) && Array.isArray(v)) o[k] = fn(v); return o; };
  obj.dw = clean(obj.dw, list => list.filter(d => d && DW_TOOLS[d.type] && Array.isArray(d.pts) && d.pts.every(p => p && isN(p.t) && isN(p.p))).slice(0, 500).map(d => ({
    id: String(d.id || newUid()).slice(0, 20), type: d.type, pts: d.pts.slice(0, FREE.includes(d.type) ? 600 : 8).map(p => ({ t: p.t, p: p.p })), ...(d.lock ? { lock: true } : {}),
    color: d.color === 'fg' || /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#2962ff', w: [1, 2, 3, 4].includes(d.w) ? d.w : 1,
    ...(d.type === 'text' ? { text: String(d.text || '').slice(0, 120) } : {}),
  })));
  obj.hl = clean(obj.hl, list => list.filter(isN).slice(0, 200));
  const sy = obj.sync; // 휴대폰 연결용으로 함께 보낸 자동 연동 정보
  if (sy && !(typeof sy.token === 'string' && /^[A-Za-z0-9_]{20,255}$/.test(sy.token) && typeof sy.gist === 'string' && /^[0-9A-Za-z]{6,64}$/.test(sy.gist))) delete obj.sync;
  return obj;
}
function bundleSummary(b) {
  const p = b.prefs, dwN = Object.values(b.dw).reduce((a, l) => a + l.length, 0), hlN = Object.values(b.hl).reduce((a, l) => a + l.length, 0);
  const parts = [`지표 ${Array.isArray(p.inds) ? p.inds.length : 0}개`, `관심 종목 ${Array.isArray(p.watch) ? p.watch.length : 0}개`];
  if (dwN) parts.push(`작도 ${dwN}개 (종목 ${Object.keys(b.dw).length}개)`);
  if (hlN) parts.push(`수평선 ${hlN}개`);
  parts.push('시간 단위·지표 창 배치·테마');
  return parts.join(' · ');
}
const fmtWhen = t => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
let syncOut = null, syncIn = null;
function syncHTML() {
  return `<section class="sync-sec">
      <h3>이 기기 설정 보내기</h3>
      <p class="sync-sum" id="syncSum"></p>
      <div class="sync-actions"><button type="button" class="btn-primary" id="syncCopy">링크 복사</button><button type="button" class="btn-ghost" id="syncQr">QR 코드</button><button type="button" class="btn-ghost" id="syncFile">파일로 저장</button></div>
      <div class="sync-qr" id="syncQrBox" hidden></div>
      <textarea class="field sync-code" id="syncCode" readonly aria-label="설정 링크" rows="3"></textarea>
      <p class="sync-hint">휴대폰에서: 복사한 링크를 카카오톡 "나에게 보내기"로 보내서 누르거나, 휴대폰 카메라로 QR 코드를 찍으세요. 확인을 누르면 그 기기 설정이 이 기기와 똑같아져요.</p>
    </section>
    <section class="sync-sec">
      <h3>받은 설정 적용하기</h3>
      <textarea class="field sync-code" id="syncInput" rows="3" placeholder="받은 링크나 코드를 붙여 넣으세요" aria-label="받은 설정 링크"></textarea>
      <div class="sync-actions"><button type="button" class="btn-primary" id="syncRead">읽기</button><label class="btn-ghost file-btn">파일 열기<input type="file" id="syncFileIn" accept=".json,application/json"></label></div>
      <div class="sync-confirm" id="syncConfirm" hidden></div>
    </section>`;
}
async function makeLink(withSync) {
  const b = collectBundle();
  if (withSync && CL.token && CL.gist) b.sync = { token: CL.token, gist: CL.gist, login: CL.login };
  const base = /^https?:$/.test(location.protocol) && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' ? location.origin + location.pathname : PUBLIC_URL;
  const code = await encodeBundle(b);
  syncOut = { link: `${base}#s=${code}`, code, b };
  $('#syncSum').textContent = bundleSummary(b) + (b.sync ? ' · 자동 연동 정보(토큰)' : '');
  $('#syncCode').value = syncOut.link;
  $('#syncQrBox').hidden = true;
}
async function openSync(incoming) {
  closePops();
  $('#syncBody').innerHTML = '<section class="sync-sec" id="cloudSec"></section>' + syncHTML();
  $('#syncDlg').hidden = false;
  renderCloud();
  await makeLink(false);
  if (incoming) { $('#syncInput').value = incoming; await readIncoming(incoming, true); }
}
async function readIncoming(text, fromLink) {
  const box = $('#syncConfirm');
  box.hidden = false;
  try {
    syncIn = await decodeBundle(text);
    box.innerHTML = `<p class="sync-arrive">${fromLink ? '보낸 설정이 도착했어요.' : '설정을 읽었어요.'} <span class="muted">(${fmtWhen(syncIn.at || Date.now())}에 만든 설정)</span></p>
      <p class="sync-sum">${esc(bundleSummary(syncIn))}</p>${syncIn.sync ? `<p class="sync-hint">자동 연동도 함께 켜져요 (GitHub ${esc(syncIn.sync.login || '')}).</p>` : ''}
      <p class="sync-warn">적용하면 이 기기의 지금 설정(지표·관심 종목·작도)이 이 내용으로 바뀌어요.</p>
      <div class="sync-actions"><button type="button" class="btn-primary" id="syncApply">이 설정으로 바꾸기</button><button type="button" class="btn-ghost" id="syncCancel">취소</button></div>`;
    if (fromLink) box.scrollIntoView({ block: 'nearest' });
  } catch (e) {
    syncIn = null;
    box.innerHTML = `<p class="sync-warn">읽지 못했어요: ${esc(e.message)}</p>`;
  }
}
function applyBundle(b) {
  try {
    const rm = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^bc:(dw|hl):/.test(k)) rm.push(k); }
    rm.forEach(k => localStorage.removeItem(k));
    localStorage.setItem('bc:prefs', JSON.stringify(b.prefs));
    for (const [k, v] of Object.entries(b.dw)) localStorage.setItem('bc:dw:' + k, JSON.stringify(v));
    for (const [k, v] of Object.entries(b.hl)) localStorage.setItem('bc:hl:' + k, JSON.stringify(v));
    if (b.sync) localStorage.setItem('bc:sync', JSON.stringify({ token: b.sync.token, gist: b.sync.gist, login: b.sync.login || null, rev: null, sig: null, etag: null, skip: null }));
  } catch {
    toast('이 브라우저에 설정을 저장하지 못했어요. 사생활 보호(시크릿) 모드인지 확인하세요.', 'err');
    return;
  }
  history.replaceState(null, '', location.pathname + location.search);
  location.reload();
}
function clearHash() { if (/^#s=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); }
async function copyText(text, area) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { area.focus(); area.select(); try { return document.execCommand('copy'); } catch { return false; } }
}
let qrLib = null;
function loadQrLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  return qrLib || (qrLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    s.onload = () => res(window.qrcode); s.onerror = () => { qrLib = null; rej(new Error('QR 도구를 불러오지 못했어요')); };
    document.head.append(s);
  }));
}
$('#syncBody').addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b || !syncOut) return;
  if (b.id === 'syncCopy') { const ok = await copyText(syncOut.link, $('#syncCode')); toast(ok ? '링크를 복사했어요. 휴대폰으로 보내서 열어 보세요.' : '복사하지 못했어요. 아래 칸의 링크를 직접 복사하세요.', ok ? 'info' : 'err'); }
  else if (b.id === 'syncQr') {
    const box = $('#syncQrBox');
    box.hidden = false; box.textContent = 'QR 코드 만드는 중…';
    try {
      const qr = (await loadQrLib())(0, 'L');
      qr.addData(syncOut.link); qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true }) + '<p>휴대폰 카메라로 찍으세요</p>';
    } catch (err) { box.textContent = /overflow|too long|length/i.test(String(err && err.message || err)) ? '설정이 많아 QR 코드에 다 담기지 않아요. 링크 복사나 파일로 옮겨 주세요.' : (err.message || 'QR 코드를 만들지 못했어요.'); }
  } else if (b.id === 'syncFile') {
    const blob = new Blob([JSON.stringify(syncOut.b, null, 1)], { type: 'application/json' }), d = new Date();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `실시간차트-설정-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('설정 파일을 저장했어요.');
  } else if (b.id === 'syncRead') await readIncoming($('#syncInput').value, false);
  else if (b.id === 'syncApply' && syncIn) applyBundle(syncIn);
  else if (b.id === 'syncCancel') { syncIn = null; $('#syncConfirm').hidden = true; clearHash(); }
});
$('#syncBody').addEventListener('change', async e => {
  if (e.target.id !== 'syncFileIn' || !e.target.files[0]) return;
  await readIncoming(await e.target.files[0].text(), false);
});
$('#syncBtn').addEventListener('click', () => openSync());
$('#syncDlg').addEventListener('pointerdown', e => { if (e.target.id === 'syncDlg') clearHash(); });
$$('[data-close="syncDlg"]').forEach(b => b.addEventListener('click', clearHash));
