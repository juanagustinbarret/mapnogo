// Genera un par de claves VAPID para las notificaciones push.
// Uso: node scripts/generar-claves-vapid.mjs
//
// Solo hace falta si NO tienen la clave privada que corresponde a la pública
// que usa hoy la app (VITE_VAPID_PUBLIC_KEY / el respaldo en
// src/lib/pushNotifications.ts). Si cambian el par, los dispositivos ya
// suscriptos dejan de recibir hasta que vuelvan a tocar "Recibir Ofertas".
// La PRIVADA va solo en los secretos de Supabase; nunca en el repo ni en Vercel.

const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const publica = b64url(new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey)));
const privada = (await crypto.subtle.exportKey('jwk', par.privateKey)).d;

console.log('VAPID_PUBLIC_KEY  =', publica);
console.log('VAPID_PRIVATE_KEY =', privada);
console.log('\nPública: en Vercel (VITE_VAPID_PUBLIC_KEY) y en los secretos de Supabase (VAPID_PUBLIC_KEY).');
console.log('Privada: SOLO en los secretos de Supabase (VAPID_PRIVATE_KEY).');
