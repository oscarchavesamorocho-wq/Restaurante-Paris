import {
  ORDER_RULES,
  PASSWORD_POLICY,
  RESERVATION_RULES,
  ROLE_VALUES,
  SERVICE_HOURS,
  addDaysToIsoDate,
  timeToMinutes,
} from './domain.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

const MAX_TEXT = 300;
const MAX_ITEM_NOTES = 200;

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizeText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_RE.test(email);
}

export function isRealIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function passwordProblem(password) {
  if (typeof password !== 'string') return 'La contraseña es obligatoria.';
  if (password.length < PASSWORD_POLICY.minLength) {
    return `La contraseña debe tener al menos ${PASSWORD_POLICY.minLength} caracteres.`;
  }
  if (password.length > PASSWORD_POLICY.maxLength) {
    return `La contraseña no puede superar ${PASSWORD_POLICY.maxLength} caracteres.`;
  }
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) || !/\d/.test(password)) {
    return 'La contraseña debe incluir al menos una letra y un número.';
  }
  return null;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function validateLogin(input) {
  const source = asObject(input);
  const errors = {};
  const email = normalizeEmail(source.email);
  const password = typeof source.password === 'string' ? source.password : '';

  if (!isValidEmail(email)) errors.email = 'Ingresa un correo válido.';
  if (!password) errors.password = 'La contraseña es obligatoria.';
  else if (password.length > 200) errors.password = 'La contraseña no es válida.';

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: { email, password },
  };
}

export function validateReservation(input, context = {}) {
  const source = asObject(input);
  const errors = {};
  const table = context.table || null;
  const today = context.today;
  const nowTime = context.nowTime;

  const tableId = Number.isInteger(Number(source.tableId)) ? Number(source.tableId) : null;
  if (!tableId || tableId <= 0) errors.tableId = 'Selecciona una mesa válida.';
  else if (!table || table.active === 0) errors.tableId = 'La mesa seleccionada no existe.';

  const customerName = normalizeText(source.customerName);
  if (customerName.length < 2 || customerName.length > 80) {
    errors.customerName = 'El nombre debe tener entre 2 y 80 caracteres.';
  }

  const customerPhone = normalizeText(source.customerPhone);
  const digits = customerPhone.replace(/\D/g, '');
  if (!PHONE_RE.test(customerPhone) || digits.length < 7) {
    errors.customerPhone = 'Ingresa un teléfono válido (7 a 20 caracteres).';
  }

  const date = typeof source.date === 'string' ? source.date.trim() : '';
  if (!isRealIsoDate(date)) {
    errors.date = 'Selecciona una fecha válida.';
  } else if (typeof today === 'string' && isRealIsoDate(today)) {
    if (date < today) errors.date = 'La fecha no puede ser anterior a hoy.';
    else if (date > addDaysToIsoDate(today, RESERVATION_RULES.windowDays)) {
      errors.date = `Solo puedes reservar con ${RESERVATION_RULES.windowDays} días de anticipación.`;
    }
  }

  const time = typeof source.time === 'string' ? source.time.trim() : '';
  if (!isTime(time)) {
    errors.time = 'Selecciona una hora válida (HH:MM).';
  } else if (isRealIsoDate(date) && isRealIsoDate(today)) {
    const minutes = timeToMinutes(time);
    if (minutes < timeToMinutes(SERVICE_HOURS.start) || minutes > timeToMinutes(SERVICE_HOURS.lastReservation)) {
      errors.time = `El horario de reservas es de ${SERVICE_HOURS.start} a ${SERVICE_HOURS.lastReservation}.`;
    } else if (date === today && typeof nowTime === 'string' && isTime(nowTime)) {
      if (minutes < timeToMinutes(nowTime)) errors.time = 'La hora seleccionada ya pasó.';
    }
  }

  const people = Number(source.people);
  if (!Number.isInteger(people) || people < 1 || people > RESERVATION_RULES.maxGuestsPerReservation) {
    errors.people = `Las personas deben ser un número entero entre 1 y ${RESERVATION_RULES.maxGuestsPerReservation}.`;
  } else if (table && Number.isInteger(table.capacity) && people > table.capacity) {
    errors.people = `La ${table.name} admite máximo ${table.capacity} personas.`;
  }

  const notes = normalizeText(source.notes);
  if (notes.length > MAX_TEXT) errors.notes = `Las notas no pueden superar ${MAX_TEXT} caracteres.`;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: { tableId, customerName, customerPhone, date, time, people, notes },
  };
}

