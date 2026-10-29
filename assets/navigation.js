(() => {
  const nav = document.querySelector('.navigation');
  if (!nav) return;
  const toggle = nav.querySelector('.menu-toggle');
  const links = nav.querySelector('.navigation-links');
  const triggers = [...nav.querySelectorAll('.menu-trigger')];
  function close(except) {
    triggers.forEach(button => {
      if (button === except) return;
      button.setAttribute('aria-expanded', 'false');
      document.getElementById(button.getAttribute('aria-controls')).hidden = true;
    });
  }
  triggers.forEach(button => {
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      close();
      button.setAttribute('aria-expanded', String(open));
      document.getElementById(button.getAttribute('aria-controls')).hidden = !open;
    });
    button.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        close(button);
        button.setAttribute('aria-expanded', 'true');
        const panel = document.getElementById(button.getAttribute('aria-controls'));
        panel.hidden = false;
        panel.querySelector('a').focus();
      }
    });
  });
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    if (!open) close();
  });
  document.addEventListener('click', event => { if (!nav.contains(event.target)) close(); });
  nav.addEventListener('focusout', event => { if (!nav.contains(event.relatedTarget)) close(); });
  nav.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = triggers.find(button => button.getAttribute('aria-expanded') === 'true');
    if (open) { close(); open.focus(); }
    else if (links.classList.contains('is-open')) { toggle.click(); toggle.focus(); }
  });
  const page = location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
  nav.querySelectorAll('a').forEach(link => {
    if (link.getAttribute('href').replace(/\.html$/, '') === page) link.setAttribute('aria-current', 'page');
  });
  const theme = nav.querySelector('.navigation-theme');
  function syncTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    theme.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    theme.setAttribute('aria-pressed', String(dark));
  }
  try { const saved = localStorage.getItem('splash-theme'); if (saved) document.documentElement.dataset.theme = saved; } catch {}
  theme.addEventListener('click', () => {
    const value = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = value;
    try { localStorage.setItem('splash-theme', value); } catch {}
    syncTheme();
  });
  syncTheme();
})();
