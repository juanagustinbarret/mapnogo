// Delivery activo: límites, medianoche, varios rangos, 24 hs, cada día y
// zona horaria de Buenos Aires aunque el proceso esté en otra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estadoDelivery,
  estadoDeliveryEn,
  fueraDelHorarioDelLocal,
  momentoArgentina,
  textoEstadoDelivery,
  validarRangosDelDia,
} from '../src/lib/delivery.ts';

const r = (dia: number, ini: string, fin: string) => ({ dia_semana: dia, hora_inicio: ini, hora_fin: fin });
const en = (dia: number, hora: string) => ({ dia, minutos: Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5)) });
const LUNES = 0, MARTES = 1, DOMINGO = 6;

test('límites: inicio inclusivo, fin exclusivo', () => {
  const rangos = [r(LUNES, '12:00', '15:00')];
  assert.equal(estadoDeliveryEn(rangos, en(LUNES, '11:59')).estado, 'mas_tarde');
  assert.deepEqual(estadoDeliveryEn(rangos, en(LUNES, '12:00')), { estado: 'activo', hasta: '15:00' });
  assert.deepEqual(estadoDeliveryEn(rangos, en(LUNES, '14:59')), { estado: 'activo', hasta: '15:00' });
  assert.deepEqual(estadoDeliveryEn(rangos, en(LUNES, '15:00')), { estado: 'inactivo' });
});

test('rango que cruza la medianoche pertenece al día en que empieza', () => {
  const rangos = [r(LUNES, '20:00', '02:00')];
  assert.deepEqual(estadoDeliveryEn(rangos, en(LUNES, '23:00')), { estado: 'activo', hasta: '02:00' });
  // A las 00:30 del martes sigue activo el rango del lunes
  assert.deepEqual(estadoDeliveryEn(rangos, en(MARTES, '00:30')), { estado: 'activo', hasta: '02:00' });
  assert.deepEqual(estadoDeliveryEn(rangos, en(MARTES, '02:00')), { estado: 'inactivo' });
  // El martes a la noche no hay delivery (el rango es solo del lunes)
  assert.deepEqual(estadoDeliveryEn(rangos, en(MARTES, '21:00')), { estado: 'inactivo' });
  // El domingo que cruza sigue el lunes de la semana siguiente
  assert.deepEqual(estadoDeliveryEn([r(DOMINGO, '21:00', '01:00')], en(LUNES, '00:15')), { estado: 'activo', hasta: '01:00' });
});

test('varios rangos por día', () => {
  const rangos = [r(LUNES, '12:00', '15:00'), r(LUNES, '20:00', '00:30')];
  assert.deepEqual(estadoDeliveryEn(rangos, en(LUNES, '10:00')), { estado: 'mas_tarde', desde: '12:00' });
  assert.deepEqual(estadoDeliveryEn(rangos, en(LUNES, '16:00')), { estado: 'mas_tarde', desde: '20:00' });
  assert.deepEqual(estadoDeliveryEn(rangos, en(LUNES, '21:30')), { estado: 'activo', hasta: '00:30' });
  assert.deepEqual(estadoDeliveryEn(rangos, en(MARTES, '00:29')), { estado: 'activo', hasta: '00:30' });
});

test('rangos pegados se encadenan ("hasta" muestra el final real)', () => {
  const rangos = [r(LUNES, '20:00', '24:00'), r(MARTES, '00:00', '02:00')];
  assert.deepEqual(estadoDeliveryEn(rangos, en(LUNES, '21:00')), { estado: 'activo', hasta: '02:00' });
});

test('24 hs: un día y toda la semana', () => {
  const lunes24 = [r(LUNES, '00:00', '24:00')];
  assert.deepEqual(estadoDeliveryEn(lunes24, en(LUNES, '00:00')), { estado: 'activo', hasta: '00:00' });
  assert.deepEqual(estadoDeliveryEn(lunes24, en(LUNES, '23:59')), { estado: 'activo', hasta: '00:00' });
  assert.deepEqual(estadoDeliveryEn(lunes24, en(MARTES, '00:00')), { estado: 'inactivo' });
  const siempre = [0, 1, 2, 3, 4, 5, 6].map((d) => r(d, '00:00', '24:00'));
  assert.deepEqual(estadoDeliveryEn(siempre, en(3, '04:00')), { estado: 'activo', hasta: null });
  assert.equal(textoEstadoDelivery({ estado: 'activo', hasta: null }), 'Delivery activo las 24 hs');
});

