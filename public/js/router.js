import { PERMISSIONS } from '/shared/domain.js';
import { can, isAuthenticated } from './state.js';

export const ROUTES = Object.freeze([
  {
    id: 'dashboard',
    path: '/',
    title: 'Panel',
    navLabel: 'Panel',
    icon: 'home',
    permission: PERMISSIONS.DASHBOARD_READ,
  },
  {
    id: 'tables',
    path: '/mesas',
    title: 'Mesas',
    navLabel: 'Mesas',
    icon: 'tables',
    permission: PERMISSIONS.TABLES_READ,
  },
  {
    id: 'reservations',
    path: '/reservas',
    title: 'Reservas',
    navLabel: 'Reservas',
    icon: 'calendar',
    permission: PERMISSIONS.RESERVATIONS_READ,
  },
  {
    id: 'orders',
    path: '/pedidos',
    title: 'Pedidos',
    navLabel: 'Pedidos',
    icon: 'orders',
    permission: PERMISSIONS.ORDERS_READ,
  },
  {
    id: 'kitchen',
    path: '/cocina',
    title: 'Cocina',
    navLabel: 'Cocina',
    icon: 'kitchen',
    permission: PERMISSIONS.KITCHEN_READ,
  },
  {
    id: 'dispatch',
    path: '/despachos',
    title: 'Despachos',
    navLabel: 'Despachos',
    icon: 'truck',
    permission: PERMISSIONS.DISPATCH_READ,
  },
  {
    id: 'users',
    path: '/usuarios',
    title: 'Usuarios',
    navLabel: 'Usuarios',
    icon: 'users',
    permission: PERMISSIONS.USERS_MANAGE,
    adminOnly: true,
  },
]);

export function normalizePath(pathname) {
  if (!pathname || pathname === '') return '/';
  const clean = pathname.replace(/\/+$/, '') || '/';
  return clean;
}

export function matchRoute(pathname) {
  const path = normalizePath(pathname);
  return ROUTES.find((route) => route.path === path) || null;
}

export function visibleRoutes() {
  if (!isAuthenticated()) return [];
  return ROUTES.filter((route) => can(route.permission));
}

export function defaultRoute() {
  return visibleRoutes()[0] || null;
}

export function navigate(path, { replace = false } = {}) {
  const next = normalizePath(path);
  if (normalizePath(window.location.pathname) === next) {
    window.dispatchEvent(new Event('popstate'));
    return;
  }
  if (replace) window.history.replaceState({}, '', next);
  else window.history.pushState({}, '', next);
  window.dispatchEvent(new Event('popstate'));
}

export function canAccess(route) {
  if (!route) return false;
  return can(route.permission);
}
