import { icon } from './icons.js';

/** Crea un elemento; textContent seguro (nunca innerHTML con datos de usuario). */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'className') node.className = value;
    else if (key === 'dataset') {
      for (const [dk, dv] of Object.entries(value)) node.dataset[dk] = String(dv);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      node.innerHTML = value; // solo markup estático/controlado (iconos SVG)
    } else if (key === 'text') {
      node.textContent = value;
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }
  const list = Array.isArray(children) ? children.flat(Infinity) : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      node.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      node.appendChild(child);
    }
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function mount(target, content) {
  clear(target);
  if (Array.isArray(content)) content.forEach((c) => c && target.appendChild(c));
  else if (content) target.appendChild(content);
}

export function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';
}

export function badge(label, tone = 'neutral') {
  return el('span', { className: `badge tone-${tone}`, text: label });
}

export function emptyState({ title, copy, iconName = 'box', action = null }) {
  const wrap = el('div', { className: 'empty-state', role: 'status' }, [
    el('div', { className: 'empty-icon', html: icon(iconName, 'icon icon-lg') }),
    el('p', { className: 'empty-title', text: title }),
    el('p', { className: 'empty-copy', text: copy }),
  ]);
  if (action) wrap.appendChild(action);
  return wrap;
}

export function loadingState(label = 'Cargando…') {
  return el('div', { className: 'loading-state', role: 'status', 'aria-live': 'polite' }, [
    el('div', { className: 'spinner', 'aria-hidden': 'true' }),
    el('p', { text: label }),
  ]);
}

export function pageSkeleton() {
  return el('div', { className: 'page-loading', 'aria-busy': 'true', 'aria-live': 'polite' }, [
    el('div', { className: 'skeleton skeleton-title' }),
    el('div', { className: 'skeleton-grid' }, [
      el('div', { className: 'skeleton' }),
      el('div', { className: 'skeleton' }),
      el('div', { className: 'skeleton' }),
      el('div', { className: 'skeleton' }),
    ]),
    el('div', { className: 'skeleton skeleton-row' }),
    el('div', { className: 'skeleton skeleton-row' }),
  ]);
}

export function notice(type, title, copy) {
  const icons = { info: 'info', warning: 'alert', danger: 'alert', success: 'check' };
  return el('div', { className: `notice notice--${type}`, role: type === 'danger' ? 'alert' : 'status' }, [
    el('span', { html: icon(icons[type] || 'info') }),
    el('div', {}, [
      title ? el('div', { className: 'notice-title', text: title }) : null,
      copy ? el('div', { text: copy }) : null,
    ]),
  ]);
}

