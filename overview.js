// 사업개요: 평형안내 / 구역현황 / 설계개요 (도면·조감도 이미지) — 승인된 회원 전용
(async () => {
  const GROUPS = { type: '평형안내', area: '구역현황', design: '설계개요' };
  const ctx = await Site.gate(); if (!ctx) return;
  const { sb } = ctx;
  const view = document.getElementById('docView');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const { data, error } = await sb.from('documents').select('ord, title, attachments').eq('doc', 'overview').order('ord');
  if (error) { view.innerHTML = '<p class="empty">자료를 불러오지 못했습니다.</p>'; return; }
  const tabs = document.querySelectorAll('#docTabs a');
  let cur = GROUPS[location.hash.slice(1)] ? location.hash.slice(1) : 'type';

  async function show() {
    tabs.forEach((a) => a.classList.toggle('on', a.dataset.doc === cur));
    const label = GROUPS[cur];
    view.innerHTML = ''; view.append(el('h2', '', label));
    view.append(el('p', 'rev', '그림을 누르면 큰 화면으로 볼 수 있습니다.'));
    const items = data.filter((r) => r.title.startsWith(label + ' · '));
    const grid = el('div', 'ov-grid'); view.append(grid);
    const paths = items.map((r) => r.attachments && r.attachments[0] && r.attachments[0].path).filter(Boolean);
    const { data: signed } = paths.length ? await sb.storage.from('attachments').createSignedUrls(paths, 3600) : { data: [] };
    const map = {}; (signed || []).forEach((s) => { if (s.signedUrl) map[s.path] = s.signedUrl; });
    items.forEach((r) => {
      const p = r.attachments && r.attachments[0] && r.attachments[0].path; const u = p && map[p];
      const fig = el('figure', 'ov-fig');
      if (u) { const a = el('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; const im = el('img'); im.src = u; im.alt = r.title; a.append(im); fig.append(a); }
      fig.append(el('figcaption', '', r.title.split(' · ')[1] || r.title)); grid.append(fig);
    });
    if (!items.length) view.append(el('p', 'empty', '등록된 자료가 없습니다.'));
  }
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (GROUPS[h]) { cur = h; show(); } });
  show();
})();
