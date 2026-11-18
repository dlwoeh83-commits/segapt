// 회원가입 신청: Supabase 계정 생성(승인 전 상태) → 관리자가 승인하면 게시판 이용 가능
const form = document.getElementById('joinForm');
const msg = document.getElementById('joinMsg');
const btn = form.querySelector('button[type=submit]');
const say = (text, ok) => { msg.textContent = text; msg.className = 'form-msg ' + (ok ? 'ok' : 'err'); };

const configured = window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase;
const sb = configured ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = form.elements;
  const phone = f.phone.value.replace(/\D/g, '');
  if (f._gotcha.value) return; // 스팸 봇
  if (!f.name.value.trim()) return say('이름을 입력해 주세요.');
  if (!/^01[016789]\d{7,8}$/.test(phone)) return say('휴대폰 번호를 정확히 입력해 주세요.');
  if (!/^[A-Za-z0-9]{4,16}$/.test(f.userid.value.trim())) return say('아이디는 영문·숫자 4~16자로 입력해 주세요.');
  if (f.password.value.length < 8) return say('비밀번호는 8자 이상으로 입력해 주세요.');
  if (f.password.value !== f.password2.value) return say('비밀번호 확인이 일치하지 않습니다.');
  if (!f.kind.value) return say('구분을 선택해 주세요.');
  if (!f.agree.checked) return say('개인정보 수집·이용에 동의해 주세요.');
  if (!sb) return say('온라인 가입을 준비 중입니다. 조합 사무실(031-618-4510~1)로 문의해 주세요.');

  btn.disabled = true; btn.textContent = '전송 중...';
  try {
    const { error } = await sb.auth.signUp({
      email: Site.idToEmail(f.userid.value),
      password: f.password.value,
      options: { data: { name: f.name.value.trim(), phone, address: f.address.value.trim(), login_id: f.userid.value.trim().toLowerCase() } },
    });
    if (error) {
      say(/registered|already/i.test(error.message) ? '이미 사용 중인 아이디입니다.' : '가입 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } else {
      say('가입 신청이 접수되었습니다. 조합원 확인 후 승인되면 아이디와 비밀번호로 로그인해 게시판을 이용하실 수 있습니다.', true);
      form.reset();
    }
  } catch {
    say('전송에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    btn.disabled = false; btn.textContent = '가입 신청하기';
  }
});
