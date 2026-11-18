// 회원 관리 (관리자 전용): 승인 대기 회원을 승인하거나 승인 취소합니다. 권한은 Supabase 규칙으로 보장됩니다.
(async () => {
  const $ = (id) => document.getElementById(id);
  const ok = window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase;
  if (!ok) { $('setupWarn').hidden = false; return; }
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const deny = (title, msg) => { $('deniedTitle').textContent = title; $('deniedMsg').textContent = msg; $('denied').hidden = false; };

  const { data: { session } } = await sb.auth.getSession();
  if (!session) return deny('로그인이 필요합니다', '관리자 계정으로 로그인해 주세요.');
  const { data: me } = await sb.from('profiles').select('is_admin').eq('id', session.user.id).maybeSingle();
  if (!me || !me.is_admin) return deny('관리자만 볼 수 있습니다', '이 화면은 관리자 계정으로만 열 수 있습니다.');
  $('memBox').hidden = false;

  let members = [], filter = 'pending', kw = '';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  async function load() {
    const { data, error } = await sb.from('profiles').select('id, name, login_id, phone, address, approved, is_admin, created_at').order('created_at', { ascending: false }).limit(1000);
    if (error) { $('memBody').innerHTML = ''; $('memEmpty').hidden = false; $('memEmpty').textContent = '회원 목록을 불러오지 못했습니다.'; return; }
    members = data; draw();
  }

  function draw() {
    $('cntPending').textContent = members.filter((m) => !m.approved && !m.is_admin).length;
    $('cntApproved').textContent = members.filter((m) => m.approved || m.is_admin).length;
    const list = members.filter((m) => {
      if (filter === 'pending' && (m.approved || m.is_admin)) return false;
      if (filter === 'approved' && !(m.approved || m.is_admin)) return false;
      const s = `${m.name} ${m.login_id} ${m.phone}`.toLowerCase();
      return !kw || s.includes(kw);
    });
    $('memCount').textContent = `${list.length}명`;
    $('memEmpty').hidden = list.length > 0; $('memEmpty').textContent = '해당하는 회원이 없습니다.';
    const tb = $('memBody'); tb.innerHTML = '';
    list.forEach((m) => {
      const tr = document.createElement('tr');
      const fmtPhone = (p) => (p || '').replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
      tr.append(el('td', '', m.name || '-'), el('td', '', m.login_id || '-'), el('td', '', fmtPhone(m.phone)), el('td', '', m.address || '-'), el('td', '', new Date(m.created_at).toLocaleDateString('ko-KR')));
      const st = el('td'); st.append(el('span', 'badge ' + (m.is_admin ? 'admin' : m.approved ? 'ok' : 'wait'), m.is_admin ? '관리자' : m.approved ? '승인됨' : '승인 대기')); tr.append(st);
      const act = el('td');
      if (m.is_admin) act.append(el('small', '', '-'));
      else {
        const b = el('button', m.approved ? 'btn btn-danger sm' : 'btn btn-primary sm', m.approved ? '승인 취소' : '승인'); b.type = 'button';
        b.addEventListener('click', async () => {
          if (m.approved && !confirm(`${m.name}(${m.login_id}) 님의 승인을 취소할까요?`)) return;
          b.disabled = true;
          const { error } = await sb.from('profiles').update({ approved: !m.approved }).eq('id', m.id);
          if (error) { alert('처리하지 못했습니다. 관리자 권한을 확인해 주세요.'); b.disabled = false; return; }
          m.approved = !m.approved; draw();
        });
        act.append(b);
      }
      tr.append(act); tb.append(tr);
    });
  }

  document.querySelectorAll('.b-tab').forEach((t) => t.addEventListener('click', () => {
    filter = t.dataset.f; document.querySelectorAll('.b-tab').forEach((x) => x.classList.toggle('active', x === t)); draw();
  }));
  $('memSearch').addEventListener('input', (e) => { kw = e.target.value.trim().toLowerCase(); draw(); });
  load();
})();
