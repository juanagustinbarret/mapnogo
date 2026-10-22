// supabase/functions/_shared/webpush.ts
//
// Web Push sin dependencias: cifrado del mensaje (RFC 8291, aes128gcm) y
// firma VAPID (RFC 8292), con WebCrypto. Funciona igual en Deno (Supabase
// Edge Functions) y en Node 22 (las pruebas). Se probó contra el ejemplo del
// Apéndice A de la RFC 8291 (tests/webpush.test.ts).

export interface SuscripcionPush {
  endpoint: string;
  /** Clave pública del navegador (P-256 sin comprimir, base64url, 65 bytes) */
  p256dh: string;
  /** Secreto de autenticación del navegador (base64url, 16 bytes) */
  auth: string;
}

export interface ClavesVapid {
  /** base64url, 65 bytes (la misma que usa el navegador para suscribirse) */
  publica: string;
  /** base64url, 32 bytes */
  privada: string;
  /** "mailto:alguien@dominio" o "https://dominio": lo exigen los servicios push */
  sujeto: string;
}

const te = new TextEncoder();

export function base64urlABytes(texto: string): Uint8Array {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (texto.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function bytesABase64url(bytes: Uint8Array | ArrayBuffer): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const unir = (...partes: Uint8Array[]) => {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const salida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
};

const buf = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

/** HKDF-SHA256 (extract + expand) */
async function hkdf(sal: Uint8Array, ikm: Uint8Array, info: Uint8Array, largo: number): Promise<Uint8Array> {
  const clave = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(sal), info: buf(info) }, clave, largo * 8);
  return new Uint8Array(bits);
}

/** Clave privada P-256 (d en base64url) + su pública sin comprimir → JWK */
function jwkPrivada(privada: string, publica: string): JsonWebKey {
  const pub = base64urlABytes(publica);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('Clave pública P-256 inválida (tienen que ser 65 bytes, empezando con 0x04)');
  return {
    kty: 'EC',
    crv: 'P-256',
    d: privada,
    x: bytesABase64url(pub.slice(1, 33)),
    y: bytesABase64url(pub.slice(33, 65)),
    ext: true,
  };
}

export interface OpcionesCifrado {
  /** Solo para pruebas: claves del remitente y sal fijas (RFC 8291, Apéndice A) */
  remitente?: { privada: string; publica: string };
  sal?: Uint8Array;
  /** Tamaño de registro (rs). 4096 por defecto. */
  rs?: number;
}

/** Cifra `mensaje` para una suscripción (RFC 8291 con aes128gcm, un solo registro). */
export async function cifrarMensaje(suscripcion: Pick<SuscripcionPush, 'p256dh' | 'auth'>, mensaje: Uint8Array, opciones: OpcionesCifrado = {}): Promise<Uint8Array> {
  const uaPublica = base64urlABytes(suscripcion.p256dh);
  const secretoAuth = base64urlABytes(suscripcion.auth);
  if (uaPublica.length !== 65) throw new Error('p256dh inválida');
  if (secretoAuth.length < 16) throw new Error('auth inválido');

  let asPrivada: CryptoKey;
  let asPublica: Uint8Array;
  if (opciones.remitente) {
    asPrivada = await crypto.subtle.importKey('jwk', jwkPrivada(opciones.remitente.privada, opciones.remitente.publica), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    asPublica = base64urlABytes(opciones.remitente.publica);
  } else {
    const par = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    asPrivada = par.privateKey;
    asPublica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  }

  const claveUa = await crypto.subtle.importKey('raw', buf(uaPublica), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secretoEcdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: claveUa }, asPrivada, 256));

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const infoClave = unir(te.encode('WebPush: info\0'), uaPublica, asPublica);
  const ikm = await hkdf(secretoAuth, secretoEcdh, infoClave, 32);

  const sal = opciones.sal ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sal, ikm, te.encode('Content-Encoding: nonce\0'), 12);

  // Un solo registro: mensaje + delimitador 0x02 (último registro), sin relleno
  const plano = unir(mensaje, new Uint8Array([2]));
  const rs = opciones.rs ?? 4096;
  if (plano.length + 16 > rs) throw new Error('El mensaje es demasiado grande para un registro');
  const claveAes = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(nonce) }, claveAes, buf(plano)));

  // Encabezado: sal (16) | rs (4, big endian) | largo del id (1) | id = as_public (65)
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, rs);
  return unir(sal, rsBytes, new Uint8Array([asPublica.length]), asPublica, cifrado);
}

/** JWT VAPID firmado con ES256 para el servicio push del endpoint (RFC 8292). */
export async function jwtVapid(endpoint: string, claves: ClavesVapid, ahoraSegundos = Math.floor(Date.now() / 1000), validezSegundos = 12 * 3600): Promise<string> {
  if (!/^(mailto:|https:\/\/)/.test(claves.sujeto)) throw new Error('VAPID_SUBJECT tiene que empezar con "mailto:" o "https://"');
  const aud = new URL(endpoint).origin;
  const codificar = (o: unknown) => bytesABase64url(te.encode(JSON.stringify(o)));
  const sinFirmar = `${codificar({ typ: 'JWT', alg: 'ES256' })}.${codificar({ aud, exp: ahoraSegundos + validezSegundos, sub: claves.sujeto })}`;
  const clave = await crypto.subtle.importKey('jwk', jwkPrivada(claves.privada, claves.publica), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // WebCrypto devuelve r||s (64 bytes), que es justo el formato de JWS
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, clave, buf(te.encode(sinFirmar)));
  return `${sinFirmar}.${bytesABase64url(firma)}`;
}

export interface PedidoPush {
  url: string;
  headers: Record<string, string>;
  body: Uint8Array;
}

/** Arma el pedido HTTP al servicio push (FCM, Mozilla, Apple…). */
export async function armarPedidoPush(
  suscripcion: SuscripcionPush,
  mensaje: string,
  claves: ClavesVapid,
  opciones: { ttlSegundos?: number; urgencia?: 'very-low' | 'low' | 'normal' | 'high' } = {},
): Promise<PedidoPush> {
  const body = await cifrarMensaje(suscripcion, te.encode(mensaje));
  const jwt = await jwtVapid(suscripcion.endpoint, claves);
  return {
    url: suscripcion.endpoint,
    headers: {
      Authorization: `vapid t=${jwt}, k=${claves.publica}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(opciones.ttlSegundos ?? 24 * 3600),
      Urgency: opciones.urgencia ?? 'normal',
    },
    body,
  };
}

/** Par de claves VAPID nuevo (para el script de configuración). */
export async function generarClavesVapid(): Promise<{ publica: string; privada: string }> {
  const par = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const publica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
  return { publica: bytesABase64url(publica), privada: jwk.d as string };
}
