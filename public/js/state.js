/**
 * Estado de sesión en memoria. No se escribe en localStorage.
 */

const listeners = new Set();

const state = {
  bootstrapped: false,
  config: null,
  user: null,
  permissions: [],
  today: null,
  time: null,
  timezone: null,
  demoMode: false,
  restaurantName: 'Café Paris',
};

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}

export function setSession({
  user = null,
  permissions = [],
  today = null,
  time = null,
  timezone = null,
  demoMode = false,
  restaurantName = null,
} = {}) {
  state.user = user;
  state.permissions = Array.isArray(permissions) ? [...permissions] : [];
  if (today != null) state.today = today;
  if (time != null) state.time = time;
  if (timezone != null) state.timezone = timezone;
  if (demoMode != null) state.demoMode = Boolean(demoMode);
  if (restaurantName) state.restaurantName = restaurantName;
  emit();
}

export function clearSession() {
  state.user = null;
  state.permissions = [];
  emit();
}

export function setConfig(config) {
  state.config = config;
  if (config?.restaurantName) state.restaurantName = config.restaurantName;
  if (config?.today) state.today = config.today;
  if (config?.time) state.time = config.time;
  if (config?.timezone) state.timezone = config.timezone;
  if (config?.demoMode != null) state.demoMode = Boolean(config.demoMode);
  emit();
}

export function markBootstrapped() {
  state.bootstrapped = true;
  emit();
}

export function can(permission) {
  return state.permissions.includes(permission);
}

export function isAuthenticated() {
  return Boolean(state.user);
}
