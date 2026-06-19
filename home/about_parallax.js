(function initAboutParallax() {
  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const target = document.getElementById('aboutParallaxTarget');
  const imgWrap = document.getElementById('aboutParallaxImageWrap');
  const waves = {
    w1: document.querySelector('.about-wave-1'),
    w2: document.querySelector('.about-wave-2'),
    w3: document.querySelector('.about-wave-3'),
  };
  const aboutSection = document.getElementById('about');
  if (!target || !imgWrap || !aboutSection || (!waves.w1 && !waves.w2 && !waves.w3)) return;

  let ticking = false;

  function update() {
    ticking = false;
    const rect = aboutSection.getBoundingClientRect();
    const vh = window.innerHeight;

    // 0 => top just entering, 1 => about section near middle
    const progress = Math.max(0, Math.min(1, (vh - rect.top) / (vh + rect.height * 0.3)));

    // Parallax translate
    const y = (progress - 0.5) * 28; // px
    const x = (progress - 0.5) * 10; // px

    target.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    imgWrap.style.transform = `translate3d(${-x * 0.6}px, ${y * 0.6}px, 0) rotateX(${(progress - 0.5) * 4}deg)`;

    if (waves.w1) waves.w1.style.transform = `translateX(${progress * 14}px) translateY(${progress * 6}px)`;
    if (waves.w2) waves.w2.style.transform = `translateX(${-progress * 10}px) translateY(${progress * 4}px)`;
    if (waves.w3) waves.w3.style.transform = `translateY(${progress * 3}px)`;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );

  window.addEventListener('resize', () => {
    update();
  });

  update();
})();