export function validateOrder(input, context = {}) {
  const source = asObject(input);
  const errors = {};
  const table = context.table || null;
  const dishesById = context.dishesById instanceof Map ? context.dishesById : new Map();

  const tableId = Number.isInteger(Number(source.tableId)) ? Number(source.tableId) : null;
  if (!tableId || tableId <= 0) errors.tableId = 'Selecciona una mesa válida.';
  else if (!table || table.active === 0) errors.tableId = 'La mesa seleccionada no existe.';

  const rawItems = Array.isArray(source.items) ? source.items : [];
  if (rawItems.length < 1) errors.items = 'Agrega al menos un plato.';
  else if (rawItems.length > ORDER_RULES.maxItems) {
    errors.items = `Un pedido admite máximo ${ORDER_RULES.maxItems} platos distintos.`;
  }

  const seen = new Set();
  const items = [];
  const itemErrors = Array.isArray(source.items) ? [] : null;

  rawItems.forEach((rawItem, index) => {
    const item = asObject(rawItem);
    const dishId = Number.isInteger(Number(item.dishId)) ? Number(item.dishId) : null;
    const quantity = Number(item.quantity);
    const notes = normalizeText(item.notes);
    const dish = dishId ? dishesById.get(dishId) : null;
    let message = null;

    if (!dishId || !dish || dish.active === 0) message = 'El plato no existe o no está disponible.';
    else if (seen.has(dishId)) message = 'No repitas el mismo plato; ajusta la cantidad.';
    else if (!Number.isInteger(quantity) || quantity < 1 || quantity > ORDER_RULES.maxQuantityPerItem) {
      message = `La cantidad debe ser un entero entre 1 y ${ORDER_RULES.maxQuantityPerItem}.`;
    } else if (notes.length > MAX_ITEM_NOTES) {
      message = `Las notas del plato no pueden superar ${MAX_ITEM_NOTES} caracteres.`;
    }

    if (message) {
      if (Array.isArray(itemErrors)) itemErrors[index] = message;
      errors.items = 'Revisa los platos del pedido.';
      return;
    }

    seen.add(dishId);
    items.push({ dishId, quantity, notes, dish });
  });

  const notes = normalizeText(source.notes);
  if (notes.length > MAX_TEXT) errors.notes = `Las notas no pueden superar ${MAX_TEXT} caracteres.`;

  const reservationId = source.reservationId == null || source.reservationId === ''
    ? null
    : String(source.reservationId).trim();
  if (reservationId && reservationId.length > 64) errors.reservationId = 'La reserva no es válida.';

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    itemErrors,
    data: { tableId, reservationId, notes, items },
  };
}

export function validateUserCreate(input) {
  const source = asObject(input);
  const errors = {};

  const name = normalizeText(source.name);
  if (name.length < 2 || name.length > 80) errors.name = 'El nombre debe tener entre 2 y 80 caracteres.';

  const email = normalizeEmail(source.email);
  if (!isValidEmail(email)) errors.email = 'Ingresa un correo válido.';

  const role = source.role;
  if (!ROLE_VALUES.includes(role)) errors.role = 'Selecciona un rol válido.';

  let password = null;
  if (source.password != null && source.password !== '') {
    const problem = passwordProblem(source.password);
    if (problem) errors.password = problem;
    else password = source.password;
  }

  return { valid: Object.keys(errors).length === 0, errors, data: { name, email, role, password } };
}

export function validateUserUpdate(input) {
  const source = asObject(input);
  const errors = {};
  const data = {};

  if (source.name !== undefined) {
    const name = normalizeText(source.name);
    if (name.length < 2 || name.length > 80) errors.name = 'El nombre debe tener entre 2 y 80 caracteres.';
    else data.name = name;
  }

  if (source.role !== undefined) {
    if (!ROLE_VALUES.includes(source.role)) errors.role = 'Selecciona un rol válido.';
    else data.role = source.role;
  }

  if (source.active !== undefined) {
    if (typeof source.active !== 'boolean') errors.active = 'El estado debe ser verdadero o falso.';
    else data.active = source.active ? 1 : 0;
  }

  if (Object.keys(data).length === 0 && Object.keys(errors).length === 0) {
    errors.general = 'No hay cambios para guardar.';
  }

  return { valid: Object.keys(errors).length === 0, errors, data };
}

export function validatePasswordReset(input) {
  const source = asObject(input);
  const errors = {};
  let password = null;

  if (source.password != null && source.password !== '') {
    const problem = passwordProblem(source.password);
    if (problem) errors.password = problem;
    else password = source.password;
  }

  return { valid: Object.keys(errors).length === 0, errors, data: { password } };
}

export function validateDemoReset(input) {
  const source = asObject(input);
  const confirmation = typeof source.confirmation === 'string' ? source.confirmation.trim() : '';
  const errors = {};
  if (confirmation !== 'RESTABLECER') {
    errors.confirmation = 'Escribe RESTABLECER para confirmar.';
  }
  return { valid: Object.keys(errors).length === 0, errors, data: { confirmation } };
}

export function validateTableStatus(input) {
  const source = asObject(input);
  const allowed = ['disponible', 'reservada', 'ocupada'];
  if (!allowed.includes(source.status)) {
    return { valid: false, errors: { status: 'Estado de mesa no válido.' }, data: {} };
  }
  return { valid: true, errors: {}, data: { status: source.status } };
}
