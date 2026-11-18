const $ = (id) => document.getElementById(id);
const configured = window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase;
const BOARD_NAMES = { notice: '공지사항', data: '공개자료', free: '조합마당' };

let sb, session = null, profile = null, board = ['notice','data','free'].includes(new URLSearchParams(location.search).get('board')) ? new URLSearchParams(location.search).get('board') : 'notice';
const say = (el, text, ok) => { el.textContent = text; el.className = 'form-msg ' + (ok ? 'ok' : 'err'); };

if (!configured) {
  $('setupWarn').hidden = false;
} else {
  sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  sb.auth.onAuthStateChange((_e, s) => { session = s; refresh(); });
  sb.auth.getSession().then(({ data }) => { session = data.session; refresh(); });
}

async function refresh() {
  profile = null;
  if (session) {
    const { data } = await sb.from('profiles').select('name, approved, is_admin').eq('id', session.user.id).maybeSingle();
    profile = data;
  }
  $('authBox').hidden = !!session;
  $('boardBox').hidden = !session;
  renderUtil();
  if (session) { renderWho(); loadPosts(); }
}

function renderUtil() {
  const box = $('utilLinks');
  box.innerHTML = '';
  if (session) {
    const b = document.createElement('a');
    b.href = '#'; b.textContent = '로그아웃';
    b.addEventListener('click', async (e) => { e.preventDefault(); await sb.auth.signOut(); });
    box.append(b);
  } else {
    box.innerHTML = '<a href="board.html">로그인</a><a href="join.html">회원가입</a>';
  }
}

function canWrite() {
  if (!profile) return false;
  if (board === 'notice' || board === 'data') return profile.is_admin;
  return profile.approved || profile.is_admin;
}

function renderWho() {
  const who = $('who');
  const name = (profile && profile.name) || Site.emailToId(session.user.email);
  const role = profile && profile.is_admin ? '관리자' : profile && profile.approved ? '승인 회원' : '승인 대기';
  who.textContent = `${name}님 (${role})`;
  who.className = 'who ' + (profile && (profile.approved || profile.is_admin) ? 'ok' : 'wait');
  if (!profile || !(profile.approved || profile.is_admin)) who.textContent += ' — 조합원 확인 후 승인되면 게시글을 볼 수 있습니다.';
}

let postPage = 1; const POST_PAGE = 20;
let loadSeq = 0;
async function loadPosts(keep) {
  const seq = ++loadSeq;
  if (!keep) postPage = 1;
  const list = $('postList');
  list.innerHTML = '';
  $('writeBtn').hidden = !canWrite();
  $('writeForm').hidden = true;
  const { data, error } = await sb.from('posts').select('id, title, content, author_id, author_name, created_at, attachments')
    .eq('board', board).order('created_at', { ascending: false }).order('id', { ascending: false }).range((postPage - 1) * POST_PAGE, postPage * POST_PAGE - 1);
  if (error) { $('empty').hidden = false; $('empty').textContent = '글을 불러오지 못했습니다.'; return; }
  const { count: total } = await sb.from('posts').select('id', { count: 'exact', head: true }).eq('board', board);
  $('count').textContent = `${BOARD_NAMES[board]} · 총 ${total || 0}건`;
  $('empty').hidden = data.length > 0;
  $('empty').textContent = '등록된 글이 없습니다.';
  if (seq !== loadSeq) return; // 더 최근 요청이 있으면 이 결과는 버림
  list.innerHTML = '';
  data.forEach((p) => list.append(renderPost(p)));
}

