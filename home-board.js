// 메인 페이지 게시판: 승인된 회원에게만 최신 글 5건을 보여줍니다 (권한은 Supabase 규칙으로 보장)
(async () => {
  const lists = document.querySelectorAll('ul[data-board]');
  if (!lists.length) return;
  const lock = (ul, html) => { ul.innerHTML = ''; const li = document.createElement('li'); li.className = 'lock'; li.innerHTML = html; ul.append(li); };
  const configured = window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase;
  if (!configured) return lists.forEach((ul) => lock(ul, '게시판 준비 중입니다.'));

  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return lists.forEach((ul) => lock(ul, '🔒 승인된 회원 전용입니다.<br><a href="board.html">로그인</a> · <a href="join.html">회원가입</a>'));

  const { data: me } = await sb.from('profiles').select('approved, is_admin').eq('id', session.user.id).maybeSingle();
  if (!me || !(me.approved || me.is_admin)) return lists.forEach((ul) => lock(ul, '조합원 확인 후 승인되면 글을 볼 수 있습니다.'));

  const weekAgo = Date.now() - 7 * 864e5;
  for (const ul of lists) {
    const board = ul.dataset.board;
    if (board === 'data') {
      const { data: docs, error: de } = await sb.from('documents').select('id, doc, title, posted_on').in('doc', ['official', 'minutes', 'audit', 'plan', 'disposal']).order('posted_on', { ascending: false }).order('ord', { ascending: false }).limit(5);
      if (de || !docs || !docs.length) { lock(ul, '등록된 글이 없습니다.'); continue; }
      ul.innerHTML = '';
      docs.forEach((p) => {
        const li = document.createElement('li'); const a = document.createElement('a'); a.href = `rules.html#${p.doc}`;
        if (new Date(p.posted_on).getTime() > weekAgo) { const n = document.createElement('span'); n.className = 'new'; n.textContent = 'NEW'; a.append(n); }
        const t = document.createElement('span'); t.className = 'ttl'; t.textContent = p.title; a.append(t);
        const d = document.createElement('time'); d.textContent = (p.posted_on || '').slice(5).replace('-', '.'); a.append(d);
        li.append(a); ul.append(li);
      });
      continue;
    }
    const { data, error } = await sb.from('posts').select('id, title, created_at').eq('board', board).order('created_at', { ascending: false }).limit(5);
    if (error) { lock(ul, '글을 불러오지 못했습니다.'); continue; }
    if (!data.length) { lock(ul, '등록된 글이 없습니다.'); continue; }
    ul.innerHTML = '';
    data.forEach((p) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `board.html?board=${board}`;
      if (new Date(p.created_at).getTime() > weekAgo) { const n = document.createElement('span'); n.className = 'new'; n.textContent = 'NEW'; a.append(n); }
      const t = document.createElement('span'); t.className = 'ttl'; t.textContent = p.title; a.append(t);
      const d = document.createElement('time'); d.textContent = new Date(p.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }); a.append(d);
      li.append(a); ul.append(li);
    });
  }
})();
