// 첨부파일 공용 모듈 — Supabase Storage(비공개 'attachments' 버킷, 승인된 회원만 열람)
(function () {
  const BUCKET = 'attachments';
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB (버킷 설정과 동일)
  const MAX_FILES = 5;
  const IMG = /^(jpe?g|png|gif|webp)$/i;
  const ALLOWED = /^(jpe?g|png|gif|webp|pdf|hwp|hwpx|docx?|xlsx?|pptx?|txt|zip)$/i;

  const ext = (n) => { const m = /\.([A-Za-z0-9]+)$/.exec(n || ''); return m ? m[1].toLowerCase() : ''; };
  const fmt = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  // 글쓰기 폼에 넣는 파일 선택기 (이미지는 미리보기 표시)
  function createPicker() {
    const wrap = el('div', 'attach-picker');
    const label = el('label', 'attach-drop');
    label.append(el('b', '', '📎 파일 첨부'), el('span', '', `사진·PDF·한글·워드·엑셀·zip / 파일당 10MB, 최대 ${MAX_FILES}개`));
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true;
    input.accept = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip';
    label.append(input);
    const list = el('ul', 'attach-list');
    const msg = el('p', 'attach-msg');
    wrap.append(label, list, msg);
    const api = { el: wrap, files: [] };

    const draw = () => {
      list.innerHTML = '';
      api.files.forEach((f, i) => {
        const li = el('li');
        if (IMG.test(ext(f.name))) { const im = el('img'); im.alt = ''; im.src = URL.createObjectURL(f); im.onload = () => URL.revokeObjectURL(im.src); li.append(im); }
        else li.append(el('span', 'ico', '📄'));
        li.append(el('span', 'nm', f.name), el('small', '', fmt(f.size)));
        const rm = el('button', '', '✕'); rm.type = 'button'; rm.setAttribute('aria-label', '첨부 취소');
        rm.addEventListener('click', () => { api.files.splice(i, 1); draw(); });
        li.append(rm); list.append(li);
      });
    };
    input.addEventListener('change', () => {
      msg.textContent = '';
      for (const f of input.files) {
        if (api.files.length >= MAX_FILES) { msg.textContent = `파일은 최대 ${MAX_FILES}개까지 첨부할 수 있습니다.`; break; }
        if (!ALLOWED.test(ext(f.name))) { msg.textContent = `'${f.name}'은(는) 첨부할 수 없는 형식입니다.`; continue; }
        if (f.size > MAX_SIZE) { msg.textContent = `'${f.name}'은(는) 10MB를 넘어 첨부할 수 없습니다.`; continue; }
        api.files.push(f);
      }
      input.value = ''; draw();
    });
    api.clear = () => { api.files = []; msg.textContent = ''; draw(); };
    return api;
  }

  // 업로드 → 저장 경로 정보 배열 반환
  async function upload(sb, uid, files) {
    const out = [];
    try {
      for (const f of files) {
        const path = `${uid}/${crypto.randomUUID()}.${ext(f.name)}`;
        const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
        if (error) throw error;
        out.push({ path, name: f.name, size: f.size, type: f.type || '' });
      }
    } catch (e) { await remove(sb, out); throw e; }
    return out;
  }

  async function remove(sb, metas) {
    if (!metas || !metas.length) return;
    try { await sb.storage.from(BUCKET).remove(metas.map((m) => m.path)); } catch { /* 무시 */ }
  }

  // 글 안에 첨부 표시: 이미지는 본문에 바로 보이고, 나머지는 내려받기 링크
  async function render(sb, metas, parent) {
    if (!metas || !metas.length) return;
    const box = el('div', 'att'); parent.append(box);
    const imgs = metas.filter((m) => IMG.test(ext(m.name)));
    const files = metas.filter((m) => !IMG.test(ext(m.name)));
    if (imgs.length) {
      const grid = el('div', 'att-images'); box.append(grid);
      const { data } = await sb.storage.from(BUCKET).createSignedUrls(imgs.map((m) => m.path), 3600);
      imgs.forEach((m, i) => {
        const url = data && data[i] && data[i].signedUrl; if (!url) return;
        const a = el('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.title = m.name;
        const im = el('img'); im.src = url; im.alt = m.name; im.loading = 'lazy'; a.append(im); grid.append(a);
      });
    }
    if (files.length) {
      const ul = el('ul', 'att-files'); box.append(ul);
      for (const m of files) {
        const li = el('li'); ul.append(li);
        const { data } = await sb.storage.from(BUCKET).createSignedUrl(m.path, 3600, { download: m.name });
        const a = el('a', '', '📎 ' + m.name); if (data) a.href = data.signedUrl; a.rel = 'noopener';
        li.append(a, el('small', '', fmt(m.size)));
      }
    }
  }

  window.Attach = { createPicker, upload, remove, render, IMG, ext };
})();
