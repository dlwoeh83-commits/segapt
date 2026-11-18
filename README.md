# 세교1구역주택재개발정비사업조합 홈페이지

정적 사이트(HTML/CSS/JS) + Supabase(회원·게시판·자료·첨부파일).

- 설정: `config.js`에 Supabase 프로젝트 주소와 publishable 키 (공개용 키)
- DB 설정: `supabase/schema.sql`, `supabase/README.md`
- 승인된 회원만 게시판·공개자료·사업개요 이미지를 볼 수 있습니다 (Supabase 규칙으로 보장).
- 배포: Vercel (정적 사이트, 빌드 없음)
