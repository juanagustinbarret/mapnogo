import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  armarPedidoPush,
  base64urlABytes,
  bytesABase64url,
  cifrarMensaje,
  generarClavesVapid,
  jwtVapid,
} from '../supabase/functions/_shared/webpush.ts';

// RFC 8291, Apéndice A ("Encryption Example")
const RFC = {
  mensaje: 'When I grow up, I want to be a watermelon',
  asPrivada: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublica: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPrivada: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  uaPublica: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  sal: 'DGv6ra1nlYgDCS1FRnbzlw',
  esperado:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

const te = new TextEncoder();
const buf = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

async function hkdf(sal: Uint8Array, ikm: Uint8Array, info: Uint8Array, largo: number) {
  const k = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(sal), info: buf(info) }, k, largo * 8));
}

/** Descifra como lo haría el navegador (para comprobar de forma independiente). */
async function descifrarComoNavegador(cuerpo: Uint8Array, uaPrivada: string, uaPublica: string, auth: string) {
  const sal = cuerpo.slice(0, 16);
  const idlen = cuerpo[20];
  const asPublica = cuerpo.slice(21, 21 + idlen);
  const cifrado = cuerpo.slice(21 + idlen);
  const pub = base64urlABytes(uaPublica);
  const priv = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: uaPrivada, x: bytesABase64url(pub.slice(1, 33)), y: bytesABase64url(pub.slice(33)) }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const asKey = await crypto.subtle.importKey('raw', buf(asPublica), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, priv, 256));
  const info = new Uint8Array([...te.encode('WebPush: info\0'), ...pub, ...asPublica]);
  const ikm = await hkdf(base64urlABytes(auth), ecdh, info, 32);
  const cek = await hkdf(sal, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sal, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['decrypt']);
  const plano = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(nonce) }, k, buf(cifrado)));
  assert.equal(plano[plano.length - 1], 2, 'delimitador de último registro');
  return new TextDecoder().decode(plano.slice(0, -1));
}

test('cifrado idéntico al ejemplo de la RFC 8291 (Apéndice A)', async () => {
  const cuerpo = await cifrarMensaje({ p256dh: RFC.uaPublica, auth: RFC.auth }, te.encode(RFC.mensaje), {
    remitente: { privada: RFC.asPrivada, publica: RFC.asPublica },
    sal: base64urlABytes(RFC.sal),
  });
  assert.equal(bytesABase64url(cuerpo), RFC.esperado);
});

test('con claves al azar, el navegador lo descifra', async () => {
  const cuerpo = await cifrarMensaje({ p256dh: RFC.uaPublica, auth: RFC.auth }, te.encode('{"title":"Hola ñandú 🐸"}'));
  assert.equal(await descifrarComoNavegador(cuerpo, RFC.uaPrivada, RFC.uaPublica, RFC.auth), '{"title":"Hola ñandú 🐸"}');
  // dos envíos del mismo mensaje no se parecen (clave efímera y sal nuevas)
  const otro = await cifrarMensaje({ p256dh: RFC.uaPublica, auth: RFC.auth }, te.encode('{"title":"Hola ñandú 🐸"}'));
  assert.notEqual(bytesABase64url(cuerpo), bytesABase64url(otro));
});

test('JWT VAPID: audiencia = origen del servicio push, vence en 12 h y la firma ES256 verifica', async () => {
  const claves = { ...(await generarClavesVapid()), sujeto: 'mailto:admin@nogoyork.com.ar' };
  const jwt = await jwtVapid('https://fcm.googleapis.com/fcm/send/abc:123', claves, 1_800_000_000);
  const [h, c, f] = jwt.split('.');
  assert.deepEqual(JSON.parse(new TextDecoder().decode(base64urlABytes(h))), { typ: 'JWT', alg: 'ES256' });
  assert.deepEqual(JSON.parse(new TextDecoder().decode(base64urlABytes(c))), { aud: 'https://fcm.googleapis.com', exp: 1_800_000_000 + 12 * 3600, sub: 'mailto:admin@nogoyork.com.ar' });
  const pub = await crypto.subtle.importKey('raw', buf(base64urlABytes(claves.publica)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.equal(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, buf(base64urlABytes(f)), buf(te.encode(`${h}.${c}`))), true);
  await assert.rejects(jwtVapid('https://x.com/a', { ...claves, sujeto: 'admin@x.com' }), /mailto/);
});

test('pedido al servicio push: encabezados que exige el estándar', async () => {
  const claves = { ...(await generarClavesVapid()), sujeto: 'https://mapnogo.vercel.app' };
  const pedido = await armarPedidoPush({ endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/xyz', p256dh: RFC.uaPublica, auth: RFC.auth }, '{"title":"x"}', claves);
  assert.equal(pedido.url, 'https://updates.push.services.mozilla.com/wpush/v2/xyz');
  assert.match(pedido.headers.Authorization, new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${claves.publica}$`));
  assert.equal(pedido.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(pedido.headers.TTL, '86400');
  assert.equal(await descifrarComoNavegador(pedido.body, RFC.uaPrivada, RFC.uaPublica, RFC.auth), '{"title":"x"}');
});
