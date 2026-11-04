import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';
import { AppError } from '../domain/errors.js';

let client = null;

function getClient() {
  if (!config.googleClientId) return null;
  if (!client) client = new OAuth2Client(config.googleClientId);
  return client;
}

export function googleEnabled() {
  return Boolean(config.googleClientId);
}

export async function verifyGoogleIdToken(idToken, expectedNonces = []) {
  const oauthClient = getClient();
  if (!oauthClient) {
    throw new AppError(503, 'google_disabled', 'El inicio de sesión con Google no está configurado.');
  }
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 8_000) {
    throw new AppError(401, 'google_invalid', 'No se pudo verificar la cuenta de Google.');
  }

  const allowedNonces = Array.isArray(expectedNonces) ? expectedNonces : [];

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: config.googleClientId,
    });
    const payload = ticket.getPayload();
    const validIssuer =
      payload?.iss === 'accounts.google.com' || payload?.iss === 'https://accounts.google.com';

    if (
      !payload ||
      !validIssuer ||
      payload.aud !== config.googleClientId ||
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      payload.email_verified !== true ||
      typeof payload.nonce !== 'string' ||
      !allowedNonces.includes(payload.nonce)
    ) {
      throw new Error('Payload de Google incompleto o no confiable.');
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: typeof payload.name === 'string' ? payload.name : '',
      nonce: payload.nonce,
    };
  } catch {
    throw new AppError(401, 'google_invalid', 'No se pudo verificar la cuenta de Google.');
  }
}
