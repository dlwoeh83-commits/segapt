// 모바일 메뉴 열고 닫기
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
});

// 스크롤하면 부드럽게 나타나기
const targets = document.querySelectorAll('.section-head, .board, .sc, .proj-spec, .slider, .flow li, .loc-card, .map');
targets.forEach((el) => el.classList.add('reveal'));
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  targets.forEach((el) => io.observe(el));
} else targets.forEach((el) => el.classList.add('visible'));
