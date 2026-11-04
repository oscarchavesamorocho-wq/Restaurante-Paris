import {
  ITEM_STATUS,
  PERMISSIONS,
} from '/shared/domain.js';
import { KitchenApi, OrdersApi } from '../api.js';
import { can } from '../state.js';
import {
  el,
  emptyState,
  loadingState,
  notice,
  pageHeader,
  toast,
} from '../ui.js';

function waitingLabel(minutes) {
  const late = minutes >= 15;
  return el('span', {
    className: `waiting${late ? ' is-late' : ''}`,
    text: `${minutes} min`,
  });
}

function kitchenCard(item, { canWrite, onAction }) {
  const urgent = item.waitingMinutes >= 15;
  let action = null;

  if (canWrite && item.status === ITEM_STATUS.QUEUED) {
    action = el('button', {
      type: 'button',
      className: 'btn btn-primary',
      text: 'Iniciar preparación',
      onClick: () => onAction('start', item),
    });
  } else if (canWrite && item.status === ITEM_STATUS.PREPARING) {
    action = el('button', {
      type: 'button',
      className: 'btn btn-secondary',
      text: 'Marcar listo',
      onClick: () => onAction('ready', item),
    });
  }

  return el('article', {
    className: `kitchen-card${urgent ? ' is-urgent' : ''}`,
  }, [
    el('div', { className: 'kitchen-card-top' }, [
      el('div', { className: 'kitchen-dish', text: item.dishName }),
      el('div', { className: 'kitchen-qty', text: `×${item.quantity}` }),
    ]),
    el('div', { className: 'kitchen-meta' }, [
      el('span', { text: item.tableName }),
      waitingLabel(item.waitingMinutes || 0),
    ]),
    item.notes
      ? el('div', { className: 'kitchen-note', text: item.notes })
      : null,
    action,
  ]);
}

function column({ title, tone, items, emptyCopy, canWrite, onAction }) {
  return el('section', {
    className: 'kitchen-column',
    'aria-label': title,
  }, [
    el('div', { className: 'kitchen-column-head' }, [
      el('div', { className: 'kitchen-column-title' }, [
        el('span', { className: `dot ${tone === 'info' ? '' : ''}`, style: {
          background: tone === 'info'
            ? 'var(--color-info)'
            : tone === 'warning'
              ? 'var(--color-warning)'
              : 'var(--color-success)',
        } }),
        el('span', { text: title }),
      ]),
      el('span', { className: 'kitchen-column-count', text: `${items.length}` }),
    ]),
    el('div', { className: 'kitchen-list' }, [
      items.length
        ? items.map((item) => kitchenCard(item, { canWrite, onAction }))
        : emptyState({
          title: 'Vacío',
          copy: emptyCopy,
          iconName: 'kitchen',
        }),
    ]),
  ]);
}

export async function renderKitchen(container) {
  const canWrite = can(PERMISSIONS.KITCHEN_WRITE);
  let timer = null;

  async function paint({ silent = false } = {}) {
    if (!silent) container.replaceChildren(loadingState('Cargando cola de cocina…'));
    try {
      const [queue, orders] = await Promise.all([
        KitchenApi.queue(),
        // Cocina no tiene DISPATCH_READ; usamos pedidos activos para la columna «listo»
        OrdersApi.list({ status: 'active' }),
      ]);

      const queued = queue.filter((i) => i.status === ITEM_STATUS.QUEUED);
      const preparing = queue.filter((i) => i.status === ITEM_STATUS.PREPARING);
      const ready = [];
      for (const order of orders) {
        for (const item of order.items || []) {
          if (item.status === ITEM_STATUS.READY) {
            ready.push({
              ...item,
              tableName: order.tableName,
              waitingMinutes: Math.max(
                0,
                Math.floor((Date.now() - Date.parse(item.updatedAt || item.createdAt)) / 60_000),
              ),
            });
          }
        }
      }

      const onAction = async (kind, item) => {
        try {
          if (kind === 'start') await KitchenApi.start(item.id);
          if (kind === 'ready') await KitchenApi.ready(item.id);
          toast(kind === 'start' ? 'Preparación iniciada' : 'Plato listo', 'success');
          await paint({ silent: true });
        } catch (err) {
          toast(err.message, 'error');
          await paint({ silent: true });
        }
      };

      container.replaceChildren(
        pageHeader({
          eyebrow: 'Producción',
          title: 'Cocina',
          subtitle: 'Vista táctil: en cola → preparando → listo. Actualización automática cada 20 s.',
          actions: [
            el('button', {
              type: 'button',
              className: 'btn btn-quiet',
              text: 'Actualizar',
              onClick: () => paint(),
            }),
          ],
        }),
        !canWrite
          ? notice('info', 'Solo lectura', 'Tu rol puede ver la cola pero no cambiar estados.')
          : null,
        el('div', { className: 'kitchen-board' }, [
          column({
            title: 'En cola',
            tone: 'info',
            items: queued,
            emptyCopy: 'No hay platos esperando.',
            canWrite,
            onAction,
          }),
          column({
            title: 'Preparando',
            tone: 'warning',
            items: preparing,
            emptyCopy: 'Nada en fogones.',
            canWrite,
            onAction,
          }),
          column({
            title: 'Listo',
            tone: 'success',
            items: ready,
            emptyCopy: 'Sin platos listos por despachar.',
            canWrite: false,
            onAction,
          }),
        ]),
      );
    } catch (err) {
      container.replaceChildren(
        pageHeader({ title: 'Cocina' }),
        notice('danger', 'Error', err.message),
        el('button', {
          type: 'button',
          className: 'btn btn-primary',
          text: 'Reintentar',
          onClick: () => paint(),
        }),
      );
      if (!silent) toast(err.message, 'error');
    }
  }

  await paint();
  timer = window.setInterval(() => paint({ silent: true }), 20_000);

  return () => {
    if (timer) window.clearInterval(timer);
  };
}
