import {
  ROLE_LABELS,
  RESTAURANT_NAME,
} from '/shared/domain.js';
import { AuthApi } from './api.js';
import { icon } from './icons.js';
import {
  canAccess,
  defaultRoute,
  matchRoute,
  navigate,
  normalizePath,
  visibleRoutes,
} from './router.js';
import { clearSession, getState, isAuthenticated } from './state.js';
import { el, initials, toast } from './ui.js';

let sidebarOpen = false;

function closeSidebar() {
  sidebarOpen = false;
  document.querySelector('.sidebar')?.classList.remove('is-open');
  document.querySelector('.sidebar-scrim')?.classList.remove('is-open');
  document.querySelector('.menu-button')?.setAttribute('aria-expanded', 'false');
}

function openSidebar() {
  sidebarOpen = true;
  document.querySelector('.sidebar')?.classList.add('is-open');
  document.querySelector('.sidebar-scrim')?.classList.add('is-open');
  document.querySelector('.menu-button')?.setAttribute('aria-expanded', 'true');
}

function toggleSidebar() {
  if (sidebarOpen) closeSidebar();
  else openSidebar();
}

async function logout() {
  try {
    await AuthApi.logout();
  } catch {
    // la cookie puede ya estar inválida
  }
  clearSession();
  navigate('/acceso', { replace: true });
  toast('Sesión cerrada', 'info');
}

export function renderShell(root, { route, content }) {
  const state = getState();
  const user = state.user;
  const routes = visibleRoutes();
  const activePath = route?.path || '/';

  const navLinks = routes.map((item) => el('a', {
    className: `nav-link${item.path === activePath ? ' is-active' : ''}`,
    href: item.path,
    'aria-current': item.path === activePath ? 'page' : null,
    onClick: (e) => {
      e.preventDefault();
      closeSidebar();
      navigate(item.path);
    },
  }, [
    el('span', { html: icon(item.icon) }),
    el('span', { text: item.navLabel }),
  ]));

  const shell = el('div', { className: 'app-shell' }, [
    el('button', {
      type: 'button',
      className: `sidebar-scrim${sidebarOpen ? ' is-open' : ''}`,
      'aria-label': 'Cerrar menú',
      onClick: closeSidebar,
    }),
    el('aside', {
      className: `sidebar${sidebarOpen ? ' is-open' : ''}`,
      'aria-label': 'Navegación principal',
    }, [
      el('a', {
        className: 'brand',
        href: '/',
        onClick: (e) => {
          e.preventDefault();
          closeSidebar();
          const home = defaultRoute();
          if (home) navigate(home.path);
        },
      }, [
        el('div', { className: 'brand-mark', text: 'CP', 'aria-hidden': 'true' }),
        el('div', { className: 'brand-copy' }, [
          el('div', { className: 'brand-name', text: state.restaurantName || RESTAURANT_NAME }),
          el('div', { className: 'brand-sub', text: 'Operaciones' }),
        ]),
      ]),
      el('nav', { className: 'sidebar-nav', 'aria-label': 'Secciones' }, [
        el('div', { className: 'nav-section-label', text: 'Servicio' }),
        ...navLinks,
      ]),
      el('div', { className: 'sidebar-footer' }, [
        el('div', { className: 'sidebar-user' }, [
          el('div', { className: 'avatar avatar-dark', text: initials(user?.name) }),
          el('div', { className: 'sidebar-user-copy' }, [
            el('div', { className: 'sidebar-user-name', text: user?.name || '' }),
            el('div', { className: 'sidebar-user-role', text: ROLE_LABELS[user?.role] || user?.role || '' }),
          ]),
        ]),
        state.demoMode
          ? el('div', { className: 'sidebar-note' }, [
            el('span', { html: icon('shield', 'icon icon-sm') }),
            el('span', { text: 'Modo demostración: datos de prueba en servidor, no producción.' }),
          ])
          : null,
        el('button', {
          type: 'button',
          className: 'btn btn-ghost',
          style: { color: 'var(--color-cream)', justifyContent: 'flex-start' },
          onClick: logout,
        }, [
          el('span', { html: icon('logout', 'icon icon-sm') }),
          el('span', { text: 'Cerrar sesión' }),
        ]),
      ]),
    ]),
    el('div', { className: 'app-main' }, [
      el('header', { className: 'topbar' }, [
        el('div', { className: 'topbar-left' }, [
          el('button', {
            type: 'button',
            className: 'btn btn-icon btn-quiet menu-button',
            'aria-label': 'Abrir menú',
            'aria-expanded': sidebarOpen ? 'true' : 'false',
            'aria-controls': null,
            onClick: toggleSidebar,
            html: icon('menu'),
          }),
          el('div', { className: 'topbar-context' }, [
            el('div', { className: 'topbar-eyebrow', text: state.restaurantName || RESTAURANT_NAME }),
            el('div', { className: 'topbar-title', text: route?.title || 'Café Paris' }),
          ]),
        ]),
        el('div', { className: 'topbar-right' }, [
          state.today
            ? el('div', { className: 'topbar-date' }, [
              el('span', { html: icon('clock', 'icon icon-sm') }),
              el('span', {
                text: `${state.today}${state.time ? ` · ${state.time}` : ''}${state.timezone ? ` (${state.timezone})` : ''}`,
              }),
            ])
            : null,
        ]),
      ]),
      el('main', { id: 'main', className: 'page', tabindex: '-1' }, [content]),
    ]),
  ]);

  root.replaceChildren(shell);
}

export function guardRoute() {
  if (!isAuthenticated()) {
    navigate('/acceso', { replace: true });
    return null;
  }
  const path = normalizePath(window.location.pathname);
  if (path === '/acceso') {
    const home = defaultRoute();
    navigate(home?.path || '/', { replace: true });
    return null;
  }
  let route = matchRoute(path);
  if (!route) {
    const home = defaultRoute();
    navigate(home?.path || '/', { replace: true });
    return null;
  }
  if (!canAccess(route)) {
    const home = defaultRoute();
    toast('No tienes permiso para esa sección.', 'error');
    navigate(home?.path || '/', { replace: true });
    return null;
  }
  return route;
}
