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
