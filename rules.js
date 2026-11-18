const $ = (id) => document.getElementById(id);
const TITLES = {
  bylaws: '조합정관', operations: '업무규정', election: '선거관리규정', contracts: '업체선정계약서',
  minutes: '회의록', plan: '사업시행계획', disposal: '관리처분계획', official: '공문서', audit: '회계/감사', etc: '기타',
  newsletter: '소식지', report: '경과보고', schedule: '추진일정', pds: '자료실',
};
const TAB_LABELS = { election: '선거규정' };
const TEXT_DOCS = ['bylaws', 'operations', 'election'];
const CFG = window.DOCPAGE || { tabs: ['bylaws', 'operations', 'election', 'contracts', 'minutes', 'plan', 'disposal', 'official', 'audit', 'etc'] };
const isBoardDoc = (d) => !TEXT_DOCS.includes(d);
const configured = window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase;
let sb, cur = CFG.tabs[0], rows = [], active = 0, isAdmin = false;

(function buildTabs() {
  const nav = $('docTabs'); if (!nav) return; nav.innerHTML = '';
  CFG.tabs.forEach((k) => { const a = document.createElement('a'); a.href = '#' + k; a.dataset.doc = k; a.textContent = TAB_LABELS[k] || TITLES[k]; nav.append(a); });
})();

if (!configured) $('setupWarn').hidden = false;
else {
  sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  init();
}

async function init() {
  const { data: { session } } = await sb.auth.getSession();
  const util = $('utilLinks');
  if (session) {
    util.innerHTML = '';
    const a = document.createElement('a'); a.href = '#'; a.textContent = '로그아웃';
    a.addEventListener('click', async (e) => { e.preventDefault(); await sb.auth.signOut(); location.reload(); });
    util.append(a);
  }
  if (!session) return gate('로그인 후 이용해 주세요.');
  const { data: me } = await sb.from('profiles').select('approved, is_admin').eq('id', session.user.id).maybeSingle();
  if (!me || !(me.approved || me.is_admin)) return gate('조합원 확인 후 승인되면 이용하실 수 있습니다.');
  isAdmin = !!me.is_admin;
  $('gate').hidden = true; $('docBox').hidden = false;
  const h = location.hash.slice(1);
  if (CFG.tabs.includes(h)) cur = h;
  load();
}
function gate(msg) { $('gateMsg').textContent = msg; $('gate').hidden = false; $('docBox').hidden = true; }

window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (CFG.tabs.includes(h) && configured && !$('docBox').hidden) { cur = h; load(); } });

async function load() {
  document.querySelectorAll('#docTabs a').forEach((a) => a.classList.toggle('on', a.dataset.doc === cur));
  $('docView').innerHTML = '<p class="empty">불러오는 중...</p>';
  const { data, error } = await sb.from('documents').select('id, ord, title, content, posted_on, attachments, author, views').eq('doc', cur).order('ord', { ascending: !isBoardDoc(cur) }).limit(2000);
  if (error) { $('docView').innerHTML = '<p class="empty">자료를 불러오지 못했습니다.</p>'; return; }
  rows = data; active = 0;
  const layout = $('docView').parentElement;
  layout.classList.toggle('board-mode', isBoardDoc(cur));
  if (isBoardDoc(cur)) { layout.classList.remove('list-mode'); $('chapNav').hidden = true; bPage = 1; bKw = ''; return renderBoard(); }
  if (cur === 'election') return setupList(splitArticles(rows[0] ? rows[0].content : ''), renderArticleDetail, '조항 검색');
  $('chapNav').className = 'chap-nav'; $('docView').parentElement.classList.remove('list-mode');
  renderChapterNav(); renderDoc();
}

function renderChapterNav() {
  const nav = $('chapNav'); nav.innerHTML = '';
  rows.forEach((r, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = r.title;
    b.className = i === active ? 'on' : '';
    b.addEventListener('click', () => { active = i; renderChapterNav(); renderDoc(); window.scrollTo({ top: document.querySelector('.docs-main').offsetTop - 80, behavior: 'smooth' }); });
    nav.append(b);
  });
  nav.hidden = rows.length < 2;
}

