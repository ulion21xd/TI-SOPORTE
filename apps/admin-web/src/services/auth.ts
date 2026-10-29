const apiBaseUrl = '/api';

export class AuthRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

async function postJson(path: string, payload: Record<string, string>): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new AuthRequestError('No se pudo contactar la API. La solicitud no fue confirmada.');
  }

  if (response.status === 404) {
    throw new AuthRequestError('Esta operación todavía no está implementada en la API.', response.status);
  }
  if (response.status === 429) {
    throw new AuthRequestError('Se alcanzó el límite temporal de intentos. Espera antes de volver a intentarlo.', response.status);
  }
  if (response.status === 503) {
    throw new AuthRequestError('El servicio de correo no pudo confirmar el envío. Revisa la configuración SMTP o contacta al equipo de TI.', response.status);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (response.status >= 500 && (!contentType.includes('application/json') || [502, 503, 504].includes(response.status))) {
    throw new AuthRequestError('No se puede alcanzar la API local. Confirma que la API y su conexión a PostgreSQL estén disponibles. No se confirmó el envío.', response.status);
  }
  if (!response.ok) {
    throw new AuthRequestError('La API no pudo procesar la solicitud. No se confirmó el envío; revisa el servicio antes de volver a intentarlo.', response.status);
  }
  return response;
}

export async function requestEmailCode(email: string): Promise<void> {
  await postJson('/auth/email-code/request', { email });
}

export async function verifyEmailCode(email: string, code: string): Promise<boolean> {
  const response = await postJson('/auth/email-code/verify', { email, code });
  const result: unknown = await response.json().catch(() => null);
  if (!result || typeof result !== 'object' || !('verified' in result) || typeof result.verified !== 'boolean') {
    throw new AuthRequestError('La API no confirmó el resultado de la verificación.', response.status);
  }
  return result.verified;
}
