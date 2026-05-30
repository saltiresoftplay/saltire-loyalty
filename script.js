(() => {
  // Mobile nav toggle
  const toggle = document.getElementById('navToggle');
  const inner  = document.getElementById('navInner');
  if (toggle && inner) {
    toggle.addEventListener('click', () => {
      inner.classList.toggle('open');
    });
  }

  // Scroll-reveal — staggered fade-in
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && items.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Small natural-feeling stagger within a section
          setTimeout(() => entry.target.classList.add('visible'), i * 60);
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    items.forEach(el => io.observe(el));
  } else {
    items.forEach(el => el.classList.add('visible'));
  }

  // Sticky-nav shrink on scroll
  const nav = document.querySelector('.nav');
  if (nav) {
    let last = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y > 60) nav.style.padding = '0';
      else nav.style.padding = '';
      last = y;
    }, { passive: true });
  }
})();