test('cada día de la semana usa sus propios rangos', () => {
  for (let dia = 0; dia < 7; dia++) {
    const rangos = [r(dia, '18:00', '22:00')];
    assert.deepEqual(estadoDeliveryEn(rangos, en(dia, '19:00')), { estado: 'activo', hasta: '22:00' }, `día ${dia}`);
    assert.deepEqual(estadoDeliveryEn(rangos, en((dia + 1) % 7, '19:00')), { estado: 'inactivo' }, `día ${dia + 1}`);
  }
  assert.deepEqual(estadoDeliveryEn([], en(LUNES, '12:00')), { estado: 'sin_delivery' });
});

test('se evalúa en hora de Buenos Aires aunque el proceso esté en otra zona', () => {
  const zonaOriginal = process.env.TZ;
  try {
    for (const zona of ['Asia/Tokyo', 'UTC', 'America/Los_Angeles']) {
      process.env.TZ = zona;
      // 2026-10-20T03:30Z = martes 20/10 00:30 en Argentina
      assert.deepEqual(momentoArgentina(new Date('2026-10-20T03:30:00Z')), { dia: MARTES, minutos: 30 }, zona);
      assert.deepEqual(estadoDelivery([r(LUNES, '20:00', '02:00')], new Date('2026-10-20T03:30:00Z')), {
        estado: 'activo',
        hasta: '02:00',
      });
    }
  } finally {
    process.env.TZ = zonaOriginal;
  }
});

test('textos de la etiqueta', () => {
  assert.equal(textoEstadoDelivery({ estado: 'activo', hasta: '23:30' }), 'Delivery activo hasta las 23:30');
  assert.equal(textoEstadoDelivery({ estado: 'mas_tarde', desde: '20:00' }), 'Delivery desde las 20:00');
  assert.equal(textoEstadoDelivery({ estado: 'inactivo' }), null);
  assert.equal(textoEstadoDelivery({ estado: 'sin_delivery' }), null);
});

test('validación del formulario: formato, inicio ≠ fin y superposiciones', () => {
  assert.deepEqual(validarRangosDelDia([{ hora_inicio: '12:00', hora_fin: '15:00' }, { hora_inicio: '20:00', hora_fin: '00:30' }]), []);
  assert.match(validarRangosDelDia([{ hora_inicio: '25:00', hora_fin: '15:00' }])[0].mensaje, /HH:MM/);
  assert.match(validarRangosDelDia([{ hora_inicio: '12:00', hora_fin: '12:00' }])[0].mensaje, /iguales/);
  const superpuestos = validarRangosDelDia([{ hora_inicio: '12:00', hora_fin: '15:00' }, { hora_inicio: '14:00', hora_fin: '16:00' }]);
  assert.equal(superpuestos.length, 1);
  assert.equal(superpuestos[0].indice, 1);
  // Rango que cruza la medianoche contra uno de la madrugada del mismo día: no se pisan
  assert.deepEqual(validarRangosDelDia([{ hora_inicio: '20:00', hora_fin: '02:00' }, { hora_inicio: '00:30', hora_fin: '01:00' }]), []);
  // Pegados (fin exclusivo) no se superponen
  assert.deepEqual(validarRangosDelDia([{ hora_inicio: '12:00', hora_fin: '15:00' }, { hora_inicio: '15:00', hora_fin: '18:00' }]), []);
  // 24 hs junto con otro rango del mismo día: superposición
  assert.equal(validarRangosDelDia([{ hora_inicio: '00:00', hora_fin: '24:00' }, { hora_inicio: '20:00', hora_fin: '22:00' }]).length, 1);
});

test('aviso si el delivery cae fuera del horario del local', () => {
  const turnos = [
    { dia_semana: LUNES, hora_apertura: '11:00:00', hora_cierre: '15:00:00' },
    { dia_semana: LUNES, hora_apertura: '19:00:00', hora_cierre: '01:00:00' },
  ];
  assert.equal(fueraDelHorarioDelLocal(r(LUNES, '12:00', '15:00'), turnos), false);
  assert.equal(fueraDelHorarioDelLocal(r(LUNES, '20:00', '00:30'), turnos), false, 'el turno del local también cruza la medianoche');
  assert.equal(fueraDelHorarioDelLocal(r(LUNES, '14:00', '16:00'), turnos), true);
  assert.equal(fueraDelHorarioDelLocal(r(MARTES, '12:00', '13:00'), turnos), true);
  assert.equal(fueraDelHorarioDelLocal(r(LUNES, '12:00', '13:00'), [{ ...turnos[0], activo: false }]), true);
});
