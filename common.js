// 공통: 전체 메뉴(하위 메뉴 포함) 주입 + 승인된 회원 전용 확인
(function () {
  const MENU = [
    { t: '조합소개', h: 'about.html', s: [['조합장인사말', 'about.html#greeting'], ['임원명단', 'about.html#officers'], ['오시는길', 'about.html#directions'], ['협력사', 'about.html#partners']] },
    { t: '공개자료', h: 'rules.html', s: [['조합정관', 'rules.html#bylaws'], ['업무규정', 'rules.html#operations'], ['선거규정', 'rules.html#election'], ['업체선정계약서', 'rules.html#contracts'], ['회의록', 'rules.html#minutes'], ['사업시행계획', 'rules.html#plan'], ['관리처분계획', 'rules.html#disposal'], ['공문서', 'rules.html#official'], ['회계/감사', 'rules.html#audit'], ['기타', 'rules.html#etc']] },
    { t: '사업개요', h: 'overview.html', s: [['평형안내', 'overview.html#type'], ['구역현황', 'overview.html#area'], ['설계개요', 'overview.html#design']] },
    { t: '조합소식', h: 'news.html', s: [['소식지', 'news.html#newsletter'], ['경과보고', 'news.html#report'], ['추진일정', 'news.html#schedule']] },
    { t: '공지사항', h: 'board.html?board=notice', s: [] },
    { t: '조합마당', h: 'board.html?board=free', s: [['게시판', 'board.html?board=free'], ['자료실', 'pds.html']] },
    { t: '구역앨범', h: 'album.html', s: [] },
  ];

  function buildNav() {
    const nav = document.querySelector('.site-nav'); if (!nav) return;
    nav.innerHTML = '';
    MENU.forEach((m) => {
      const li = document.createElement('div'); li.className = 'nav-item' + (m.s.length ? ' has-sub' : '');
      const a = document.createElement('a'); a.href = m.h; a.textContent = m.t; li.append(a);
      if (m.s.length) {
        const sub = document.createElement('div'); sub.className = 'sub';
        m.s.forEach(([t, h]) => { const x = document.createElement('a'); x.href = h; x.textContent = t; sub.append(x); });
        li.append(sub);
      }
      nav.append(li);
    });
    // 현재 페이지 표시
    const here = location.pathname.split('/').pop() || 'index.html';
    const hereBoard = new URLSearchParams(location.search).get('board') || 'notice';
    nav.querySelectorAll('.nav-item > a').forEach((a) => {
      const href = a.getAttribute('href'); const file = href.split(/[?#]/)[0];
      if (file !== here) return;
      if (file === 'board.html') { const b = new URLSearchParams(href.split('?')[1] || '').get('board') || 'notice'; if (b === hereBoard || (hereBoard === 'data' && b === 'notice')) a.classList.add('cur'); }
      else a.classList.add('cur');
    });
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      nav.classList.remove('open');
      const t = document.querySelector('.nav-toggle'); if (t) t.setAttribute('aria-expanded', 'false');
    }));
  }
  // 헤더 오른쪽 어두운 버튼 (참조 사이트의 구성처럼)
  function addCta() {
    const hi = document.querySelector('.header-inner'); if (!hi || hi.querySelector('.head-cta')) return;
    const a = document.createElement('a'); a.className = 'head-cta'; a.href = 'board.html';
    a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg><span>조합원<br>로그인</span>';
    hi.append(a);
    // 이미 로그인한 상태면 '로그아웃' 버튼으로 바꿈 (저장된 로그인 정보만 확인하고, 로그아웃할 때만 서버에 연결)
    try {
      const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
      const s = key && JSON.parse(localStorage.getItem(key));
      if (s && s.access_token && (!s.expires_at || s.expires_at * 1000 > Date.now())) {
        a.querySelector('span').innerHTML = '조합원<br>로그아웃'; a.href = '#';
        a.addEventListener('click', async (e) => {
          e.preventDefault();
          if (window.supabase && window.SUPABASE_URL) { const c = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY); await c.auth.signOut(); }
          location.href = 'index.html';
        });
      }
    } catch { /* 무시 */ }
  }
  function bindToggle() {
    // index는 script.js가 이미 처리함
    if (document.querySelector('script[src^="script.js"]')) return;
    const t = document.querySelector('.nav-toggle'), nav = document.querySelector('.site-nav'); if (!t || !nav) return;
    t.addEventListener('click', () => { const o = nav.classList.toggle('open'); t.setAttribute('aria-expanded', String(o)); t.setAttribute('aria-label', o ? '메뉴 닫기' : '메뉴 열기'); });
  }
  const start = () => { buildNav(); addCta(); bindToggle(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  // 승인된 회원 전용 페이지 준비: 로그인·승인 여부 확인 후 {sb, session, isAdmin} 반환 (아니면 안내 표시)
  async function gate(opts) {
    const $ = (id) => document.getElementById(id);
    const ok = window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase;
    if (!ok) { if ($('setupWarn')) $('setupWarn').hidden = false; return null; }
    const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    const { data: { session } } = await sb.auth.getSession();
    const util = $('utilLinks');
    if (session && util) {
      util.innerHTML = '';
      const a = document.createElement('a'); a.href = '#'; a.textContent = '로그아웃';
      a.addEventListener('click', async (e) => { e.preventDefault(); await sb.auth.signOut(); location.reload(); });
      util.append(a);
    }
    const deny = (msg) => { $('gateMsg').textContent = msg; $('gate').hidden = false; $('docBox').hidden = true; return null; };
    if (!session) return deny('로그인 후 이용해 주세요.');
    const { data: me } = await sb.from('profiles').select('name, approved, is_admin').eq('id', session.user.id).maybeSingle();
    if (!me || !(me.approved || me.is_admin)) return deny('조합원 확인 후 승인되면 이용하실 수 있습니다.');
    $('gate').hidden = true; $('docBox').hidden = false;
    return { sb, session, isAdmin: !!me.is_admin, name: me.name || '' };
  }
  // 아이디로 로그인·가입: Supabase는 이메일 형식이 필요해서 아이디를 내부용 주소로 바꿔 사용합니다.
  // (예전에 이메일로 만든 계정은 @가 들어 있으면 그대로 이메일로 로그인)
  const ID_DOMAIN = 'member.segyo1.kr';
  const idToEmail = (id) => { const v = String(id || '').trim(); return v.includes('@') ? v : v.toLowerCase() + '@' + ID_DOMAIN; };
  const emailToId = (email) => String(email || '').endsWith('@' + ID_DOMAIN) ? email.slice(0, -(ID_DOMAIN.length + 1)) : email;
  window.Site = { gate, idToEmail, emailToId };
})();
