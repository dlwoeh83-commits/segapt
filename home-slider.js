// 메인 사업개요 슬라이드: 승인된 회원에게만 도면·조감도 이미지를 보여 줍니다 (권한은 Supabase 규칙으로 보장)
(async () => {
  const stage = document.getElementById('slideStage'); if (!stage) return;
  const $ = (id) => document.getElementById(id);
  const lock = (html) => { stage.innerHTML = ''; const p = document.createElement('p'); p.className = 'slide-lock'; p.innerHTML = html; stage.append(p); $('slideCount').textContent = '– / –'; $('slideCap').textContent = ''; };
  const ok = window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase;
  if (!ok) return lock('준비 중입니다.');
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return lock('🔒 승인된 회원 전용 자료입니다.<br><a href="board.html">로그인</a> · <a href="join.html">회원가입</a>');
  const { data: me } = await sb.from('profiles').select('approved, is_admin').eq('id', session.user.id).maybeSingle();
  if (!me || !(me.approved || me.is_admin)) return lock('조합원 확인 후 승인되면 볼 수 있습니다.');

  const { data, error } = await sb.from('documents').select('ord, title, attachments').eq('doc', 'overview').order('ord');
  if (error || !data || !data.length) return lock('등록된 자료가 없습니다.');
  const paths = data.map((r) => r.attachments && r.attachments[0] && r.attachments[0].path).filter(Boolean);
  const { data: signed } = await sb.storage.from('attachments').createSignedUrls(paths, 3600);
  const urls = {}; (signed || []).forEach((s) => { if (s.signedUrl) urls[s.path] = s.signedUrl; });
  const slides = data.map((r) => ({ title: r.title, url: urls[r.attachments && r.attachments[0] && r.attachments[0].path] })).filter((s) => s.url);
  if (!slides.length) return lock('이미지를 불러오지 못했습니다.');

  let i = 0, timer = null;
  stage.innerHTML = '';
  const imgs = slides.map((s, n) => { const a = document.createElement('a'); a.href = s.url; a.target = '_blank'; a.rel = 'noopener'; a.className = 'slide' + (n === 0 ? ' on' : ''); const im = document.createElement('img'); im.src = s.url; im.alt = s.title; im.loading = n === 0 ? 'eager' : 'lazy'; a.append(im); stage.append(a); return a; });
  const show = (n) => {
    i = (n + slides.length) % slides.length;
    imgs.forEach((a, k) => a.classList.toggle('on', k === i));
    $('slideCount').textContent = `${i + 1} / ${slides.length}`;
    $('slideLine').style.width = `${((i + 1) / slides.length) * 100}%`;
    $('slideCap').textContent = slides[i].title.replace(' · ', ' | ');
  };
  const auto = () => { clearInterval(timer); timer = setInterval(() => show(i + 1), 5000); };
  $('slidePrev').addEventListener('click', () => { show(i - 1); auto(); });
  $('slideNext').addEventListener('click', () => { show(i + 1); auto(); });
  show(0); auto();
})();