// 규정 본문을 조·항 단위로 보기 좋게 표시 (모두 textContent로 삽입)
function renderDoc() {
  const v = $('docView'); v.innerHTML = '';
  const r = rows[active]; if (!r) return;
  const head = document.createElement('h2'); head.textContent = `${TITLES[cur]} · ${r.title}`; v.append(head);
  let art = null;
  const mk = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = text; (parent || v).append(e); return e; };
  r.content.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line) => {
    if (/^(제정|개정)\s*:/.test(line)) return mk('p', 'rev', line);
    if (/^제\s*\d+\s*장/.test(line)) { art = null; return mk('h3', 'chap', line.replace(/^제\s*(\d+)\s*장\s*/, '제$1장  ')); }
    if (/^제\s*\d+\s*절/.test(line)) { art = null; return mk('h4', 'sec', line); }
    if (/^부\s*칙/.test(line)) { art = null; return mk('h3', 'chap', line); }
    const m = line.match(/^(제\s*\d+\s*조(?:의\s*\d+)?\s*(?:\([^)]*\))?)\s*(.*)$/);
    if (m) {
      art = document.createElement('section'); art.className = 'art'; v.append(art);
      mk('h5', '', m[1], art);
      if (m[2]) mk('p', 'p0', m[2], art);
      return;
    }
    const cls = /^[①-⑳]/.test(line) ? 'p1' : /^(\d+\.|[가-하]\.|\d+\)|[-·ㆍ])/.test(line) ? 'p2' : 'p0';
    mk('p', cls, line, art || v);
  });
}


// ---- 좌측 목록 / 우측 내용 화면 (선거규정, 업체선정계약서) ----
function splitArticles(text) {
  const items = []; let head = [], cur = null;
  text.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line) => {
    const m = line.match(/^(제\s*\d+\s*조(?:의\s*\d+)?\s*(?:\([^)]*\))?)\s*(.*)$/);
    if (m) { cur = { label: m[1].replace(/^제\s*(\d+)\s*조/, '제$1조').replace(/조\s*의\s*(\d+)/, '조의$1'), sub: '', lines: m[2] ? [m[2]] : [] }; items.push(cur); }
    else if (cur) cur.lines.push(line);
    else head.push(line);
  });
  items.forEach((it) => { it.head = head; });
  return items;
}

let listItems = [], listRender = null, listActive = 0;
function setupList(items, renderDetail, placeholder) {
  listItems = items; listRender = renderDetail; listActive = 0;
  const layout = $('docView').parentElement; layout.classList.add('list-mode');
  const nav = $('chapNav'); nav.hidden = false; nav.className = 'chap-nav list-nav';
  nav.innerHTML = '';
  const q = document.createElement('input'); q.type = 'search'; q.placeholder = placeholder; q.className = 'doc-search';
  const ul = document.createElement('div'); ul.className = 'list-scroll'; nav.append(q, ul);
  const draw = () => {
    const kw = q.value.trim().toLowerCase(); ul.innerHTML = '';
    listItems.forEach((it, i) => {
      if (kw && !(it.label + ' ' + it.sub).toLowerCase().includes(kw)) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = i === listActive ? 'on' : '';
      const t = document.createElement('b'); t.textContent = it.label; b.append(t);
      if (it.sub) { const s = document.createElement('small'); s.textContent = it.sub; b.append(s); }
      b.addEventListener('click', () => { listActive = i; draw(); show(); if (window.innerWidth <= 900) $('docView').scrollIntoView({ behavior: 'smooth' }); });
      ul.append(b);
    });
    if (!ul.children.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = '검색 결과가 없습니다.'; ul.append(p); }
  };
  const show = () => { const v = $('docView'); v.innerHTML = ''; listRender(listItems[listActive], v); };
  q.addEventListener('input', draw); draw(); show();
}

