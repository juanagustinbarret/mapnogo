// Flujo de suscripción a notificaciones push, con navegador y Supabase falsos.
// Nunca se envía nada real: no hay red ni service worker de verdad.
import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { llamadas, respuestas, reiniciar } from './soporte/supabase-falso.mjs';
import {
  cancelarNotificacionesPush,
  obtenerSuscripcionPushActual,
  solicitarPermisoNotificacionesPush,
  urlBase64ToUint8Array,
} from '../src/lib/pushNotifications.ts';

const CLAVE = 'BFjU2t_4zHJBLGlfY4UTdp-f6aHfI_X5GR-R6OaA0a_Tkep9IBMLn5ST1Sxtow3d1atu48SBpH4BLYWWK4zhsTA';

type Opciones = {
  permiso?: NotificationPermission;
  respuestaPermiso?: NotificationPermission;
  conPush?: boolean;
  userAgent?: string;
  registrado?: boolean;
  readyNunca?: boolean;
  suscripcionPrevia?: ReturnType<typeof crearSuscripcion> | null;
  subscribeFalla?: boolean;
};

const contador = { register: 0, subscribe: 0, requestPermission: 0 };

function crearSuscripcion(endpoint: string, clave: Uint8Array) {
  const s = {
    endpoint,
    options: { applicationServerKey: clave.buffer },
    bajas: 0,
    toJSON: () => ({ endpoint, keys: { p256dh: 'BPx-y_z', auth: 'au_th-1' } }),
    unsubscribe: async () => {
      s.bajas++;
      return true;
    },
  };
  return s;
}

function montar(o: Opciones = {}) {
  contador.register = contador.subscribe = contador.requestPermission = 0;
  let suscripcion = o.suscripcionPrevia ?? null;
  let registrado = o.registrado ?? false;
  const registro = {
    pushManager: {
      getSubscription: async () => suscripcion,
      subscribe: async ({ applicationServerKey }: { applicationServerKey: Uint8Array }) => {
        contador.subscribe++;
        if (o.subscribeFalla) throw new Error('AbortError');
        suscripcion = crearSuscripcion('https://push.example/nuevo', applicationServerKey);
        return suscripcion;
      },
    },
  };
  const serviceWorker = {
    ready: o.readyNunca ? new Promise(() => undefined) : Promise.resolve(registro),
    getRegistration: async () => (registrado ? registro : undefined),
    register: async () => {
      contador.register++;
      registrado = true;
      return registro;
    },
  };
  const permiso = { valor: o.permiso ?? 'default' };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: o.userAgent ?? 'Mozilla/5.0 (X11; Linux x86_64)', platform: 'Linux', maxTouchPoints: 0, serviceWorker },
  });
  (globalThis as any).window = globalThis;
  if (o.conPush === false) delete (globalThis as any).PushManager;
  else (globalThis as any).PushManager = function PushManager() {};
  (globalThis as any).Notification = {
    get permission() {
      return permiso.valor;
    },
    requestPermission: async () => {
      contador.requestPermission++;
      permiso.valor = o.respuestaPermiso ?? 'granted';
      return permiso.valor;
    },
  };
  return { obtener: () => suscripcion };
}

beforeEach(() => {
  reiniciar();
  (globalThis as any).__ENV__ = {};
});

test('registra el service worker, se suscribe y guarda claves base64url por endpoint', async () => {
  montar();
  const resultado = await solicitarPermisoNotificacionesPush();
  assert.equal(resultado.ok, true);
  assert.equal(contador.register, 1, 'antes nunca se registraba /sw.js');
  assert.equal(contador.subscribe, 1);
  assert.deepEqual(llamadas, [
    {
      tabla: 'push_subscriptions',
      operacion: 'upsert',
      fila: { endpoint: 'https://push.example/nuevo', p256dh: 'BPx-y_z', auth: 'au_th-1' },
      opciones: { onConflict: 'endpoint' },
    },
  ]);
});

test('si el service worker no responde, avisa en vez de quedar colgado', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    montar({ readyNunca: true });
    const pendiente = solicitarPermisoNotificacionesPush();
    await new Promise((r) => setImmediate(r));
    mock.timers.tick(10_000);
    const resultado = await pendiente;
    assert.deepEqual(resultado, { ok: false, motivo: 'error_servicio' });
    assert.equal(llamadas.length, 0);
  } finally {
    mock.timers.reset();
  }
});

test('permiso ya bloqueado: no vuelve a preguntar y explica cómo habilitarlo', async () => {
  montar({ permiso: 'denied' });
  assert.deepEqual(await solicitarPermisoNotificacionesPush(), { ok: false, motivo: 'denegado' });
  assert.equal(contador.requestPermission, 0);
});

