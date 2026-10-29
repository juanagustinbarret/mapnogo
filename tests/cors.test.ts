import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORIGENES_POR_DEFECTO, conCors, origenesPermitidos } from '../supabase/functions/_shared/cors.ts';

const pedido = (origen?: string) => new Request('https://base.supabase.co/functions/v1/x', { method: 'POST', headers: origen ? { origin: origen } : {} });
const respuesta = () => new Response('{"ok":true}', { status: 201, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' } });

test('origenesPermitidos: lista de la variable, sin espacios ni barra final; si falta, la de por defecto', () => {
  assert.deepEqual(origenesPermitidos(' https://a.com/ , https://b.com'), ['https://a.com', 'https://b.com']);
  assert.deepEqual(origenesPermitidos(undefined), ORIGENES_POR_DEFECTO);
  assert.deepEqual(origenesPermitidos(' , '), ORIGENES_POR_DEFECTO);
});

test('conCors: solo un origen permitido recibe Access-Control-Allow-Origin, nunca *', async () => {
  const permitidos = origenesPermitidos(undefined);
  const ok = conCors(pedido('https://mapnogo.vercel.app'), respuesta(), permitidos);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'https://mapnogo.vercel.app');
  assert.equal(ok.headers.get('Vary'), 'Origin');
  assert.equal(ok.status, 201);
  assert.equal(ok.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  assert.equal(await ok.text(), '{"ok":true}');
  assert.equal(conCors(pedido('https://sitio-malo.com'), respuesta(), permitidos).headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(conCors(pedido('https://mapnogo.vercel.app.sitio-malo.com'), respuesta(), permitidos).headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(conCors(pedido(), respuesta(), permitidos).headers.get('Access-Control-Allow-Origin'), null, 'sin Origin (servidor a servidor) no hace falta');
});