export function toast(message, type = 'info', timeout = 4200) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const node = el('div', { className: `toast toast--${type}`, role: 'status' }, [
    el('span', { html: icon(type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info') }),
    el('div', { text: message }),
  ]);
  region.appendChild(node);
  window.setTimeout(() => {
    node.remove();
  }, timeout);
}

export function field({
  id,
  label,
  type = 'text',
  name,
  value = '',
  required = false,
  hint = '',
  error = '',
  options = null,
  placeholder = '',
  autocomplete,
  min,
  max,
  step,
  rows,
  disabled = false,
}) {
  const controlId = id || name;
  const errorId = `${controlId}-error`;
  const hintId = `${controlId}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || null;

  let control;
  if (type === 'select') {
    control = el('select', {
      className: 'field-control',
      id: controlId,
      name,
      required,
      disabled,
      'aria-invalid': error ? 'true' : 'false',
      'aria-describedby': describedBy,
    }, (options || []).map((opt) => el('option', {
      value: opt.value,
      selected: String(opt.value) === String(value),
      text: opt.label,
    })));
  } else if (type === 'textarea') {
    control = el('textarea', {
      className: 'field-control',
      id: controlId,
      name,
      required,
      disabled,
      rows: rows || 3,
      placeholder,
      'aria-invalid': error ? 'true' : 'false',
      'aria-describedby': describedBy,
    });
    control.value = value ?? '';
  } else {
    control = el('input', {
      className: 'field-control',
      id: controlId,
      name,
      type,
      value,
      required,
      disabled,
      placeholder,
      autocomplete,
      min,
      max,
      step,
      'aria-invalid': error ? 'true' : 'false',
      'aria-describedby': describedBy,
    });
  }

  const wrap = el('div', { className: `field${error ? ' has-error' : ''}` }, [
    el('label', { className: 'field-label', for: controlId }, [
      label,
      required ? el('span', { className: 'req', text: ' *', 'aria-hidden': 'true' }) : null,
    ]),
    control,
    hint ? el('p', { className: 'field-hint', id: hintId, text: hint }) : null,
    error ? el('p', { className: 'field-error', id: errorId, role: 'alert', text: error }) : null,
  ]);

  return wrap;
}

export function setFieldErrors(form, fields) {
  form.querySelectorAll('.field').forEach((wrap) => {
    wrap.classList.remove('has-error');
    const err = wrap.querySelector('.field-error');
    if (err) err.remove();
    const control = wrap.querySelector('.field-control');
    if (control) {
      control.removeAttribute('aria-invalid');
      const described = (control.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && !id.endsWith('-error'));
      if (described.length) control.setAttribute('aria-describedby', described.join(' '));
      else control.removeAttribute('aria-describedby');
    }
  });

  if (!fields) return;
  for (const [name, message] of Object.entries(fields)) {
    const control = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!control) continue;
    const wrap = control.closest('.field');
    if (!wrap) continue;
    wrap.classList.add('has-error');
    control.setAttribute('aria-invalid', 'true');
    const errorId = `${control.id || name}-error`;
    const existing = wrap.querySelector(`#${CSS.escape(errorId)}`);
    if (existing) existing.textContent = message;
    else wrap.appendChild(el('p', { className: 'field-error', id: errorId, role: 'alert', text: message }));
    const parts = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    parts.add(errorId);
    control.setAttribute('aria-describedby', [...parts].join(' '));
  }
}

export function readForm(form) {
  const data = {};
  const fd = new FormData(form);
  for (const [key, value] of fd.entries()) data[key] = typeof value === 'string' ? value.trim() : value;
  return data;
}

export function openModal({
  title,
  subtitle = '',
  body,
  footer,
  wide = false,
  onClose,
}) {
  const dialog = el('dialog', {
    className: `modal${wide ? ' modal-wide' : ''}`,
    'aria-labelledby': 'modal-title',
  });

  const close = () => {
    dialog.close();
    dialog.remove();
    if (onClose) onClose();
  };

  const card = el('div', { className: 'modal-card' }, [
    el('div', { className: 'modal-header' }, [
      el('div', {}, [
        el('h2', { className: 'modal-title', id: 'modal-title', text: title }),
        subtitle ? el('p', { className: 'modal-sub', text: subtitle }) : null,
      ]),
      el('button', {
        type: 'button',
        className: 'modal-close',
        'aria-label': 'Cerrar',
        html: icon('close', 'icon icon-sm'),
        onClick: close,
      }),
    ]),
    el('div', { className: 'modal-body' }, [body]),
    footer ? el('div', { className: 'modal-footer' }, Array.isArray(footer) ? footer : [footer]) : null,
  ]);

  dialog.appendChild(card);
  document.body.appendChild(dialog);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  dialog.showModal();
  return { dialog, close };
}

export function confirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  danger = false,
}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      close();
      resolve(value);
    };

    const cancelBtn = el('button', {
      type: 'button',
      className: 'btn btn-ghost',
      text: 'Cancelar',
      onClick: () => finish(false),
    });
    const okBtn = el('button', {
      type: 'button',
      className: danger ? 'btn btn-danger' : 'btn btn-primary',
      text: confirmLabel,
      onClick: () => finish(true),
    });

    const { close } = openModal({
      title,
      body: el('p', { text: message }),
      footer: [cancelBtn, okBtn],
      onClose: () => finish(false),
    });
  });
}

export function pageHeader({ eyebrow, title, subtitle, actions = [] }) {
  return el('header', { className: 'page-header' }, [
    el('div', { className: 'page-heading' }, [
      eyebrow ? el('p', { className: 'page-eyebrow', text: eyebrow }) : null,
      el('h1', { className: 'page-title', text: title }),
      subtitle ? el('p', { className: 'page-subtitle', text: subtitle }) : null,
    ]),
    actions.length ? el('div', { className: 'page-actions' }, actions) : null,
  ]);
}

export function formatDateEs(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatShortDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function statusTone(kind, status) {
  const map = {
    table: { disponible: 'success', reservada: 'warning', ocupada: 'danger' },
    reservation: { activa: 'info', cancelada: 'neutral', completada: 'success' },
    order: {
      abierto: 'info',
      en_cocina: 'warning',
      listo: 'success',
      cerrado: 'neutral',
      cancelado: 'danger',
    },
    item: {
      en_cola: 'info',
      preparando: 'warning',
      listo: 'success',
      en_ruta: 'info',
      entregado: 'success',
      cancelado: 'danger',
    },
    dispatch: { en_ruta: 'info', entregado: 'success' },
  };
  return map[kind]?.[status] || 'neutral';
}