test('el usuario cierra el cartel de permiso sin elegir', async () => {
  montar({ respuestaPermiso: 'default' });
  assert.deepEqual(await solicitarPermisoNotificacionesPush(), { ok: false, motivo: 'descartado' });
  assert.equal(contador.subscribe, 0);
});

test('el usuario rechaza el permiso', async () => {
  montar({ respuestaPermiso: 'denied' });
  assert.deepEqual(await solicitarPermisoNotificacionesPush(), { ok: false, motivo: 'denegado' });
});

test('iPhone sin la app instalada recibe una explicación específica', async () => {
  montar({ conPush: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)' });
  assert.deepEqual(await solicitarPermisoNotificacionesPush(), { ok: false, motivo: 'ios_sin_instalar' });
  montar({ conPush: false });
  assert.deepEqual(await solicitarPermisoNotificacionesPush(), { ok: false, motivo: 'no_soportado' });
});

test('si no se puede guardar en la base, no dice "activadas" y da de baja', async () => {
  const navegador = montar();
  respuestas.upsert = { error: { message: 'new row violates row-level security policy' } };
  const resultado = await solicitarPermisoNotificacionesPush();
  assert.deepEqual(resultado, { ok: false, motivo: 'error_guardado' });
  assert.equal(navegador.obtener()?.bajas, 1);
});

test('si el navegador falla al suscribir, informa error', async () => {
  montar({ subscribeFalla: true });
  assert.deepEqual(await solicitarPermisoNotificacionesPush(), { ok: false, motivo: 'error_servicio' });
});

test('reutiliza la suscripción existente con la misma clave (sin duplicados)', async () => {
  const previa = crearSuscripcion('https://push.example/existente', urlBase64ToUint8Array(CLAVE));
  montar({ registrado: true, suscripcionPrevia: previa, permiso: 'granted' });
  const primera = await solicitarPermisoNotificacionesPush();
  const segunda = await solicitarPermisoNotificacionesPush();
  assert.equal(primera.ok && segunda.ok, true);
  assert.equal(contador.subscribe, 0);
  assert.equal(contador.register, 0);
  // Dos activaciones = dos upsert del mismo endpoint (no dos filas)
  assert.deepEqual(
    llamadas.map((l) => l.fila?.endpoint),
    ['https://push.example/existente', 'https://push.example/existente'],
  );
});

test('si la suscripción previa usa otra clave VAPID, la rehace', async () => {
  const previa = crearSuscripcion('https://push.example/vieja', new Uint8Array([1, 2, 3]));
  montar({ registrado: true, suscripcionPrevia: previa, permiso: 'granted' });
  const resultado = await solicitarPermisoNotificacionesPush();
  assert.equal(resultado.ok, true);
  assert.equal(previa.bajas, 1);
  assert.equal(contador.subscribe, 1);
});

test('usa la clave VAPID del entorno si está definida', async () => {
  const otraClave = 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  (globalThis as any).__ENV__ = { VITE_VAPID_PUBLIC_KEY: otraClave };
  const navegador = montar();
  await solicitarPermisoNotificacionesPush();
  const usada = new Uint8Array(navegador.obtener()!.options.applicationServerKey);
  assert.deepEqual(usada, urlBase64ToUint8Array(otraClave));
});

test('darse de baja: anula la suscripción del navegador y borra la fila', async () => {
  const previa = crearSuscripcion('https://push.example/existente', urlBase64ToUint8Array(CLAVE));
  montar({ registrado: true, suscripcionPrevia: previa, permiso: 'granted' });
  assert.equal(await cancelarNotificacionesPush(), true);
  assert.equal(previa.bajas, 1);
  assert.deepEqual(llamadas, [
    { tabla: 'push_subscriptions', operacion: 'delete', columna: 'endpoint', valor: 'https://push.example/existente' },
  ]);
});

test('darse de baja funciona aunque falle el borrado en la base', async () => {
  const previa = crearSuscripcion('https://push.example/existente', urlBase64ToUint8Array(CLAVE));
  montar({ registrado: true, suscripcionPrevia: previa, permiso: 'granted' });
  respuestas.delete = { error: { message: 'permission denied' } };
  assert.equal(await cancelarNotificacionesPush(), true);
  assert.equal(previa.bajas, 1);
});

test('el estado inicial del botón no pide permisos ni registra nada', async () => {
  montar({ permiso: 'default' });
  assert.equal(await obtenerSuscripcionPushActual(), null);
  assert.equal(contador.requestPermission + contador.register + contador.subscribe, 0);
});
