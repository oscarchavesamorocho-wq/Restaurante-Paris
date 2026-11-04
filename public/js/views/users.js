import {
  PERMISSIONS,
  ROLE_LABELS,
  ROLE_VALUES,
} from '/shared/domain.js';
import { validateDemoReset, validateUserCreate } from '/shared/validation.js';
import { AdminApi, ApiError, UsersApi } from '../api.js';
import { icon } from '../icons.js';
import { can, getState } from '../state.js';
import {
  badge,
  confirmDialog,
  el,
  emptyState,
  field,
  initials,
  loadingState,
  notice,
  openModal,
  pageHeader,
  readForm,
  setFieldErrors,
  toast,
} from '../ui.js';

function showTemporaryPassword(password, title) {
  openModal({
    title,
    subtitle: 'Cópiala ahora. No se volverá a mostrar completa.',
    body: el('div', { className: 'secret-box' }, [
      el('p', {
        className: 'field-hint',
        text: 'Contraseña temporal (solo esta vez):',
      }),
      el('div', { className: 'secret-value', text: password }),
      el('p', {
        className: 'tooltip-hint',
        text: 'Pide al usuario que la cambie en el próximo acceso gestionado por administración.',
      }),
    ]),
    footer: [
      el('button', {
        type: 'button',
        className: 'btn btn-primary',
        text: 'Entendido',
        onClick: (e) => e.target.closest('dialog')?.close(),
      }),
    ],
  });
}

