import {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  ITEM_STATUS_LABELS,
  PERMISSIONS,
  formatMoney,
} from '/shared/domain.js';
import { validateOrder } from '/shared/validation.js';
import { ApiError, CatalogApi, OrdersApi } from '../api.js';
import { can } from '../state.js';
import {
  badge,
  confirmDialog,
  el,
  emptyState,
  field,
  loadingState,
  notice,
  openModal,
  pageHeader,
  readForm,
  setFieldErrors,
  statusTone,
  toast,
} from '../ui.js';

function queryMesa() {
  const id = Number(new URLSearchParams(window.location.search).get('mesa'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function groupDishes(dishes) {
  const map = new Map();
  for (const dish of dishes) {
    const key = dish.category || 'Otros';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(dish);
  }
  return map;
}

function orderForm({ tables, dishes, initialTableId = null }) {
  const quantities = new Map();
  const notesByDish = new Map();

  const tableOptions = [
    { value: '', label: 'Selecciona una mesa' },
    ...tables.map((t) => ({
      value: String(t.id),
      label: `${t.name} · ${t.capacity} pax · ${t.status}`,
    })),
  ];

  const pickerHost = el('div', { className: 'dish-picker', id: 'dish-picker' });
  const cartHost = el('div', { className: 'cart-summary', 'aria-live': 'polite' });

  function cartTotals() {
    let count = 0;
    let total = 0;
    for (const dish of dishes) {
      const qty = quantities.get(dish.id) || 0;
      if (qty > 0) {
        count += qty;
        total += qty * dish.priceCop;
      }
    }
    return { count, total };
  }

  function renderCart() {
    const { count, total } = cartTotals();
    cartHost.replaceChildren(
      el('div', {}, [
        el('span', { text: count ? `${count} plato(s) seleccionados` : 'Sin platos aún' }),
      ]),
      el('strong', { text: formatMoney(total) }),
    );
  }

  function renderPicker() {
    const groups = groupDishes(dishes);
    const nodes = [];
    for (const [category, items] of groups) {
      nodes.push(el('div', { className: 'dish-category' }, [
        el('div', { className: 'dish-category-title', text: category }),
        ...items.map((dish) => {
          const qty = quantities.get(dish.id) || 0;
          return el('div', {
            className: `dish-row${qty ? ' is-selected' : ''}`,
          }, [
            el('div', { className: 'dish-info' }, [
              el('div', { className: 'dish-name', text: dish.name }),
              el('div', { className: 'dish-desc', text: dish.description || '' }),
            ]),
            el('div', { className: 'dish-price', text: formatMoney(dish.priceCop) }),
            el('div', { className: 'stepper', role: 'group', 'aria-label': `Cantidad de ${dish.name}` }, [
              el('button', {
                type: 'button',
                className: 'stepper-btn',
                'aria-label': `Quitar ${dish.name}`,
                text: '−',
                onClick: () => {
                  const next = Math.max(0, (quantities.get(dish.id) || 0) - 1);
                  if (next === 0) {
                    quantities.delete(dish.id);
                    notesByDish.delete(dish.id);
                  } else quantities.set(dish.id, next);
                  renderPicker();
                  renderCart();
                },
              }),
              el('span', { className: 'stepper-value', text: String(qty) }),
              el('button', {
                type: 'button',
                className: 'stepper-btn',
                'aria-label': `Agregar ${dish.name}`,
                text: '+',
                onClick: () => {
                  quantities.set(dish.id, Math.min(20, (quantities.get(dish.id) || 0) + 1));
                  renderPicker();
                  renderCart();
                },
              }),
            ]),
          ]);
        }),
      ]));
    }
    pickerHost.replaceChildren(...nodes);
  }

  renderPicker();
  renderCart();

  const form = el('form', { id: 'order-form', className: 'form-section', novalidate: true }, [
    el('div', { className: 'form-grid' }, [
      field({
        id: 'order-tableId',
        name: 'tableId',
        label: 'Mesa',
        type: 'select',
        required: true,
        value: initialTableId != null ? String(initialTableId) : '',
        options: tableOptions,
      }),
      field({
        id: 'order-notes',
        name: 'notes',
        label: 'Notas del pedido',
        type: 'textarea',
        rows: 2,
      }),
    ]),
    el('div', { className: 'form-section' }, [
      el('div', { className: 'form-section-title', text: 'Platos' }),
      el('p', {
        className: 'field-hint',
        id: 'order-items-hint',
        text: 'Ajusta cantidades con los controles +/−. Máximo 20 por plato.',
      }),
      el('div', { id: 'order-items-error', className: 'field-error', role: 'alert', hidden: true }),
      pickerHost,
      cartHost,
    ]),
  ]);

  form.getPayload = () => {
    const raw = readForm(form);
    const items = [];
    for (const dish of dishes) {
      const quantity = quantities.get(dish.id) || 0;
      if (quantity > 0) {
        items.push({
          dishId: dish.id,
          quantity,
          notes: notesByDish.get(dish.id) || '',
        });
      }
    }
    return {
      tableId: Number(raw.tableId),
      notes: raw.notes || '',
      items,
    };
  };

  form.setItemsError = (message) => {
    const box = form.querySelector('#order-items-error');
    if (!message) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    box.hidden = false;
    box.textContent = message;
  };

  return form;
}

async function openOrderCreator({ tables, dishes, onSaved }) {
  const form = orderForm({
    tables,
    dishes,
    initialTableId: queryMesa(),
  });

  const saveBtn = el('button', {
    type: 'button',
    className: 'btn btn-primary',
    text: 'Crear pedido',
  });
  const cancelBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost',
    text: 'Cancelar',
  });

  const { close } = openModal({
    title: 'Nuevo pedido',
    subtitle: 'Selecciona mesa y platos. Cocina recibirá la cola automáticamente.',
    body: form,
    footer: [cancelBtn, saveBtn],
    wide: true,
  });

  cancelBtn.addEventListener('click', close);

  saveBtn.addEventListener('click', async () => {
    setFieldErrors(form, null);
    form.setItemsError(null);
    const payload = form.getPayload();
    const table = tables.find((t) => t.id === payload.tableId);
    const dishesById = new Map(dishes.map((d) => [d.id, { ...d, active: 1 }]));
    const client = validateOrder(payload, {
      table: table ? { ...table, active: 1 } : null,
      dishesById,
    });

    if (!client.valid) {
      setFieldErrors(form, client.errors);
      if (client.errors.items) form.setItemsError(client.errors.items);
      return;
    }

    saveBtn.disabled = true;
    try {
      await OrdersApi.create({
        tableId: client.data.tableId,
        notes: client.data.notes,
        reservationId: client.data.reservationId,
        items: client.data.items.map(({ dishId, quantity, notes }) => ({
          dishId,
          quantity,
          notes,
        })),
      });
      toast('Pedido creado', 'success');
      close();
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFieldErrors(form, err.fields);
        if (err.fields.items) form.setItemsError(err.fields.items);
      }
      toast(err.message || 'No se pudo crear el pedido', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

export async function renderOrders(container) {
  const canWrite = can(PERMISSIONS.ORDERS_WRITE);
  let statusFilter = 'active';

  async function paint() {
    container.replaceChildren(loadingState('Cargando pedidos…'));
    try {
      const [tables, dishes, orders] = await Promise.all([
        CatalogApi.tables(),
        CatalogApi.dishes(),
        OrdersApi.list({ status: statusFilter }),
      ]);

      const segments = el('div', {
        className: 'segmented',
        role: 'group',
        'aria-label': 'Filtrar pedidos',
      }, [
        ['active', 'Activos'],
        [ORDER_STATUS.CLOSED, 'Cerrados'],
        [ORDER_STATUS.CANCELLED, 'Cancelados'],
        ['', 'Todos'],
      ].map(([value, label]) => el('button', {
        type: 'button',
        'aria-pressed': statusFilter === value ? 'true' : 'false',
        text: label,
        onClick: () => {
          statusFilter = value;
          paint();
        },
      })));

      const toolbar = el('div', { className: 'toolbar' }, [
        el('div', { className: 'toolbar-group' }, [segments]),
        canWrite
          ? el('button', {
            type: 'button',
            className: 'btn btn-primary',
            text: 'Nuevo pedido',
            onClick: () => openOrderCreator({ tables, dishes, onSaved: paint }),
          })
          : null,
      ]);

      const list = orders.length
        ? el('div', { className: 'list-stack' }, orders.map((order) => el('article', { className: 'card order-card' }, [
          el('div', { className: 'order-head' }, [
            el('div', { className: 'order-head-main' }, [
              el('div', { className: 'order-head-title', text: order.tableName }),
              el('div', {
                className: 'order-head-sub',
                text: `${order.createdBy || 'Equipo'} · ${order.itemCount} ítems`,
              }),
            ]),
            el('div', { className: 'order-head-meta' }, [
              badge(ORDER_STATUS_LABELS[order.status] || order.status, statusTone('order', order.status)),
              el('div', { className: 'order-total', text: formatMoney(order.totalCop) }),
            ]),
          ]),
          el('div', { className: 'order-detail' }, [
            ...(order.items || []).map((item) => el('div', { className: 'order-item' }, [
              el('div', { className: 'order-item-qty', text: `×${item.quantity}` }),
              el('div', { className: 'order-item-main' }, [
                el('div', { className: 'order-item-name', text: item.dishName }),
                item.notes
                  ? el('div', { className: 'order-item-note', text: item.notes })
                  : null,
              ]),
              badge(ITEM_STATUS_LABELS[item.status] || item.status, statusTone('item', item.status)),
              el('div', { className: 'order-item-price', text: formatMoney(item.lineTotalCop) }),
            ])),
            order.notes
              ? el('p', { className: 'order-note', text: order.notes })
              : null,
            canWrite && ['abierto', 'en_cocina', 'listo'].includes(order.status)
              ? el('div', { className: 'btn-group' }, [
                el('button', {
                  type: 'button',
                  className: 'btn btn-sm btn-danger-soft',
                  text: 'Cancelar pedido',
                  onClick: async () => {
                    const ok = await confirmDialog({
                      title: 'Cancelar pedido',
                      message: `¿Cancelar el pedido de ${order.tableName}?`,
                      confirmLabel: 'Cancelar pedido',
                      danger: true,
                    });
                    if (!ok) return;
                    try {
                      await OrdersApi.cancel(order.id);
                      toast('Pedido cancelado', 'success');
                      paint();
                    } catch (err) {
                      toast(err.message, 'error');
                    }
                  },
                }),
              ])
              : null,
          ]),
        ])))
        : emptyState({
          title: 'Sin pedidos',
          copy: 'Crea un pedido desde una mesa disponible u ocupada.',
          iconName: 'orders',
          action: canWrite
            ? el('button', {
              type: 'button',
              className: 'btn btn-primary',
              text: 'Nuevo pedido',
              onClick: () => openOrderCreator({ tables, dishes, onSaved: paint }),
            })
            : null,
        });

      container.replaceChildren(
        pageHeader({
          eyebrow: 'Salón',
          title: 'Pedidos',
          subtitle: 'Cada plato avanza por en cola, preparando y listo.',
        }),
        toolbar,
        list,
      );

      if (queryMesa() && canWrite && !window.__orderAutoOpened) {
        window.__orderAutoOpened = true;
        openOrderCreator({ tables, dishes, onSaved: paint });
      }
    } catch (err) {
      container.replaceChildren(
        pageHeader({ title: 'Pedidos' }),
        notice('danger', 'Error', err.message),
        el('button', {
          type: 'button',
          className: 'btn btn-primary',
          text: 'Reintentar',
          onClick: paint,
        }),
      );
      toast(err.message, 'error');
    }
  }

  await paint();
}
