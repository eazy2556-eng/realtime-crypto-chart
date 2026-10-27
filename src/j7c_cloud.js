
// ───────── 자동 연동 (GitHub 비공개 gist) ─────────
// 기기마다 토큰(권한: gist)을 한 번 넣으면, gist 하나에 설정을 저장하고 다른 기기와 맞춘다.
// 바꾸면 3초 뒤 올리고, 앱을 열 때·돌아올 때·켜 둔 동안 1분마다 확인한다. 나중에 저장한 쪽이 이긴다.
const GIST_FILE = 'chart-settings.json', GIST_DESC = 'realtime-crypto-chart 설정 (자동 연동)';
const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=' + encodeURIComponent('실시간 차트 설정 연동');
const SYNC_SKIP = ['sym', 'interval', 'tab', 'searchMk', 'paneH', 'layout']; // 기기마다 따로 두는 것 (보는 종목·시간 단위·창 높이 등)
const GH_API = store.get('bc:ghapi', null) || 'https://api.github.com'; // 테스트할 때만 바꾼다
const CL = Object.assign({ token: null, gist: null, login: null, rev: null, sig: null, etag: null, skip: null, pending: false }, EMBED ? {} : store.get('bc:sync', {}) || {}); // 멀티 차트의 다른 칸은 연동하지 않는다
let DEVICE = store.get('bc:device', null);
if (!DEVICE) { DEVICE = newUid(); store.set('bc:device', DEVICE); }
const clSave = () => store.set('bc:sync', CL);
let clState = CL.token ? 'ok' : 'off', clMsg = '', clChecked = 0, pushTimer = null, applying = false;

function canon(v) { // 키 순서와 상관없이 같은 내용이면 같은 문자열
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); }
function stripLocal(p) { const o = Object.assign({}, p); for (const k of SYNC_SKIP) delete o[k]; return o; }
function cloudBundle() { const b = collectBundle(true); return { v: 1, at: Date.now(), device: DEVICE, prefs: stripLocal(b.prefs), dw: b.dw, hl: b.hl }; }
const sigOf = b => fnv(canon([stripLocal(b.prefs), b.dw || {}, b.hl || {}]));
const revOf = g => (g.history && g.history[0] && g.history[0].version) || g.updated_at;

async function ghFetch(path, opts = {}) {
  const headers = Object.assign({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + CL.token }, opts.headers || {});
  if (opts.body) headers['Content-Type'] = 'application/json';
  const req = { method: opts.method || 'GET', body: opts.body, headers, cache: 'no-store' };
  let r;
  try { r = await fetch(GH_API + path, Object.assign({ keepalive: !!opts.keepalive }, req)); }
  catch (e) { if (!opts.keepalive) throw new Error('GitHub에 연결하지 못했어요. 인터넷 연결을 확인하세요.'); r = await fetch(GH_API + path, req); } // keepalive를 못 쓰는 브라우저
  if (r.status === 304) return { notModified: true };
  if (r.status === 401) { const e = new Error('토큰이 맞지 않거나 만료됐어요. 새 토큰을 넣어 주세요.'); e.auth = true; throw e; }
  if (r.status === 403 && r.headers.get('X-RateLimit-Remaining') === '0') throw new Error('GitHub 요청 한도를 넘었어요. 잠시 뒤 저절로 다시 시도해요.');
  if (r.status === 404 && path.startsWith('/gists/')) throw new Error('GitHub에서 설정 저장소(gist)를 찾지 못했어요. 연동을 끊고 다시 연결하세요.');
  if (r.status === 403 || r.status === 404) throw new Error('토큰에 gist 권한이 없어요. 토큰을 만들 때 gist를 체크했는지 확인하세요.');
  if (!r.ok) throw new Error(`GitHub 응답 ${r.status}. 잠시 뒤 다시 시도해요.`);
  return { json: await r.json(), etag: r.headers.get('ETag') };
}

