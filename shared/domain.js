export const RESTAURANT_NAME = 'Café Paris';

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  MESERO: 'mesero',
  COCINA: 'cocina',
  DESPACHO: 'despacho',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.MESERO]: 'Mesero',
  [ROLES.COCINA]: 'Cocina',
  [ROLES.DESPACHO]: 'Despacho',
});

export const PERMISSIONS = Object.freeze({
  DASHBOARD_READ: 'dashboard:read',
  TABLES_READ: 'tables:read',
  RESERVATIONS_READ: 'reservations:read',
  RESERVATIONS_WRITE: 'reservations:write',
  ORDERS_READ: 'orders:read',
  ORDERS_WRITE: 'orders:write',
  KITCHEN_READ: 'kitchen:read',
  KITCHEN_WRITE: 'kitchen:write',
  DISPATCH_READ: 'dispatch:read',
  DISPATCH_WRITE: 'dispatch:write',
  USERS_MANAGE: 'users:manage',
  DEMO_RESET: 'demo:reset',
});

const P = PERMISSIONS;

export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: Object.freeze(Object.values(P)),
  [ROLES.MESERO]: Object.freeze([
    P.DASHBOARD_READ,
    P.TABLES_READ,
    P.RESERVATIONS_READ,
    P.RESERVATIONS_WRITE,
    P.ORDERS_READ,
    P.ORDERS_WRITE,
    P.KITCHEN_READ,
    P.DISPATCH_READ,
    P.DISPATCH_WRITE,
  ]),
  [ROLES.COCINA]: Object.freeze([
    P.DASHBOARD_READ,
    P.TABLES_READ,
    P.ORDERS_READ,
    P.KITCHEN_READ,
    P.KITCHEN_WRITE,
  ]),
  [ROLES.DESPACHO]: Object.freeze([
    P.DASHBOARD_READ,
    P.TABLES_READ,
    P.ORDERS_READ,
    P.DISPATCH_READ,
    P.DISPATCH_WRITE,
  ]),
});

export function isRole(value) {
  return ROLE_VALUES.includes(value);
}

export function hasPermission(role, permission) {
  return Boolean(ROLE_PERMISSIONS[role]?.includes(permission));
}

export const TABLE_STATUS = Object.freeze({
  AVAILABLE: 'disponible',
  RESERVED: 'reservada',
  OCCUPIED: 'ocupada',
});

export const TABLE_STATUS_LABELS = Object.freeze({
  disponible: 'Disponible',
  reservada: 'Reservada',
  ocupada: 'Ocupada',
});

export const RESERVATION_STATUS = Object.freeze({
  ACTIVE: 'activa',
  CANCELLED: 'cancelada',
  COMPLETED: 'completada',
});

export const RESERVATION_STATUS_LABELS = Object.freeze({
  activa: 'Activa',
  cancelada: 'Cancelada',
  completada: 'Completada',
});

export const ORDER_STATUS = Object.freeze({
  OPEN: 'abierto',
  IN_KITCHEN: 'en_cocina',
  READY: 'listo',
  CLOSED: 'cerrado',
  CANCELLED: 'cancelado',
});

export const ORDER_STATUS_LABELS = Object.freeze({
  abierto: 'Abierto',
  en_cocina: 'En cocina',
  listo: 'Listo',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
});

export const ITEM_STATUS = Object.freeze({
  QUEUED: 'en_cola',
  PREPARING: 'preparando',
  READY: 'listo',
  ON_ROUTE: 'en_ruta',
  DELIVERED: 'entregado',
  CANCELLED: 'cancelado',
});

export const ITEM_STATUS_LABELS = Object.freeze({
  en_cola: 'En cola',
  preparando: 'Preparando',
  listo: 'Listo',
  en_ruta: 'En ruta',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
});

export const DISPATCH_STATUS = Object.freeze({
  ON_ROUTE: 'en_ruta',
  DELIVERED: 'entregado',
});

export const DISPATCH_STATUS_LABELS = Object.freeze({
  en_ruta: 'En ruta',
  entregado: 'Entregado',
});

export const ITEM_TRANSITIONS = Object.freeze({
  [ITEM_STATUS.QUEUED]: Object.freeze([ITEM_STATUS.PREPARING, ITEM_STATUS.CANCELLED]),
  [ITEM_STATUS.PREPARING]: Object.freeze([ITEM_STATUS.READY]),
  [ITEM_STATUS.READY]: Object.freeze([ITEM_STATUS.ON_ROUTE]),
  [ITEM_STATUS.ON_ROUTE]: Object.freeze([ITEM_STATUS.DELIVERED]),
  [ITEM_STATUS.DELIVERED]: Object.freeze([]),
  [ITEM_STATUS.CANCELLED]: Object.freeze([]),
});

export function canTransitionItem(from, to) {
  return Boolean(ITEM_TRANSITIONS[from]?.includes(to));
}

export const SERVICE_HOURS = Object.freeze({
  start: '11:00',
  end: '22:00',
  lastReservation: '21:30',
});

export const RESERVATION_RULES = Object.freeze({
  maxGuestsPerReservation: 12,
  windowDays: 60,
  slotMinutes: 120,
});

export const ORDER_RULES = Object.freeze({
  maxItems: 30,
  maxQuantityPerItem: 20,
});

export const PASSWORD_POLICY = Object.freeze({
  minLength: 12,
  maxLength: 128,
});

export const CURRENCY = 'COP';

export function formatMoney(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function addDaysToIsoDate(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
