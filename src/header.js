import { resolveAssetPath } from './utils.js';

export function renderHeader(currentPage = 'tree') {
  const app = document.querySelector('#app');
  if (!app) return;

  const header = document.createElement('header');
  header.className = 'site-header';

  const logoLink = document.createElement('a');
  logoLink.href = './index.html';
  logoLink.className = 'logo-link';
  logoLink.setAttribute('aria-label', 'Семейное древо — на главную');

  const logo = document.createElement('img');
  logo.alt = 'Логотип семейного древа';
  logo.src = resolveAssetPath('./assets/logo.png');
  logo.onerror = () => {
    logo.remove();
    const fallback = document.createElement('span');
    fallback.textContent = 'Семейное древо';
    fallback.className = 'logo-fallback';
    logoLink.appendChild(fallback);
  };

  logoLink.appendChild(logo);

  const nav = document.createElement('nav');
  nav.className = 'main-nav';

  const links = [
    { href: './index.html', label: 'Древо', key: 'tree' },
    { href: './people.html', label: 'Список', key: 'people' },
    { href: './misc.html', label: 'Всякое', key: 'misc' }
  ];

  links.forEach(({ href, label, key }) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (key === currentPage) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
    nav.appendChild(link);
  });

  header.append(logoLink, nav);
  app.appendChild(header);
}
