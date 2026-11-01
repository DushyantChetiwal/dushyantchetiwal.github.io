(() => {
  'use strict';

  const copyButton = document.querySelector('.copy-email');
  const status = document.querySelector('.copy-status');
  if (copyButton && status) {
    copyButton.hidden = false;
    copyButton.addEventListener('click', async () => {
      const email = 'dushyantchetiwal24@gmail.com';
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(email);
        status.textContent = 'Email address copied.';
      } catch {
        status.textContent = `Copy manually: ${email}`;
      }
    });
  }

  // The 3D hero (assets/bean-hero.js) replaces the CSS reliability loop. It is fetched
  // only after the page has loaded, when the hero is near the viewport, and only if the
  // browser can run WebGL; otherwise the CSS loop simply stays.
  const loopArt = document.querySelector('.loop-art');
  const hasWebGL = () => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return Boolean(gl);
    } catch {
      return false;
    }
  };
  if (loopArt && hasWebGL()) {
    const loadHero = () => {
      const hero = document.createElement('script');
      hero.src = 'assets/bean-hero.js';
      document.head.append(hero);
    };
    const whenNear = () => {
      if (!('IntersectionObserver' in window)) { loadHero(); return; }
      const watcher = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { watcher.disconnect(); loadHero(); }
      }, { rootMargin: '400px 0px' });
      watcher.observe(loopArt);
    };
    if (document.readyState === 'complete') whenNear();
    else window.addEventListener('load', whenNear, { once: true });
  }

  // All content, navigation and case-study disclosures also work without JavaScript.
  if ('IntersectionObserver' in window) {
    const links = [...document.querySelectorAll('.desktop-nav a')];
    const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    const visible = new Set();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      const active = sections.find((section) => visible.has(section.id));
      for (const link of links) {
        if (active && link.getAttribute('href') === `#${active.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }, { rootMargin: '-15% 0px -55% 0px', threshold: 0 });
    sections.forEach((section) => observer.observe(section));
  }
})();
