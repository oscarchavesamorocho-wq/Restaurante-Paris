import { RESTAURANT_NAME } from '/shared/domain.js';
import { validateLogin } from '/shared/validation.js';
import { ApiError, AuthApi } from '../api.js';
import { icon } from '../icons.js';
import { defaultRoute, navigate } from '../router.js';
import { getState, setSession } from '../state.js';
import {
  el,
  field,
  notice,
  readForm,
  setFieldErrors,
  toast,
} from '../ui.js';

let googleScriptPromise = null;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      googleScriptPromise = null;
      reject(new Error('No se pudo cargar Google Identity Services.'));
    };
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

function googleSlotMessage(slot, text) {
  slot.replaceChildren(el('p', {
    className: 'field-hint',
    role: 'status',
    'aria-live': 'polite',
    text,
  }));
}

function googleFallback(slot, hint) {
  const hintId = 'google-signin-hint';
  slot.replaceChildren(
    el('button', {
      type: 'button',
      className: 'google-fallback',
      disabled: true,
      'aria-describedby': hintId,
    }, [
      el('span', {
        className: 'google-mark',
        'aria-hidden': 'true',
        html: `<svg viewBox="0 0 48 48" focusable="false">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>`,
      }),
      el('span', { text: 'Continuar con Google' }),
    ]),
    el('p', {
      className: 'field-hint',
      id: hintId,
      text: hint,
    }),
  );
}

async function setupGoogle(slot, onCredential) {
  const config = getState().config;
  if (!config?.googleEnabled || !config.googleClientId) {
    googleFallback(slot, 'Inicio con Google no disponible. Configura GOOGLE_CLIENT_ID para activarlo.');
    return false;
  }

  googleSlotMessage(slot, 'Cargando acceso con Google…');

  try {
    const [{ nonce }] = await Promise.all([
      AuthApi.googleNonce(),
      loadGoogleScript(),
    ]);
    if (typeof nonce !== 'string' || nonce.length < 32) {
      throw new Error('Nonce de Google inválido.');
    }

    window.google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: (response) => {
        if (response?.credential) onCredential(response.credential);
      },
      nonce,
      ux_mode: 'popup',
      context: 'signin',
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
    });

    const buttonHost = el('div', { className: 'google-button' });
    window.google.accounts.id.renderButton(buttonHost, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'continue_with',
      locale: 'es',
    });
    slot.replaceChildren(buttonHost);
    return true;
  } catch {
    googleFallback(slot, 'No se pudo cargar Google. Usa tu correo y contraseña.');
    return false;
  }
}

function applySession(data) {
  setSession({
    user: data.user,
    permissions: data.permissions,
    today: data.today,
    time: data.time,
    timezone: data.timezone,
    demoMode: data.demoMode,
    restaurantName: data.restaurantName || getState().restaurantName,
  });
}

