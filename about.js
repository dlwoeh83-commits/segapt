// 스크롤 등장 효과
const targets = document.querySelectorAll('.section-head, .letter, .table-wrap, .dir-card, .map, .partner');
targets.forEach((el) => el.classList.add('reveal'));
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
  }), { threshold: 0.1 });
  targets.forEach((el) => io.observe(el));
} else targets.forEach((el) => el.classList.add('visible'));

// 현재 위치 서브메뉴 강조
const links = [...document.querySelectorAll('.subnav a')];
const secs = links.map((a) => document.querySelector(a.getAttribute('href')));
const spy = () => {
  let cur = 0;
  secs.forEach((s, i) => { if (s.getBoundingClientRect().top < 140) cur = i; });
  links.forEach((a, i) => a.classList.toggle('on', i === cur));
};
spy();
window.addEventListener('scroll', spy, { passive: true });
