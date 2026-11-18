# 게시판 설정 (Supabase)

1. https://supabase.com 에서 무료 프로젝트를 만듭니다.
2. 왼쪽 **SQL Editor** → `schema.sql` 내용을 붙여넣고 **Run**.
3. **Project Settings → API** 에서 `Project URL`과 `anon public` 키를 복사해 `../config.js`에 붙여넣습니다.
4. **Authentication → Providers → Email** 에서 필요하면 "Confirm email"을 켜거나 끕니다.
5. 홈페이지에서 가입한 뒤, **Table Editor → profiles** 에서 본인 행의 `is_admin`을 true로 바꿔 관리자로 만듭니다.
6. 조합원이 가입하면 `profiles`의 `approved`를 true로 바꿔 승인합니다. **승인된 회원만** 게시글을 보고 조합마당에 글을 쓸 수 있고, 공지사항은 관리자만 씁니다.
