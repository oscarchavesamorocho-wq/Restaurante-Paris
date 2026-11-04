import {
  PERMISSIONS,
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABELS,
  SERVICE_HOURS,
} from '/shared/domain.js';
import { validateReservation } from '/shared/validation.js';
import { ApiError, CatalogApi, ReservationsApi } from '../api.js';
import { icon } from '../icons.js';
import { can, getState } from '../state.js';
import {
  badge,
  confirmDialog,
  el,
  emptyState,
  field,
  formatShortDate,
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

function reservationForm({ tables, initial = {}, today }) {
  const tableOptions = [
    { value: '', label: 'Selecciona una mesa' },
    ...tables.map((t) => ({
      value: String(t.id),
      label: `${t.name} · ${t.capacity} pax (${t.zone || 'Salón'})`,
    })),
  ];

  return el('form', { id: 'reservation-form', className: 'form-section', novalidate: true }, [
    el('div', { className: 'form-grid' }, [
      field({
        id: 'res-customerName',
        name: 'customerName',
        label: 'Nombre del cliente',
        required: true,
        value: initial.customerName || '',
        autocomplete: 'name',
      }),
      field({
        id: 'res-customerPhone',
        name: 'customerPhone',
        label: 'Teléfono',
        required: true,
        value: initial.customerPhone || '',
        autocomplete: 'tel',
      }),
      field({
        id: 'res-tableId',
        name: 'tableId',
        label: 'Mesa',
        type: 'select',
        required: true,
        value: initial.tableId != null ? String(initial.tableId) : '',
        options: tableOptions,
      }),
      field({
        id: 'res-people',
        name: 'people',
        label: 'Personas',
        type: 'number',
        required: true,
        min: 1,
        max: 12,
        value: initial.people != null ? String(initial.people) : '2',
      }),
      field({
        id: 'res-date',
        name: 'date',
        label: 'Fecha',
        type: 'date',
        required: true,
        value: initial.date || today,
        min: today,
      }),
      field({
        id: 'res-time',
        name: 'time',
        label: 'Hora',
        type: 'time',
        required: true,
        value: initial.time || SERVICE_HOURS.start,
        hint: `Horario de reservas: ${SERVICE_HOURS.start} – ${SERVICE_HOURS.lastReservation}`,
      }),
      el('div', { className: 'field-full' }, [
        field({
          id: 'res-notes',
          name: 'notes',
          label: 'Notas',
          type: 'textarea',
          value: initial.notes || '',
          rows: 3,
        }),
      ]),
    ]),
  ]);
}

async function openReservationEditor({ tables, existing = null, onSaved }) {
  const state = getState();
  const isEdit = Boolean(existing);
  const form = reservationForm({
    tables,
    today: state.today,
    initial: existing || { tableId: queryMesa() },
  });

  const saveBtn = el('button', {
    type: 'button',
    className: 'btn btn-primary',
    text: isEdit ? 'Guardar cambios' : 'Crear reserva',
  });
  const cancelBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost',
    text: 'Cancelar',
  });

  const { close } = openModal({
    title: isEdit ? 'Editar reserva' : 'Nueva reserva',
    subtitle: 'Los datos se validan en cliente y servidor.',
    body: form,
    footer: [cancelBtn, saveBtn],
    wide: true,
  });

  cancelBtn.addEventListener('click', close);

  saveBtn.addEventListener('click', async () => {
    setFieldErrors(form, null);
    const raw = readForm(form);
    const table = tables.find((t) => String(t.id) === String(raw.tableId));
    const client = validateReservation({
      ...raw,
      tableId: Number(raw.tableId),
      people: Number(raw.people),
    }, {
      table: table ? { ...table, active: 1 } : null,
      today: state.today,
      nowTime: state.time,
    });

    if (!client.valid) {
      setFieldErrors(form, client.errors);
      return;
    }

    saveBtn.disabled = true;
    try {
      if (isEdit) {
        await ReservationsApi.update(existing.id, client.data);
        toast('Reserva actualizada', 'success');
      } else {
        await ReservationsApi.create(client.data);
        toast('Reserva creada', 'success');
      }
      close();
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(form, err.fields);
      toast(err.message || 'No se pudo guardar', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

export async function renderReservations(container) {
  container.replaceChildren(loadingState('Cargando reservas…'));
  const state = getState();
  const canWrite = can(PERMISSIONS.RESERVATIONS_WRITE);

  const filters = {
    date: state.today || '',
    status: RESERVATION_STATUS.ACTIVE,
    q: '',
    tableId: queryMesa(),
  };

  async function load() {
    const [tables, list] = await Promise.all([
      CatalogApi.tables(),
      ReservationsApi.list({
        date: filters.date || undefined,
        status: filters.status || undefined,
        q: filters.q || undefined,
        tableId: filters.tableId || undefined,
      }),
    ]);
    return { tables, list };
  }

  async function paint() {
    container.replaceChildren(loadingState('Cargando reservas…'));
    try {
      const { tables, list } = await load();

      const searchField = el('div', { className: 'search-field' }, [
        el('span', { html: icon('search', 'icon icon-sm') }),
        el('input', {
          className: 'field-control',
          type: 'search',
          name: 'q',
          value: filters.q,
          placeholder: 'Buscar por nombre o teléfono',
          'aria-label': 'Buscar reservas',
          onInput: (e) => {
            filters.q = e.target.value;
          },
          onKeydown: (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              paint();
            }
          },
        }),
      ]);

      const dateField = field({
        id: 'filter-date',
        name: 'date',
        label: 'Fecha',
        type: 'date',
        value: filters.date,
      });
      dateField.querySelector('input').addEventListener('change', (e) => {
        filters.date = e.target.value;
      });

      const statusField = field({
        id: 'filter-status',
        name: 'status',
        label: 'Estado',
        type: 'select',
        value: filters.status,
        options: [
          { value: '', label: 'Todos' },
          ...Object.values(RESERVATION_STATUS).map((s) => ({
            value: s,
            label: RESERVATION_STATUS_LABELS[s],
          })),
        ],
      });
      statusField.querySelector('select').addEventListener('change', (e) => {
        filters.status = e.target.value;
      });

      const toolbar = el('div', { className: 'toolbar' }, [
        el('div', { className: 'toolbar-group', style: { flex: '1' } }, [
          searchField,
          dateField,
          statusField,
        ]),
        el('div', { className: 'toolbar-group' }, [
          el('button', {
            type: 'button',
            className: 'btn btn-quiet',
            text: 'Aplicar filtros',
            onClick: () => paint(),
          }),
          canWrite
            ? el('button', {
              type: 'button',
              className: 'btn btn-primary',
              html: `${icon('plus', 'icon icon-sm')} Nueva reserva`,
              onClick: () => openReservationEditor({
                tables,
                onSaved: paint,
              }),
            })
            : null,
        ]),
      ]);

      const listNode = list.length
        ? el('div', { className: 'list-stack', role: 'list' }, list.map((r) => {
          const actions = [];
          if (canWrite && r.status === RESERVATION_STATUS.ACTIVE) {
            actions.push(
              el('button', {
                type: 'button',
                className: 'btn btn-sm btn-quiet',
                text: 'Editar',
                onClick: () => openReservationEditor({
                  tables,
                  existing: r,
                  onSaved: paint,
                }),
              }),
              el('button', {
                type: 'button',
                className: 'btn btn-sm btn-quiet',
                text: 'Completar',
                onClick: async () => {
                  const ok = await confirmDialog({
                    title: 'Completar reserva',
                    message: `¿Marcar la reserva de ${r.customerName} como completada?`,
                    confirmLabel: 'Completar',
                  });
                  if (!ok) return;
                  try {
                    await ReservationsApi.complete(r.id);
                    toast('Reserva completada', 'success');
                    paint();
                  } catch (err) {
                    toast(err.message, 'error');
                  }
                },
              }),
              el('button', {
                type: 'button',
                className: 'btn btn-sm btn-danger-soft',
                text: 'Cancelar',
                onClick: async () => {
                  const ok = await confirmDialog({
                    title: 'Cancelar reserva',
                    message: `¿Cancelar la reserva de ${r.customerName}?`,
                    confirmLabel: 'Cancelar reserva',
                    danger: true,
                  });
                  if (!ok) return;
                  try {
                    await ReservationsApi.cancel(r.id);
                    toast('Reserva cancelada', 'success');
                    paint();
                  } catch (err) {
                    toast(err.message, 'error');
                  }
                },
              }),
            );
          }

          return el('article', { className: 'record', role: 'listitem' }, [
            el('div', { className: 'reservation-time' }, [
              el('strong', { text: r.time }),
              el('span', { text: formatShortDate(r.date) }),
            ]),
            el('div', { className: 'record-main' }, [
              el('div', { className: 'customer-line' }, [
                el('strong', { text: r.customerName }),
                badge(RESERVATION_STATUS_LABELS[r.status] || r.status, statusTone('reservation', r.status)),
              ]),
              el('div', {
                className: 'record-sub',
                text: `${r.tableName} · ${r.people} personas · ${r.customerPhone}${r.notes ? ` · ${r.notes}` : ''}`,
              }),
            ]),
            actions.length ? el('div', { className: 'record-actions' }, actions) : null,
          ]);
        }))
        : emptyState({
          title: 'Sin reservas',
          copy: 'Prueba otros filtros o crea una nueva reserva.',
          iconName: 'calendar',
          action: canWrite
            ? el('button', {
              type: 'button',
              className: 'btn btn-primary',
              text: 'Nueva reserva',
              onClick: () => openReservationEditor({ tables, onSaved: paint }),
            })
            : null,
        });

      container.replaceChildren(
        pageHeader({
          eyebrow: 'Agenda',
          title: 'Reservas',
          subtitle: 'Busca, filtra, crea y edita reservas con validación accesible.',
        }),
        toolbar,
        listNode,
      );

      if (queryMesa() && canWrite && !filters._autoOpened) {
        filters._autoOpened = true;
        openReservationEditor({ tables, onSaved: paint });
      }
    } catch (err) {
      container.replaceChildren(
        pageHeader({ title: 'Reservas' }),
        notice('danger', 'Error', err.message),
        el('button', {
          type: 'button',
          className: 'btn btn-primary',
          text: 'Reintentar',
          onClick: paint,
        }),
      );
      toast(err.message || 'Error al cargar reservas', 'error');
    }
  }

  await paint();
}
