// 비밀번호 변경: 현재 비밀번호를 다시 확인한 뒤 새 비밀번호로 바꿉니다.
(async () => {
  const $ = (id) => document.getElementById(id);
  const ok = window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase;
  if (!ok) { $('setupWarn').hidden = false; return; }
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { $('needLogin').hidden = false; return; }

  const { data: me } = await sb.from('profiles').select('name').eq('id', session.user.id).maybeSingle();
  $('whoAmI').textContent = `${(me && me.name) || ''} (${Site.emailToId(session.user.email)})`.trim();
  $('pwBox').hidden = false;

  const form = $('pwForm'), msg = $('pwMsg'), btn = form.querySelector('button[type=submit]');
  const say = (t, good) => { msg.textContent = t; msg.className = 'form-msg ' + (good ? 'ok' : 'err'); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const cur = f.current.value, nx = f.next.value;
    if (!cur) return say('현재 비밀번호를 입력해 주세요.');
    if (nx.length < 8) return say('새 비밀번호는 8자 이상으로 입력해 주세요.');
    if (!/[A-Za-z]/.test(nx) || !/\d/.test(nx)) return say('새 비밀번호에 영문과 숫자를 함께 넣어 주세요.');
    if (nx !== f.next2.value) return say('새 비밀번호 확인이 일치하지 않습니다.');
    if (nx === cur) return say('현재 비밀번호와 다른 비밀번호를 입력해 주세요.');

    btn.disabled = true; btn.textContent = '변경 중...';
    try {
      // 1) 현재 비밀번호가 맞는지 다시 확인
      const re = await sb.auth.signInWithPassword({ email: session.user.email, password: cur });
      if (re.error) return say('현재 비밀번호가 올바르지 않습니다.');
      // 2) 새 비밀번호로 변경
      const up = await sb.auth.updateUser({ password: nx });
      if (up.error) return say(/different|same/i.test(up.error.message) ? '현재 비밀번호와 다른 비밀번호를 입력해 주세요.' : '변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      say('비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.', true);
      form.reset();
    } catch {
      say('변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      btn.disabled = false; btn.textContent = '비밀번호 변경';
    }
  });
})();
