import {
  DISPATCH_STATUS,
  DISPATCH_STATUS_LABELS,
  PERMISSIONS,
} from '/shared/domain.js';
import { DispatchApi } from '../api.js';
import { icon } from '../icons.js';
import { can } from '../state.js';
import {
  badge,
  confirmDialog,
  el,
  emptyState,
  loadingState,
  notice,
  pageHeader,
  statusTone,
  toast,
} from '../ui.js';

export async function renderDispatch(container) {
  const canWrite = can(PERMISSIONS.DISPATCH_WRITE);
  let statusFilter = DISPATCH_STATUS.ON_ROUTE;

  async function paint() {
    container.replaceChildren(loadingState('Cargando despachos…'));
    try {
      const [ready, dispatches] = await Promise.all([
        DispatchApi.ready(),
        DispatchApi.list({ status: statusFilter || undefined }),
      ]);

      const segments = el('div', {
        className: 'segmented',
        role: 'group',
        'aria-label': 'Filtrar despachos',
      }, [
        [DISPATCH_STATUS.ON_ROUTE, 'En ruta'],
        [DISPATCH_STATUS.DELIVERED, 'Entregados'],
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

      const readySection = el('section', { className: 'card' }, [
        el('div', { className: 'card-header' }, [
          el('div', {}, [
            el('h3', { className: 'card-title', text: 'Preparados para despachar' }),
            el('p', {
              className: 'card-sub',
              text: 'Platos listos agrupados por pedido. Al despachar pasan a «en ruta».',
            }),
          ]),
        ]),
        el('div', { className: 'card-body' }, [
          ready.length
            ? el('div', { className: 'ready-list' }, ready.map((group) => el('article', {
              className: 'card dispatch-card',
              style: { boxShadow: 'none' },
            }, [
              el('div', { className: 'dispatch-head' }, [
                el('div', {}, [
                  el('div', { className: 'dispatch-title', text: group.tableName }),
                  el('div', {
                    className: 'dispatch-sub',
                    text: `${(group.items || []).length} plato(s) listos`,
                  }),
                ]),
                badge('Preparado', 'success'),
              ]),
              el('div', { className: 'dispatch-items' }, (group.items || []).map((item) => el('div', {
                className: 'dispatch-item',
              }, [
                el('strong', { text: item.dishName }),
                el('span', { text: `×${item.quantity}` }),
              ]))),
              canWrite
                ? el('button', {
                  type: 'button',
                  className: 'btn btn-primary',
                  text: 'Despachar (en ruta)',
                  onClick: async () => {
                    try {
                      await DispatchApi.create(group.orderId);
                      toast('Despacho en ruta', 'success');
                      paint();
                    } catch (err) {
                      toast(err.message, 'error');
                    }
                  },
                })
                : null,
            ])))
            : emptyState({
              title: 'Nada preparado',
              copy: 'Cuando cocina marque platos como listos, aparecerán aquí.',
              iconName: 'box',
            }),
        ]),
      ]);

      const activeSection = el('section', { className: 'section' }, [
        el('div', { className: 'section-heading' }, [
          el('h3', { className: 'section-title' }, [
            el('span', { html: icon('truck') }),
            el('span', { text: 'Despachos' }),
          ]),
          segments,
        ]),
        dispatches.length
          ? el('div', { className: 'dispatch-grid' }, dispatches.map((d) => el('article', {
            className: 'card dispatch-card',
          }, [
            el('div', { className: 'dispatch-head' }, [
              el('div', {}, [
                el('div', { className: 'dispatch-title', text: d.tableName }),
                el('div', {
                  className: 'dispatch-sub',
                  text: d.createdBy ? `Por ${d.createdBy}` : 'Equipo de despacho',
                }),
              ]),
              badge(
                DISPATCH_STATUS_LABELS[d.status] || d.status,
                statusTone('dispatch', d.status),
              ),
            ]),
            d.status === DISPATCH_STATUS.ON_ROUTE
              ? el('div', { className: 'dispatch-route' }, [
                el('span', { html: icon('truck', 'icon icon-sm') }),
                el('span', { text: 'En camino a la mesa' }),
              ])
              : null,
            el('div', { className: 'dispatch-items' }, (d.items || []).map((item) => el('div', {
              className: 'dispatch-item',
            }, [
              el('strong', { text: item.dishName }),
              el('span', { text: `×${item.quantity}` }),
            ]))),
            canWrite && d.status === DISPATCH_STATUS.ON_ROUTE
              ? el('button', {
                type: 'button',
                className: 'btn btn-secondary',
                text: 'Marcar entregado',
                onClick: async () => {
                  const ok = await confirmDialog({
                    title: 'Confirmar entrega',
                    message: `¿Confirmar entrega en ${d.tableName}?`,
                    confirmLabel: 'Entregado',
                  });
                  if (!ok) return;
                  try {
                    await DispatchApi.deliver(d.id);
                    toast('Despacho entregado', 'success');
                    paint();
                  } catch (err) {
                    toast(err.message, 'error');
                  }
                },
              })
              : null,
          ])))
          : emptyState({
            title: 'Sin despachos',
            copy: 'No hay registros con el filtro actual.',
            iconName: 'truck',
          }),
      ]);

      container.replaceChildren(
        pageHeader({
          eyebrow: 'Servicio',
          title: 'Despachos',
          subtitle: 'Flujo: preparado → en ruta → entregado, según el servidor.',
        }),
        readySection,
        activeSection,
      );
    } catch (err) {
      container.replaceChildren(
        pageHeader({ title: 'Despachos' }),
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
