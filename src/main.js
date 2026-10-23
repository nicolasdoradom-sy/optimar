import './styles/main.css';
import { routeFromHash, routes } from './navigation/router.js';

const view = document.querySelector('#module-view');
const desktopLinks = [...document.querySelectorAll('[data-route]')];
const mobileNavigation = document.querySelector('#mobile-nav');
const logo = document.querySelector('#brand-logo');
const logoPlaceholder = document.querySelector('#logo-placeholder');

logo.src = `${import.meta.env.BASE_URL}assets/logo.png`;
logo.addEventListener('load', () => {
  logoPlaceholder.hidden = true;
});

let renderVersion = 0;

async function renderRoute() {
  const currentVersion = ++renderVersion;
  const route = routeFromHash(window.location.hash);
  if (route.id === 'extractor') {
    const { mountExtractor } = await import('./modules/extractor/extractorView.js');
    if (currentVersion !== renderVersion) return;
    mountExtractor(view);
  } else if (route.id === 'enlaces') {
    const { mountEnlaces } = await import('./modules/enlaces/enlacesView.js');
    if (currentVersion !== renderVersion) return;
    mountEnlaces(view);
  } else {
    const heading = document.createElement('p');
    const title = document.createElement('h1');
    const message = document.createElement('p');

    heading.className = 'section-eyebrow';
    heading.textContent = 'MÓDULO';
    title.textContent = route.title;
    message.className = 'module-message';
    message.textContent = 'Este módulo se está construyendo';
    view.replaceChildren(heading, title, message);
  }

  for (const link of desktopLinks) {
    if (link.dataset.route === route.id) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
  mobileNavigation.value = route.id;
}

if (!window.location.hash || !routes.some((route) => `#${route.id}` === window.location.hash)) {
  window.history.replaceState(null, '', '#extractor');
}

mobileNavigation.addEventListener('change', () => {
  window.location.hash = mobileNavigation.value;
});
window.addEventListener('hashchange', renderRoute);
void renderRoute();