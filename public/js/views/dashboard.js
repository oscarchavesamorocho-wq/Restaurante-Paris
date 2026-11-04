import {
  ITEM_STATUS_LABELS,
  PERMISSIONS,
  TABLE_STATUS_LABELS,
} from '/shared/domain.js';
import { CatalogApi } from '../api.js';
import { icon } from '../icons.js';
import { navigate } from '../router.js';
import { can, getState } from '../state.js';
import {
  badge,
  el,
  emptyState,
  formatDateEs,
  loadingState,
  notice,
  pageHeader,
  statusTone,
  toast,
} from '../ui.js';

function statCard({ label, value, foot, tone, iconName, href }) {
  const inner = [
    el('div', { className: 'stat-top' }, [
      el('span', { className: 'stat-label', text: label }),
      el('span', { className: `stat-icon tone-${tone}`, html: icon(iconName) }),
    ]),
    el('div', { className: 'stat-value', text: String(value) }),
    el('div', { className: 'stat-foot', text: foot }),
  ];
  if (href) {
    return el('a', {
      className: 'stat-card',
      href,
      onClick: (e) => {
        e.preventDefault();
        navigate(href);
      },
    }, inner);
  }
  return el('div', { className: 'stat-card' }, inner);
}

export async function renderDashboard(container) {
  container.replaceChildren(loadingState('Cargando panel…'));
  const state = getState();

  try {
    const data = await CatalogApi.dashboard();
    const counts = data.counts || {};

    const greeting = el('section', { className: 'greeting', 'aria-label': 'Resumen del día' }, [
      el('div', { className: 'greeting-copy' }, [
        el('p', { className: 'greeting-eyebrow', text: 'Hoy en sala' }),
        el('h2', {
          className: 'greeting-title',
          text: `Hola, ${state.user?.name?.split(' ')[0] || 'equipo'}`,
        }),
        el('p', {
          className: 'greeting-meta',
          text: `${formatDateEs(data.today || state.today)} · ${data.time || state.time || ''}`,
        }),
      ]),
      el('div', { className: 'greeting-actions' }, [
        can(PERMISSIONS.RESERVATIONS_WRITE)
          ? el('button', {
            type: 'button',
            className: 'btn btn-primary',
            text: 'Nueva reserva',
            onClick: () => navigate('/reservas'),
          })
          : null,
        can(PERMISSIONS.ORDERS_WRITE)
          ? el('button', {
            type: 'button',
            className: 'btn btn-secondary',
            text: 'Nuevo pedido',
            onClick: () => navigate('/pedidos'),
          })
          : null,
      ]),
    ]);

    const stats = el('div', { className: 'stat-grid', role: 'list' }, [
      statCard({
        label: 'Reservas de hoy',
        value: counts.reservationsToday ?? 0,
        foot: 'Activas en la fecha de servicio',
        tone: 'accent',
        iconName: 'calendar',
        href: can(PERMISSIONS.RESERVATIONS_READ) ? '/reservas' : null,
      }),
      statCard({
        label: 'Platos pendientes',
        value: counts.pendingDishes ?? 0,
        foot: 'En cola o en preparación',
        tone: 'warning',
        iconName: 'flame',
        href: can(PERMISSIONS.KITCHEN_READ) ? '/cocina' : null,
      }),
      statCard({
        label: 'Despachos activos',
        value: counts.activeDispatches ?? 0,
        foot: 'En ruta hacia mesa',
        tone: 'info',
        iconName: 'truck',
        href: can(PERMISSIONS.DISPATCH_READ) ? '/despachos' : null,
      }),
      statCard({
        label: 'Mesas ocupadas',
        value: counts.occupiedTables ?? 0,
        foot: `De ${counts.totalTables ?? 0} mesas`,
        tone: 'success',
        iconName: 'tables',
        href: can(PERMISSIONS.TABLES_READ) ? '/mesas' : null,
      }),
    ]);

    const reservations = (data.reservationsToday || []);
    const reservationsCard = el('section', { className: 'card' }, [
      el('div', { className: 'card-header' }, [
        el('div', {}, [
          el('h3', { className: 'card-title', text: 'Próximas reservas' }),
          el('p', { className: 'card-sub', text: 'Agenda activa de hoy' }),
        ]),
        can(PERMISSIONS.RESERVATIONS_READ)
          ? el('button', {
            type: 'button',
            className: 'btn btn-sm btn-ghost',
            text: 'Ver todas',
            onClick: () => navigate('/reservas'),
          })
          : null,
      ]),
      el('div', { className: 'card-body' }, [
        reservations.length
          ? el('div', { className: 'timeline' }, reservations.map((r) => el('div', { className: 'timeline-item' }, [
            el('div', { className: 'time-chip', text: r.time }),
            el('div', { className: 'timeline-main' }, [
              el('div', { className: 'timeline-title', text: r.customerName }),
              el('div', {
                className: 'timeline-sub',
                text: `${r.tableName} · ${r.people} personas`,
              }),
            ]),
            badge('Activa', 'info'),
          ])))
          : emptyState({
            title: 'Sin reservas activas',
            copy: 'No hay reservas programadas para hoy.',
            iconName: 'calendar',
          }),
      ]),
    ]);

    const kitchen = data.kitchen || [];
    const kitchenCard = el('section', { className: 'card' }, [
      el('div', { className: 'card-header' }, [
        el('div', {}, [
          el('h3', { className: 'card-title', text: 'Cocina ahora' }),
          el('p', { className: 'card-sub', text: 'Platos en cola o preparación' }),
        ]),
        can(PERMISSIONS.KITCHEN_READ)
          ? el('button', {
            type: 'button',
            className: 'btn btn-sm btn-ghost',
            text: 'Abrir cocina',
            onClick: () => navigate('/cocina'),
          })
          : null,
      ]),
      el('div', { className: 'card-body' }, [
        kitchen.length
          ? el('div', { className: 'kitchen-mini' }, kitchen.map((item) => el('div', { className: 'kitchen-mini-item' }, [
            badge(ITEM_STATUS_LABELS[item.status] || item.status, statusTone('item', item.status)),
            el('strong', { text: item.dishName }),
            el('span', {
              className: 'kitchen-mini-meta',
              text: `${item.tableName} · ×${item.quantity}`,
            }),
          ])))
          : emptyState({
            title: 'Cocina al día',
            copy: 'No hay platos pendientes en este momento.',
            iconName: 'kitchen',
          }),
      ]),
    ]);

    const tables = data.tables || [];
    const tablesCard = el('section', { className: 'card' }, [
      el('div', { className: 'card-header' }, [
        el('div', {}, [
          el('h3', { className: 'card-title', text: 'Mapa rápido de mesas' }),
          el('p', { className: 'card-sub', text: 'Estado derivado de reservas y pedidos activos' }),
        ]),
      ]),
      el('div', { className: 'card-body stack' }, [
        el('div', { className: 'legend', 'aria-label': 'Leyenda de mesas' }, [
          el('span', { className: 'legend-item' }, [
            el('span', { className: 'dot dot-disponible', 'aria-hidden': 'true' }),
            el('span', { text: TABLE_STATUS_LABELS.disponible }),
          ]),
          el('span', { className: 'legend-item' }, [
            el('span', { className: 'dot dot-reservada', 'aria-hidden': 'true' }),
            el('span', { text: TABLE_STATUS_LABELS.reservada }),
          ]),
          el('span', { className: 'legend-item' }, [
            el('span', { className: 'dot dot-ocupada', 'aria-hidden': 'true' }),
            el('span', { text: TABLE_STATUS_LABELS.ocupada }),
          ]),
        ]),
        tables.length
          ? el('div', { className: 'table-mini-grid' }, tables.map((t) => el('div', {
            className: `table-mini is-${t.status}`,
          }, [
            el('div', { className: 'table-mini-name', text: t.name }),
            el('div', {
              className: 'table-mini-meta',
              text: `${TABLE_STATUS_LABELS[t.status] || t.status} · ${t.capacity} pax`,
            }),
          ])))
          : emptyState({ title: 'Sin mesas', copy: 'El catálogo de mesas está vacío.', iconName: 'tables' }),
      ]),
    ]);

    const dispatches = data.activeDispatches || [];
    const dispatchCard = el('section', { className: 'card' }, [
      el('div', { className: 'card-header' }, [
        el('div', {}, [
          el('h3', { className: 'card-title', text: 'Despachos en ruta' }),
          el('p', { className: 'card-sub', text: 'Entregas activas hacia mesa' }),
        ]),
      ]),
      el('div', { className: 'card-body' }, [
        dispatches.length
          ? el('div', { className: 'record-list' }, dispatches.map((d) => el('div', { className: 'record' }, [
            el('div', { className: 'record-lead', html: icon('truck') }),
            el('div', { className: 'record-main' }, [
              el('div', { className: 'record-title', text: d.tableName }),
              el('div', {
                className: 'record-sub',
                text: `${d.itemCount} plato(s) · ${d.createdBy || 'Equipo'}`,
              }),
            ]),
            badge('En ruta', 'info'),
          ])))
          : emptyState({
            title: 'Sin despachos activos',
            copy: 'Cuando haya platos listos, aparecerán aquí al salir en ruta.',
            iconName: 'truck',
          }),
      ]),
    ]);

    container.replaceChildren(
      pageHeader({
        eyebrow: 'Operación',
        title: 'Panel del día',
        subtitle: 'Reservas, cocina, despachos y ocupación en un vistazo.',
      }),
      greeting,
      el('div', { className: 'section' }, [stats]),
      state.demoMode
        ? el('div', { className: 'section' }, [
          notice('warning', 'Datos de demostración', 'El panel lee el servidor de demo. No uses estas cuentas en producción.'),
        ])
        : null,
      el('div', { className: 'section grid-sidebar' }, [
        el('div', { className: 'stack' }, [reservationsCard, tablesCard]),
        el('div', { className: 'stack' }, [kitchenCard, dispatchCard]),
      ]),
    );
  } catch (err) {
    container.replaceChildren(
      pageHeader({ title: 'Panel del día', subtitle: 'No se pudo cargar el resumen.' }),
      notice('danger', 'Error al cargar', err.message || 'Inténtalo de nuevo.'),
      el('button', {
        type: 'button',
        className: 'btn btn-primary',
        text: 'Reintentar',
        onClick: () => renderDashboard(container),
      }),
    );
    toast(err.message || 'Error al cargar el panel', 'error');
  }
}