export async function renderLogin(root) {
  const state = getState();
  const formId = 'login-form';

  const errorBox = el('div', { className: 'login-error', hidden: true, role: 'alert' });

  const emailField = field({
    id: 'login-email',
    name: 'email',
    label: 'Correo',
    type: 'email',
    autocomplete: 'username',
    required: true,
    placeholder: 'tu@correo.com',
  });
  const passwordField = field({
    id: 'login-password',
    name: 'password',
    label: 'Contraseña',
    type: 'password',
    autocomplete: 'current-password',
    required: true,
  });

  const submitBtn = el('button', {
    type: 'submit',
    className: 'btn btn-primary btn-lg btn-block',
    text: 'Entrar',
  });

  const form = el('form', {
    id: formId,
    className: 'login-form',
    novalidate: true,
    onSubmit: async (event) => {
      event.preventDefault();
      errorBox.hidden = true;
      errorBox.textContent = '';
      setFieldErrors(form, null);

      const raw = readForm(form);
      const client = validateLogin(raw);
      if (!client.valid) {
        setFieldErrors(form, client.errors);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Entrando…';
      try {
        const data = await AuthApi.login(client.data.email, client.data.password);
        const me = await AuthApi.me().catch(() => data);
        applySession({
          ...data,
          today: me.today ?? state.today,
          time: me.time ?? state.time,
          timezone: me.timezone ?? state.timezone,
          demoMode: me.demoMode ?? state.demoMode,
          restaurantName: me.restaurantName ?? state.restaurantName,
        });
        toast(`Bienvenido/a, ${data.user.name}`, 'success');
        const home = defaultRoute();
        navigate(home?.path || '/', { replace: true });
      } catch (err) {
        if (err instanceof ApiError && err.fields) setFieldErrors(form, err.fields);
        errorBox.hidden = false;
        errorBox.textContent = err.message || 'No se pudo iniciar sesión.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar';
      }
    },
  }, [
    errorBox,
    emailField,
    passwordField,
    submitBtn,
  ]);

  const googleSlot = el('div', { className: 'google-slot', id: 'google-signin' });
  const googleBlock = [el('div', { className: 'login-divider', text: 'o continúa con' }), googleSlot];

  const view = el('div', { className: 'login-view' }, [
    el('section', { className: 'login-brand', 'aria-label': 'Presentación' }, [
      el('div', { className: 'login-brand-top' }, [
        el('div', { className: 'login-brand-mark', text: 'CP' }),
        el('div', {}, [
          el('div', { className: 'login-brand-name', text: state.restaurantName || RESTAURANT_NAME }),
          el('div', { className: 'login-brand-sub', text: 'Sistema de reservas' }),
        ]),
      ]),
      el('div', { className: 'login-brand-copy' }, [
        el('h1', {
          className: 'login-hero-title',
          html: 'Servicio claro,<br><em>mesa a mesa</em>',
        }),
        el('p', {
          className: 'login-hero-copy',
          text: 'Reservas, cocina y despachos en una sola vista operativa, pensada para el ritmo del salón.',
        }),
        el('ul', { className: 'login-points' }, [
          el('li', { className: 'login-point' }, [
            el('span', { html: icon('check', 'icon icon-sm') }),
            el('span', { text: 'Mesas y reservas del día' }),
          ]),
          el('li', { className: 'login-point' }, [
            el('span', { html: icon('check', 'icon icon-sm') }),
            el('span', { text: 'Cola de cocina táctil' }),
          ]),
          el('li', { className: 'login-point' }, [
            el('span', { html: icon('check', 'icon icon-sm') }),
            el('span', { text: 'Despachos con seguimiento' }),
          ]),
        ]),
      ]),
      el('p', {
        className: 'login-brand-foot',
        text: 'Acceso por roles. La autorización se verifica en el servidor.',
      }),
    ]),
    el('section', { className: 'login-panel' }, [
      el('div', { className: 'login-card' }, [
        el('div', { className: 'login-card-head' }, [
          el('h2', { className: 'login-card-title', text: 'Acceder' }),
          el('p', {
            className: 'login-card-sub',
            text: 'Usa tu cuenta del restaurante. No guardamos contraseñas en el navegador.',
          }),
        ]),
        form,
        googleBlock,
        state.demoMode
          ? el('p', {
            className: 'login-demo-note',
            text: 'Entorno de demostración. Las credenciales viven solo en el servidor / archivo local ignorado por git.',
          })
          : null,
        el('div', { className: 'login-security' }, [
          el('span', { html: icon('shield', 'icon icon-sm') }),
          el('span', {
            text: 'La sesión usa cookie HttpOnly. Los permisos se obtienen del servidor en cada inicio.',
          }),
        ]),
        notice(
          'info',
          null,
          'Si olvidaste la contraseña, pide a un administrador que la restablezca.',
        ),
      ]),
    ]),
  ]);

  root.replaceChildren(view);

  async function handleGoogleCredential(credential) {
    try {
      const data = await AuthApi.google(credential);
      const me = await AuthApi.me().catch(() => data);
      applySession({
        ...data,
        today: me.today ?? state.today,
        time: me.time ?? state.time,
        timezone: me.timezone ?? state.timezone,
        demoMode: me.demoMode ?? state.demoMode,
        restaurantName: me.restaurantName ?? state.restaurantName,
      });
      toast(`Bienvenido/a, ${data.user.name}`, 'success');
      const home = defaultRoute();
      navigate(home?.path || '/', { replace: true });
    } catch (err) {
      toast(err.message || 'No se pudo iniciar con Google', 'error');
      if (document.contains(googleSlot)) {
        await setupGoogle(googleSlot, handleGoogleCredential);
      }
    }
  }

  await setupGoogle(googleSlot, handleGoogleCredential);
}