function cloudStatusText() {
  if (!CL.token) return '꺼짐';
  if (CL.pending) return '선택 필요';
  if (clState === 'busy') return '동기화 중…';
  if (clState === 'err') return '오류';
  if (!clChecked) return '켜짐';
  const d = new Date(clChecked);
  return `켜짐 · 마지막 확인 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function setCl(state, msg) {
  clState = state;
  if (msg !== undefined) clMsg = msg;
  $('#syncBtn').dataset.cloud = CL.token ? (state === 'err' ? 'err' : CL.pending ? 'wait' : 'on') : '';
  const st = $('#clStatus'); if (st) { st.textContent = cloudStatusText(); st.dataset.state = CL.token ? (CL.pending ? 'wait' : state) : 'off'; }
  const m = $('#clMsg'); if (m) { m.textContent = clMsg; m.classList.toggle('bad', state === 'err'); }
}
function renderCloud() {
  const sec = $('#cloudSec');
  if (!sec) return;
  let h = `<h3>자동 연동 <span class="cl-status" id="clStatus"></span></h3>`;
  if (!CL.token) {
    h += `<p class="sync-hint">PC와 휴대폰에 같은 GitHub 토큰을 한 번씩 넣으면, 한쪽에서 바꾼 지표·관심 종목·작도·테마가 다른 쪽에 자동으로 반영돼요. 보는 종목·시간 단위·창 높이는 기기마다 따로예요.</p>
      <ol class="cl-steps">
        <li><a href="${TOKEN_URL}" target="_blank" rel="noopener">GitHub 토큰 만들기</a>를 눌러 로그인합니다. 권한은 <b>gist</b> 하나만 체크된 상태예요. Expiration(만료)은 길게(예: 1년) 고르고 맨 아래 <b>Generate token</b>을 누르세요.</li>
        <li>만들어진 토큰(<code>ghp_</code>로 시작)을 복사해 아래에 붙여 넣고 <b>연결</b>을 누르세요.</li>
        <li>휴대폰은 PC에서 연결한 뒤 아래 <b>QR 코드</b>에 연동 정보를 넣어 찍으면 따로 입력하지 않아도 돼요.</li>
      </ol>
      <div class="sync-actions"><input type="password" class="field cl-token" id="clToken" placeholder="ghp_… 토큰 붙여 넣기" autocomplete="off" spellcheck="false" aria-label="GitHub 토큰"><button type="button" class="btn-primary" id="clConnect">연결</button></div>`;
  } else if (CL.pending) {
    h += `<div class="sync-confirm"><p class="sync-arrive">이미 다른 기기에서 저장한 설정이 있어요.</p>
      <p class="sync-hint">가져오면 이 기기의 지표·관심 종목·작도가 저장된 설정으로 바뀌어요.</p>
      <div class="sync-actions"><button type="button" class="btn-primary" id="clImport">저장된 설정 가져오기</button><button type="button" class="btn-ghost" id="clOverwrite">이 기기 설정으로 덮어쓰기</button></div></div>`;
  } else {
    h += `<p class="sync-hint">GitHub <b>${esc(CL.login || '')}</b> 계정의 비공개 gist에 저장하고 있어요. 바꾼 설정은 3초 뒤 저장되고, 다른 기기는 앱을 열거나 다시 볼 때 반영돼요.</p>
      <div class="sync-actions"><button type="button" class="btn-ghost" id="clNow">지금 동기화</button><button type="button" class="btn-ghost" id="clOff">이 기기 연동 끊기</button></div>
      <label class="cl-share"><input type="checkbox" id="clShare"> 휴대폰 연결용: 아래 링크·QR에 연동 정보(토큰)도 넣기</label>
      <p class="sync-warn" id="clShareWarn" hidden>토큰이 든 링크·QR을 가진 사람은 이 설정 저장소를 바꿀 수 있어요. 채팅으로 보내지 말고 휴대폰 카메라로 화면의 QR을 바로 찍으세요. 다 찍었으면 체크를 끄세요.</p>`;
  }
  h += `<p class="sync-hint" id="clMsg"></p>`;
  sec.innerHTML = h;
  setCl(clState);
}

async function connectCloud(token) {
  token = String(token || '').trim();
  if (!/^[A-Za-z0-9_]{20,255}$/.test(token)) { setCl('err', '토큰 형식이 아니에요. ghp_ 또는 github_pat_로 시작하는 값을 그대로 붙여 넣으세요.'); return; }
  Object.assign(CL, { token, gist: null, rev: null, sig: null, etag: null, skip: null, pending: false });
  setCl('busy', 'GitHub에 확인하는 중…');
  try {
    CL.login = (await ghFetch('/user')).json.login;
    let found = null;
    for (let page = 1; page <= 5 && !found; page++) {
      const l = (await ghFetch(`/gists?per_page=100&page=${page}`)).json;
      found = l.find(g => g.description === GIST_DESC && g.files && g.files[GIST_FILE]);
      if (l.length < 100) break;
    }
    if (found) { Object.assign(CL, { gist: found.id, pending: true }); clSave(); renderCloud(); setCl('ok', ''); return; }
    const b = cloudBundle();
    const r = (await ghFetch('/gists', { method: 'POST', body: JSON.stringify({ description: GIST_DESC, public: false, files: { [GIST_FILE]: { content: JSON.stringify(b) } } }) })).json;
    Object.assign(CL, { gist: r.id, rev: revOf(r), sig: sigOf(b) });
    clSave(); clChecked = Date.now();
    renderCloud(); setCl('ok', '연결했어요. 이제 이 기기에서 바꾸는 설정이 자동으로 저장돼요. 휴대폰도 연결해 주세요.');
  } catch (e) {
    Object.assign(CL, { token: null, gist: null, login: null, pending: false }); clSave();
    renderCloud(); setCl('off', e.message);
    $('#clMsg') && $('#clMsg').classList.add('bad');
  }
}
async function pushNow(keepalive) {
  clearTimeout(pushTimer); pushTimer = null;
  if (!CL.token || !CL.gist || CL.pending || applying) return;
  const b = cloudBundle(), sig = sigOf(b);
  if (sig === CL.sig) return;
  setCl('busy');
  try {
    const r = (await ghFetch(`/gists/${CL.gist}`, { method: 'PATCH', body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(b) } } }), keepalive })).json;
    Object.assign(CL, { rev: revOf(r), sig, etag: null }); clSave(); clChecked = Date.now();
    setCl('ok', '바꾼 설정을 저장했어요.');
  } catch (e) { setCl('err', e.message); }
}
SYNC.onChange = () => { if (!CL.token || !CL.gist || CL.pending || applying) return; clearTimeout(pushTimer); pushTimer = setTimeout(pushNow, 3000); };

// reason: startup(앱 열 때) · return(다시 볼 때) · tick(켜 둔 동안 1분마다) · manual(지금 동기화)
async function pullNow(reason) {
  if (!CL.token || !CL.gist || CL.pending || applying) return;
  if (pushTimer && reason !== 'manual') return; // 이 기기에서 방금 바꾼 것부터 올린다
  if (reason === 'manual') setCl('busy');
  try {
    const r = await ghFetch(`/gists/${CL.gist}`, { headers: CL.etag && reason !== 'manual' && !(reason === 'startup' && CL.skip) ? { 'If-None-Match': CL.etag } : {} }); // '나중에'로 미룬 건 다음에 열 때 반영
    clChecked = Date.now();
    if (!r.notModified) {
      CL.etag = r.etag; clSave();
      const g = r.json, rev = revOf(g), f = g.files && g.files[GIST_FILE];
      if (rev !== CL.rev && f) {
        const content = f.truncated ? await fetch(f.raw_url, { cache: 'no-store' }).then(x => x.text()) : f.content;
        const remote = await decodeBundle(content), rsig = sigOf(remote);
        if (rsig !== CL.sig && rsig !== sigOf(cloudBundle())) { // 다른 기기에서 바뀜
          if (reason === 'tick') { if (CL.skip !== rev) showCloudBar(remote, rev, rsig); setCl('ok'); return; }
          return applyCloud(remote, rev, rsig);
        }
        Object.assign(CL, { rev, sig: rsig }); clSave();
      }
    }
    setCl('ok', reason === 'manual' ? '최신 상태예요.' : undefined);
    if (sigOf(cloudBundle()) !== CL.sig) pushNow(); // 이 기기에서 바뀐 게 아직 안 올라갔으면
  } catch (e) { setCl('err', e.message); }
}
function applyCloud(remote, rev, rsig) {
  applying = true;
  const local = store.get('bc:prefs', {}) || {}, merged = Object.assign({}, remote.prefs);
  for (const k of SYNC_SKIP) if (local[k] !== undefined) merged[k] = local[k];
  Object.assign(CL, { rev, sig: rsig, etag: null, skip: null }); clSave();
  store.set('bc:cloudNote', Date.now());
  applyBundle(Object.assign({}, remote, { prefs: merged, sync: undefined }));
}
function showCloudBar(remote, rev, rsig) {
  let bar = $('#cloudBar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'cloudBar'; bar.className = 'cloud-bar'; bar.setAttribute('role', 'status'); document.body.append(bar); }
  bar.innerHTML = '<span>다른 기기에서 설정이 바뀌었어요.</span><button type="button" class="btn-primary" data-cb="apply">지금 반영</button><button type="button" class="btn-ghost" data-cb="later">나중에</button>';
  bar.hidden = false;
  bar.onclick = e => {
    const b = e.target.closest('[data-cb]');
    if (!b) return;
    bar.hidden = true;
    if (b.dataset.cb === 'apply') applyCloud(remote, rev, rsig); else { CL.skip = rev; clSave(); }
  };
}

$('#syncBody').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'clConnect') connectCloud($('#clToken').value);
  else if (b.id === 'clNow') pullNow('manual');
  else if (b.id === 'clOff') {
    clearTimeout(pushTimer); pushTimer = null;
    Object.assign(CL, { token: null, gist: null, login: null, rev: null, sig: null, etag: null, skip: null, pending: false }); clSave();
    renderCloud(); setCl('off', '이 기기의 연동을 끊었어요. 저장된 설정은 GitHub gist에 그대로 남아 있어요.');
    makeLink(false); // 링크 칸에 토큰이 남지 않게
  } else if (b.id === 'clImport') { Object.assign(CL, { rev: null, sig: null, pending: false }); clSave(); renderCloud(); pullNow('manual'); }
  else if (b.id === 'clOverwrite') { Object.assign(CL, { sig: null, pending: false }); clSave(); renderCloud(); pushNow(); }
});
$('#syncBody').addEventListener('change', e => {
  if (e.target.id !== 'clShare') return;
  $('#clShareWarn').hidden = !e.target.checked;
  makeLink(e.target.checked);
});
$('#syncBody').addEventListener('keydown', e => { if (e.target.id === 'clToken' && e.key === 'Enter') { e.preventDefault(); connectCloud(e.target.value); } });

// 시작할 때
setCl(clState);
if (store.get('bc:cloudNote', 0) && Date.now() - store.get('bc:cloudNote', 0) < 15000) setTimeout(() => toast('다른 기기에서 바꾼 설정을 불러왔어요.'), 800);
store.set('bc:cloudNote', 0);
if (CL.token && CL.gist) setTimeout(() => pullNow('startup'), 1200);
setInterval(() => { if (CL.token && !document.hidden) pullNow('tick'); }, 60000);
document.addEventListener('visibilitychange', () => {
  if (!CL.token) return;
  if (document.hidden) { if (pushTimer) pushNow(true); } // 앱을 닫거나 다른 앱으로 갈 때 바로 저장
  else pullNow('return');
});
// 받은 링크로 열었으면 바로 확인 창
if (/^#s=/.test(location.hash)) openSync(location.hash.slice(3));