async function openUserCreate(onSaved) {
  const form = el('form', { id: 'user-form', className: 'form-section', novalidate: true }, [
    el('div', { className: 'form-grid' }, [
      field({
        id: 'user-name',
        name: 'name',
        label: 'Nombre',
        required: true,
      }),
      field({
        id: 'user-email',
        name: 'email',
        label: 'Correo',
        type: 'email',
        required: true,
      }),
      field({
        id: 'user-role',
        name: 'role',
        label: 'Rol',
        type: 'select',
        required: true,
        value: 'mesero',
        options: ROLE_VALUES.map((role) => ({
          value: role,
          label: ROLE_LABELS[role],
        })),
      }),
      field({
        id: 'user-password',
        name: 'password',
        label: 'Contraseña (opcional)',
        type: 'password',
        hint: 'Si la dejas vacía, el servidor genera una temporal (mín. 12 caracteres si la defines).',
      }),
    ]),
  ]);

  const saveBtn = el('button', { type: 'button', className: 'btn btn-primary', text: 'Crear usuario' });
  const cancelBtn = el('button', { type: 'button', className: 'btn btn-ghost', text: 'Cancelar' });
  const { close } = openModal({
    title: 'Nuevo usuario',
    body: form,
    footer: [cancelBtn, saveBtn],
  });
  cancelBtn.addEventListener('click', close);

  saveBtn.addEventListener('click', async () => {
    setFieldErrors(form, null);
    const raw = readForm(form);
    const client = validateUserCreate({
      ...raw,
      password: raw.password || undefined,
    });
    if (!client.valid) {
      setFieldErrors(form, client.errors);
      return;
    }
    saveBtn.disabled = true;
    try {
      const result = await UsersApi.create({
        name: client.data.name,
        email: client.data.email,
        role: client.data.role,
        password: client.data.password || undefined,
      });
      toast('Usuario creado', 'success');
      close();
      if (result.temporaryPassword) {
        showTemporaryPassword(result.temporaryPassword, 'Contraseña temporal');
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(form, err.fields);
      toast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

async function openDemoReset(onDone) {
  const form = el('form', { id: 'demo-reset-form', className: 'form-section', novalidate: true }, [
    notice(
      'danger',
      'Acción irreversible en demo',
      'Se restablecerán mesas, platos, reservas, pedidos y despachos. Los usuarios se conservan.',
    ),
    field({
      id: 'demo-confirmation',
      name: 'confirmation',
      label: 'Escribe RESTABLECER para confirmar',
      required: true,
      autocomplete: 'off',
    }),
  ]);

  const saveBtn = el('button', {
    type: 'button',
    className: 'btn btn-danger',
    text: 'Restablecer demo',
  });
  const cancelBtn = el('button', { type: 'button', className: 'btn btn-ghost', text: 'Cancelar' });
  const { close } = openModal({
    title: 'Restablecer datos demo',
    subtitle: 'Confirmación explícita obligatoria',
    body: form,
    footer: [cancelBtn, saveBtn],
  });
  cancelBtn.addEventListener('click', close);

  saveBtn.addEventListener('click', async () => {
    setFieldErrors(form, null);
    const raw = readForm(form);
    const client = validateDemoReset(raw);
    if (!client.valid) {
      setFieldErrors(form, client.errors);
      return;
    }

    const double = await confirmDialog({
      title: '¿Seguro?',
      message: 'Esta acción reinicia los datos de demostración. ¿Continuar?',
      confirmLabel: 'Sí, restablecer',
      danger: true,
    });
    if (!double) return;

    saveBtn.disabled = true;
    try {
      await AdminApi.resetDemo(client.data.confirmation);
      toast('Demo restablecida', 'success');
      close();
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(form, err.fields);
      toast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

export async function renderUsers(container) {
  if (!can(PERMISSIONS.USERS_MANAGE)) {
    container.replaceChildren(
      pageHeader({ title: 'Usuarios' }),
      notice('danger', 'Sin permiso', 'Solo administradores pueden gestionar usuarios.'),
    );
    return;
  }

  async function paint() {
    container.replaceChildren(loadingState('Cargando usuarios…'));
    const state = getState();
    try {
      const users = await UsersApi.list();

      const list = users.length
        ? el('div', { className: 'record-list' }, users.map((user) => {
          const actions = [
            el('button', {
              type: 'button',
              className: 'btn btn-sm btn-quiet',
              text: user.active ? 'Desactivar' : 'Activar',
              onClick: async () => {
                try {
                  await UsersApi.update(user.id, { active: !user.active });
                  toast(user.active ? 'Usuario desactivado' : 'Usuario activado', 'success');
                  paint();
                } catch (err) {
                  toast(err.message, 'error');
                }
              },
            }),
            el('button', {
              type: 'button',
              className: 'btn btn-sm btn-quiet',
              text: 'Nueva contraseña',
              onClick: async () => {
                const ok = await confirmDialog({
                  title: 'Restablecer contraseña',
                  message: `¿Generar una contraseña temporal para ${user.name}?`,
                  confirmLabel: 'Generar',
                });
                if (!ok) return;
                try {
                  const result = await UsersApi.resetPassword(user.id, {});
                  if (result.temporaryPassword) {
                    showTemporaryPassword(result.temporaryPassword, 'Contraseña restablecida');
                  }
                  if (result.sessionInvalidated) {
                    window.dispatchEvent(new CustomEvent('session-expired', {
                      detail: {
                        message: 'Tu sesión se cerró porque restableciste tu propia contraseña.',
                      },
                    }));
                  } else {
                    toast('Contraseña restablecida', 'success');
                  }
                } catch (err) {
                  toast(err.message, 'error');
                }
              },
            }),
          ];

          return el('article', { className: 'record user-record' }, [
            el('div', { className: 'record-lead', text: initials(user.name) }),
            el('div', { className: 'record-main' }, [
              el('div', { className: 'record-title', text: user.name }),
              el('div', { className: 'record-sub', text: user.email }),
            ]),
            el('div', { className: 'record-meta' }, [
              badge(ROLE_LABELS[user.role] || user.role, 'accent'),
              user.isDemo ? badge('Demo', 'warning') : null,
              badge(user.active ? 'Activo' : 'Inactivo', user.active ? 'success' : 'neutral'),
              user.googleLinked ? badge('Google', 'info') : null,
            ]),
            el('div', { className: 'record-actions' }, actions),
          ]);
        }))
        : emptyState({ title: 'Sin usuarios', copy: 'Crea el primer usuario.', iconName: 'users' });

      const adminPanel = el('aside', { className: 'card danger-zone' }, [
        el('div', { className: 'card-header' }, [
          el('div', {}, [
            el('h3', { className: 'card-title', text: 'Administración' }),
            el('p', { className: 'card-sub', text: 'Visible solo para administradores' }),
          ]),
        ]),
        el('div', { className: 'card-body stack' }, [
          el('div', { className: 'security-list' }, [
            el('div', { className: 'security-item' }, [
              el('span', { html: icon('shield') }),
              el('div', {}, [
                el('strong', { text: 'Permisos en servidor' }),
                el('span', { text: 'La UI solo oculta opciones; el API autoriza cada acción.' }),
              ]),
            ]),
            el('div', { className: 'security-item' }, [
              el('span', { html: icon('info') }),
              el('div', {}, [
                el('strong', { text: 'Sin secretos en el navegador' }),
                el('span', { text: 'No se guardan credenciales ni roles en localStorage.' }),
              ]),
            ]),
          ]),
          state.demoMode
            ? el('button', {
              type: 'button',
              className: 'btn btn-danger btn-block',
              text: 'Restablecer datos demo…',
              onClick: () => openDemoReset(paint),
            })
            : notice('info', null, 'El restablecimiento demo solo aparece con DEMO_MODE activo.'),
        ]),
      ]);

      container.replaceChildren(
        pageHeader({
          eyebrow: 'Administración',
          title: 'Usuarios',
          subtitle: 'Altas, roles y reinicio de demostración con confirmación explícita.',
          actions: [
            el('button', {
              type: 'button',
              className: 'btn btn-primary',
              text: 'Nuevo usuario',
              onClick: () => openUserCreate(paint),
            }),
          ],
        }),
        el('div', { className: 'admin-panels' }, [
          el('section', { className: 'card' }, [
            el('div', { className: 'card-header' }, [
              el('div', {}, [
                el('h3', { className: 'card-title', text: 'Equipo' }),
                el('p', { className: 'card-sub', text: `${users.length} usuario(s)` }),
              ]),
            ]),
            el('div', { className: 'card-body' }, [list]),
          ]),
          adminPanel,
        ]),
      );
    } catch (err) {
      container.replaceChildren(
        pageHeader({ title: 'Usuarios' }),
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
