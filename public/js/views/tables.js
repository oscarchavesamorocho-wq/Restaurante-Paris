import {
  PERMISSIONS,
  TABLE_STATUS_LABELS,
} from '/shared/domain.js';
import { CatalogApi } from '../api.js';
import { icon } from '../icons.js';
import { navigate } from '../router.js';
import { can } from '../state.js';
import {
  badge,
  el,
  emptyState,
  loadingState,
  notice,
  pageHeader,
  statusTone,
  toast,
} from '../ui.js';

function tableDetail(table) {
  if (table.status === 'ocupada' && table.activeOrder) {
    return el('div', { className: 'table-detail' }, [
      el('strong', { text: 'Pedido activo' }),
      el('span', { text: `Estado: ${table.activeOrder.status}` }),
    ]);
  }
  if (table.status === 'reservada' && table.reservation) {
    return el('div', { className: 'table-detail' }, [
      el('strong', { text: table.reservation.customerName }),
      el('span', {
        text: `${table.reservation.time} · ${table.reservation.people} personas`,
      }),
    ]);
  }
  return el('div', { className: 'table-detail' }, [
    el('strong', { text: 'Libre para asignar' }),
    el('span', { text: 'Sin reserva ni pedido activo' }),
  ]);
}

export async function renderTables(container) {
  container.replaceChildren(loadingState('Cargando mesas…'));

  try {
    const tables = await CatalogApi.tables();

    const legend = el('div', { className: 'legend', 'aria-label': 'Leyenda de estados' }, [
      el('span', { className: 'legend-item' }, [
        el('span', { className: 'dot dot-disponible', 'aria-hidden': 'true' }),
        el('span', { text: 'Disponible' }),
      ]),
      el('span', { className: 'legend-item' }, [
        el('span', { className: 'dot dot-reservada', 'aria-hidden': 'true' }),
        el('span', { text: 'Reservada' }),
      ]),
      el('span', { className: 'legend-item' }, [
        el('span', { className: 'dot dot-ocupada', 'aria-hidden': 'true' }),
        el('span', { text: 'Ocupada' }),
      ]),
    ]);

    const grid = tables.length
      ? el('div', {
        className: 'table-grid',
        role: 'list',
        'aria-label': 'Mesas del salón',
      }, tables.map((table) => {
        const actions = [];
        if (can(PERMISSIONS.RESERVATIONS_WRITE) && table.status !== 'ocupada') {
          actions.push(el('button', {
            type: 'button',
            className: 'btn btn-sm btn-quiet',
            text: 'Reservar',
            onClick: () => navigate(`/reservas?mesa=${table.id}`),
          }));
        }
        if (can(PERMISSIONS.ORDERS_WRITE) && table.status !== 'reservada') {
          actions.push(el('button', {
            type: 'button',
            className: 'btn btn-sm btn-primary',
            text: 'Pedido',
            onClick: () => navigate(`/pedidos?mesa=${table.id}`),
          }));
        }

        return el('article', {
          className: `table-card is-${table.status}`,
          role: 'listitem',
          'aria-label': `${table.name}, ${TABLE_STATUS_LABELS[table.status]}`,
        }, [
          el('div', { className: 'table-card-top' }, [
            el('div', {}, [
              el('div', { className: 'table-number', text: table.name }),
              el('div', { className: 'table-zone', text: table.zone || 'Salón' }),
            ]),
            badge(TABLE_STATUS_LABELS[table.status] || table.status, statusTone('table', table.status)),
          ]),
          el('div', { className: 'table-capacity' }, [
            el('span', { html: icon('person', 'icon icon-sm') }),
            el('span', { text: `${table.capacity} personas` }),
          ]),
          tableDetail(table),
          actions.length ? el('div', { className: 'table-actions' }, actions) : null,
        ]);
      }))
      : emptyState({
        title: 'No hay mesas',
        copy: 'El backend aún no entregó el catálogo de mesas.',
        iconName: 'tables',
      });

    container.replaceChildren(
      pageHeader({
        eyebrow: 'Salón',
        title: 'Mesas',
        subtitle: 'Ocho mesas de servicio con estado disponible, reservada u ocupada (derivado del servidor).',
        actions: [legend],
      }),
      notice(
        'info',
        'Estados calculados',
        'El estado de cada mesa lo determina el servidor según reservas activas y pedidos abiertos. No se edita a mano desde la UI.',
      ),
      el('div', { className: 'section' }, [grid]),
    );
  } catch (err) {
    container.replaceChildren(
      pageHeader({ title: 'Mesas' }),
      notice('danger', 'Error', err.message),
      el('button', {
        type: 'button',
        className: 'btn btn-primary',
        text: 'Reintentar',
        onClick: () => renderTables(container),
      }),
    );
    toast(err.message || 'Error al cargar mesas', 'error');
  }
}
