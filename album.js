// 구역앨범: 사진 카드 목록 → 사진 크게 보기 (승인된 회원 전용, 관리자 글쓰기·삭제)
(async () => {
  const ctx = await Site.gate(); if (!ctx) return;
  const { sb, session, isAdmin } = ctx;
  const view = document.getElementById('docView');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  let rows = [];

  async function list() {
    view.innerHTML = ''; view.append(el('h2', '', '구역앨범'));
    const { data, error } = await sb.from('documents').select('id, ord, title, content, posted_on, attachments, author, views').eq('doc', 'album').order('ord', { ascending: false });
    if (error) { view.append(el('p', 'empty', '앨범을 불러오지 못했습니다.')); return; }
    rows = data;
    const bar = el('div', 'b-toolbar'); bar.append(el('span', 'b-count', `총 ${rows.length}건`));
    if (isAdmin) { const w = el('button', 'btn btn-primary', '글쓰기'); w.type = 'button'; w.addEventListener('click', write); bar.append(w); }
    view.append(bar);
    const grid = el('div', 'album-grid'); view.append(grid);
    if (!rows.length) { view.append(el('p', 'empty', '등록된 사진이 없습니다.')); return; }
    const firstPaths = rows.map((r) => r.attachments && r.attachments[0] && Attach.IMG.test(Attach.ext(r.attachments[0].name)) ? r.attachments[0].path : null);
    const need = firstPaths.filter(Boolean);
    const urls = {};
    if (need.length) { const { data: s } = await sb.storage.from('attachments').createSignedUrls(need, 3600); (s || []).forEach((x) => { if (x.signedUrl) urls[x.path] = x.signedUrl; }); }
    rows.forEach((r, i) => {
      const card = el('button', 'album-card'); card.type = 'button';
      const th = el('div', 'thumb');
      const u = firstPaths[i] && urls[firstPaths[i]];
      if (u) { const im = el('img'); im.src = u; im.alt = r.title; im.loading = 'lazy'; th.append(im); } else th.append(el('span', '', '📷'));
      const info = el('div', 'info'); info.append(el('b', '', r.title), el('small', '', `${r.posted_on || ''} · 조회 ${r.views || 0}`));
      card.append(th, info); card.addEventListener('click', () => detail(r)); grid.append(card);
    });
  }

  function detail(r) {
    view.innerHTML = ''; view.append(el('h2', '', '구역앨범'));
    const head = el('div', 'post-top'); head.append(el('h3', '', r.title));
    const meta = el('dl', 'meta');
    [['작성자', r.author || '관리자'], ['작성일', r.posted_on || '-'], ['조회', r.views || 0]].forEach(([k, v]) => { const d = document.createElement('div'); d.append(el('dt', '', k), el('dd', '', v)); meta.append(d); });
    head.append(meta); view.append(head);
    if (r.content && r.content.trim() !== '.') view.append(el('p', 'p0 post-text', r.content));
    const box = el('div'); view.append(box); Attach.render(sb, r.attachments, box);
    const act = el('div', 'post-actions');
    const back = el('button', 'btn btn-navy', '← 목록'); back.type = 'button'; back.addEventListener('click', list); act.append(back);
    if (isAdmin) {
      const del = el('button', 'btn btn-danger', '삭제'); del.type = 'button';
      del.addEventListener('click', async () => {
        if (!confirm('이 글을 삭제할까요? 되돌릴 수 없습니다.')) return;
        const { error } = await sb.from('documents').delete().eq('id', r.id);
        if (error) return alert('삭제하지 못했습니다.');
        await Attach.remove(sb, r.attachments); list();
      });
      act.append(del);
    }
    view.append(act);
    view.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function write() {
    view.innerHTML = ''; view.append(el('h2', '', '구역앨범 · 글쓰기'));
    const f = el('form', 'write'); f.noValidate = true;
    const l1 = el('label', '', '제목'); const ti = el('input'); ti.type = 'text'; ti.maxLength = 200; l1.append(ti);
    const l2 = el('label', '', '작성일'); const di = el('input'); di.type = 'date'; di.value = new Date().toISOString().slice(0, 10); l2.append(di);
    const picker = Attach.createPicker();
    const msg = el('p', 'form-msg');
    const act = el('div', 'write-actions');
    const cancel = el('button', 'btn btn-navy', '취소'); cancel.type = 'button'; cancel.addEventListener('click', list);
    const ok = el('button', 'btn btn-primary', '등록'); ok.type = 'submit'; act.append(cancel, ok);
    f.append(l1, l2, picker.el, act, msg); view.append(f);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = ti.value.trim(); if (!title) { msg.className = 'form-msg err'; msg.textContent = '제목을 입력해 주세요.'; return; }
      ok.disabled = true; let attachments = [];
      try { attachments = await Attach.upload(sb, session.user.id, picker.files); } catch { ok.disabled = false; msg.className = 'form-msg err'; msg.textContent = '사진을 올리지 못했습니다.'; return; }
      const ord = rows.reduce((m, x) => Math.max(m, x.ord), 0) + 1;
      const { error } = await sb.from('documents').insert({ doc: 'album', ord, title, content: '', posted_on: di.value || null, attachments });
      ok.disabled = false;
      if (error) { await Attach.remove(sb, attachments); msg.className = 'form-msg err'; msg.textContent = '등록하지 못했습니다.'; return; }
      list();
    });
  }
  list();
})();