function renderArticleDetail(it, v) {
  if (!it) { v.innerHTML = '<p class="empty">내용이 없습니다.</p>'; return; }
  const h = document.createElement('h2'); h.textContent = `${TITLES[cur]}`; v.append(h);
  const rev = it.head.find((l) => /^제\s*\d+\s*장/.test(l));
  if (rev) { const c = document.createElement('h3'); c.className = 'chap'; c.textContent = rev.replace(/^제\s*(\d+)\s*장\s*/, '제$1장  '); v.append(c); }
  const a = document.createElement('section'); a.className = 'art'; v.append(a);
  const t = document.createElement('h5'); t.textContent = it.label; a.append(t);
  it.lines.forEach((line) => {
    const p = document.createElement('p');
    p.className = /^[①-⑳]/.test(line) ? 'p1' : /^(\d+\.|[가-하]\.|\d+\)|[-·ㆍ])/.test(line) ? 'p2' : 'p0';
    p.textContent = line; a.append(p);
  });
}


// ---- 업체선정계약서: 게시판 형태 (목록 → 글보기, 관리자 글쓰기·삭제) ----
const PAGE = 15; let bPage = 1, bKw = '';
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

function renderBoard() {
  const v = $('docView'); v.innerHTML = '';
  v.append(el('h2', '', TITLES[cur]));

  const bar = el('div', 'b-toolbar');
  const q = el('input', 'doc-search'); q.type = 'search'; q.placeholder = '제목 검색'; q.value = bKw;
  q.addEventListener('input', () => { bKw = q.value.trim().toLowerCase(); bPage = 1; drawTable(); });
  const cnt = el('span', 'b-count'); cnt.id = 'bCount';
  bar.append(q, cnt);
  if (isAdmin) { const w = el('button', 'btn btn-primary', '글쓰기'); w.type = 'button'; w.addEventListener('click', () => renderWrite()); bar.append(w); }
  v.append(bar);

  const wrap = el('div', 'table-wrap'); wrap.id = 'bWrap'; v.append(wrap);
  const pg = el('div', 'pager'); pg.id = 'bPager'; v.append(pg);
  drawTable();
}

function drawTable() {
  const list = rows.filter((r) => r.title.toLowerCase().includes(bKw));
  const pages = Math.max(1, Math.ceil(list.length / PAGE)); if (bPage > pages) bPage = pages;
  $('bCount').textContent = `총 ${list.length}건`;
  const wrap = $('bWrap'); wrap.innerHTML = '';
  const t = el('table', 'tbl left board-tbl');
  t.innerHTML = '<thead><tr><th>번호</th><th>제목</th><th>작성자</th><th>작성일</th><th>조회</th></tr></thead>';
  const tb = document.createElement('tbody');
  const slice = list.slice((bPage - 1) * PAGE, bPage * PAGE);
  slice.forEach((r) => {
    const tr = document.createElement('tr'); tr.className = 'clickable'; tr.tabIndex = 0;
    const open = () => renderPost(r);
    tr.addEventListener('click', open); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    tr.append(el('td', 'no', r.ord), el('td', 'ttl', (r.attachments && r.attachments.length ? '📎 ' : '') + r.title), el('td', 'who', r.author || '관리자'), el('td', 'dt', r.posted_on || ''), el('td', 'vw', r.views || 0));
    tb.append(tr);
  });
  if (!slice.length) { const tr = document.createElement('tr'); const td = el('td', '', '게시글이 없습니다.'); td.colSpan = 5; tr.append(td); tb.append(tr); }
  t.append(tb); wrap.append(t);

  const pager = $('bPager'); pager.innerHTML = '';
  const start = Math.max(1, Math.min(bPage - 2, pages - 4)), end = Math.min(pages, start + 4);
  const add = (label, n, on, dis) => { const b = el('button', on ? 'on' : '', label); b.type = 'button'; b.disabled = !!dis; b.addEventListener('click', () => { bPage = n; drawTable(); }); pager.append(b); };
  add('«', 1, false, bPage === 1); add('‹', bPage - 1, false, bPage === 1);
  for (let n = start; n <= end; n++) add(String(n), n, n === bPage);
  add('›', bPage + 1, false, bPage === pages); add('»', pages, false, bPage === pages);
}