function renderPost(p) {
  const li = document.createElement('li');
  li.className = 'post';
  const head = document.createElement('button');
  head.type = 'button'; head.className = 'post-head';
  const t = document.createElement('b'); t.textContent = (p.attachments && p.attachments.length ? '📎 ' : '') + p.title;
  const m = document.createElement('small');
  m.textContent = `${p.author_name || '조합원'} · ${new Date(p.created_at).toLocaleDateString('ko-KR')}`;
  head.append(t, m);
  const body = document.createElement('div');
  body.className = 'post-body'; body.hidden = true;
  const txt = document.createElement('p'); txt.textContent = p.content; // textContent: HTML 삽입 방지
  body.append(txt);
  const attBox = document.createElement('div'); body.append(attBox);
  let attLoaded = false;
  if (session && (p.author_id === session.user.id || (profile && profile.is_admin))) {
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'btn btn-navy del'; del.textContent = '삭제';
    del.addEventListener('click', async () => {
      if (!confirm('이 글을 삭제할까요? 되돌릴 수 없습니다.')) return;
      const { error } = await sb.from('posts').delete().eq('id', p.id);
      if (error) alert('삭제하지 못했습니다.'); else { await Attach.remove(sb, p.attachments); loadPosts(); }
    });
    body.append(del);
  }
  head.addEventListener('click', () => {
    body.hidden = !body.hidden; li.classList.toggle('open', !body.hidden);
    if (!body.hidden && !attLoaded) { attLoaded = true; Attach.render(sb, p.attachments, attBox); }
  });
  li.append(head, body);
  return li;
}

document.querySelectorAll('.b-tab').forEach((b) => b.addEventListener('click', () => {
  board = b.dataset.board;
  document.querySelectorAll('.b-tab').forEach((x) => x.classList.toggle('active', x === b));
  loadPosts();
}));

const picker = Attach.createPicker();
$('writeForm').querySelector('.write-actions').before(picker.el);
$('writeBtn').addEventListener('click', () => { $('writeForm').hidden = false; $('writeForm').elements.title.focus(); });
$('cancelBtn').addEventListener('click', () => { $('writeForm').hidden = true; });

$('writeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements, msg = $('writeMsg');
  const title = f.title.value.trim(), content = f.content.value.trim();
  if (!title || !content) return say(msg, '제목과 내용을 입력해 주세요.');
  const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
  let attachments = [];
  try { attachments = await Attach.upload(sb, session.user.id, picker.files); }
  catch { btn.disabled = false; return say(msg, '파일을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
  const { error } = await sb.from('posts').insert({
    board, title, content, attachments, author_id: session.user.id,
    author_name: (profile && profile.name) || '조합원',
  });
  btn.disabled = false;
  if (error) { await Attach.remove(sb, attachments); return say(msg, '등록하지 못했습니다. 권한을 확인해 주세요.'); }
  e.target.reset(); picker.clear(); msg.textContent = '';
  loadPosts();
});

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements, msg = $('loginMsg');
  if (!configured) return say(msg, 'Supabase 설정 전입니다.');
  const { error } = await sb.auth.signInWithPassword({ email: Site.idToEmail(f.userid.value), password: f.password.value });
  if (error) say(msg, '아이디 또는 비밀번호가 올바르지 않습니다.');
});

document.querySelectorAll('.b-tab').forEach((x) => x.classList.toggle('active', x.dataset.board === board));

// 쪽 나누기
async function drawPager() {
  const pg = document.getElementById('pager'); if (!pg) return;
  const { count } = await sb.from('posts').select('id', { count: 'exact', head: true }).eq('board', board);
  const pages = Math.max(1, Math.ceil((count || 0) / POST_PAGE)); pg.innerHTML = '';
  if (pages < 2) return;
  const start = Math.max(1, Math.min(postPage - 2, pages - 4)), end = Math.min(pages, start + 4);
  const add = (label, n, on, dis) => { const x = document.createElement('button'); x.type = 'button'; x.textContent = label; x.className = on ? 'on' : ''; x.disabled = !!dis; x.addEventListener('click', () => { postPage = n; loadPosts(true); }); pg.append(x); };
  add('«', 1, false, postPage === 1); add('‹', postPage - 1, false, postPage === 1);
  for (let n = start; n <= end; n++) add(String(n), n, n === postPage);
  add('›', postPage + 1, false, postPage === pages); add('»', pages, false, postPage === pages);
}
const _loadPosts = loadPosts;
loadPosts = async function (keep) { await _loadPosts(keep); drawPager(); };