function renderPost(r) {
  const v = $('docView'); v.innerHTML = '';
  v.append(el('h2', '', TITLES[cur]));
  const head = el('div', 'post-top'); head.append(el('h3', '', r.title));
  const meta = el('dl', 'meta');
  [['번호', r.ord], ['작성자', r.author || '관리자'], ['작성일', r.posted_on || '-'], ['조회', r.views || 0]].forEach(([k, val]) => { const d = document.createElement('div'); d.append(el('dt', '', k), el('dd', '', val)); meta.append(d); });
  head.append(meta); v.append(head);
  if (r.content) v.append(el('p', 'p0 post-text', r.content));
  const attBox = el('div'); v.append(attBox);
  Attach.render(sb, r.attachments, attBox);
  const act = el('div', 'post-actions');
  const back = el('button', 'btn btn-navy', '← 목록'); back.type = 'button'; back.addEventListener('click', renderBoard); act.append(back);
  if (isAdmin) {
    const del = el('button', 'btn btn-danger', '삭제'); del.type = 'button';
    del.addEventListener('click', async () => {
      if (!confirm('이 글을 삭제할까요? 되돌릴 수 없습니다.')) return;
      const { error } = await sb.from('documents').delete().eq('id', r.id);
      if (error) return alert('삭제하지 못했습니다.');
      await Attach.remove(sb, r.attachments);
      rows = rows.filter((x) => x.id !== r.id); renderBoard();
    });
    act.append(del);
  }
  v.append(act);
  v.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderWrite() {
  const v = $('docView'); v.innerHTML = '';
  v.append(el('h2', '', TITLES[cur] + ' · 글쓰기'));
  const f = el('form', 'write'); f.noValidate = true;
  const l1 = el('label', '', '제목'); const ti = el('input'); ti.type = 'text'; ti.maxLength = 200; l1.append(ti);
  const l2 = el('label', '', '작성일'); const di = el('input'); di.type = 'date'; di.value = new Date().toISOString().slice(0, 10); l2.append(di);
  const l3 = el('label', '', '내용(선택)'); const tx = el('textarea'); tx.rows = 6; tx.maxLength = 5000; l3.append(tx);
  const picker = Attach.createPicker();
  const msg = el('p', 'form-msg'); msg.setAttribute('role', 'status');
  const act = el('div', 'write-actions');
  const cancel = el('button', 'btn btn-navy', '취소'); cancel.type = 'button'; cancel.addEventListener('click', renderBoard);
  const ok = el('button', 'btn btn-primary', '등록'); ok.type = 'submit';
  act.append(cancel, ok);
  f.append(l1, l2, l3, picker.el, act, msg); v.append(f);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = ti.value.trim();
    if (!title) { msg.className = 'form-msg err'; msg.textContent = '제목을 입력해 주세요.'; return; }
    const ord = rows.reduce((m, x) => Math.max(m, x.ord), 0) + 1;
    ok.disabled = true;
    let attachments = [];
    try { const { data: { session } } = await sb.auth.getSession(); attachments = await Attach.upload(sb, session.user.id, picker.files); }
    catch { ok.disabled = false; msg.className = 'form-msg err'; msg.textContent = '파일을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.'; return; }
    const { data, error } = await sb.from('documents').insert({ doc: cur, ord, title, content: tx.value.trim(), posted_on: di.value || null, attachments }).select('id, ord, title, content, posted_on, attachments, author, views').single();
    ok.disabled = false;
    if (error) { await Attach.remove(sb, attachments); msg.className = 'form-msg err'; msg.textContent = '등록하지 못했습니다. 관리자 권한을 확인해 주세요.'; return; }
    rows.unshift(data); bPage = 1; bKw = ''; renderBoard();
  });
}
