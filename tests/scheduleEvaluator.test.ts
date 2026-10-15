import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarEstadoHorario } from '../src/lib/scheduleEvaluator';
import type { HorarioAtencion } from '../src/types/database.types';

// Convención: 0 = Lunes ... 6 = Domingo. Semana de referencia: lunes 12/10/2026.
const turno = (dia_semana: number, hora_apertura: string, hora_cierre: string, turnoNum = 1): HorarioAtencion => ({
  id: `${dia_semana}-${turnoNum}`,
  comercio_id: 'c1',
  dia_semana,
  turno: turnoNum,
  hora_apertura,
  hora_cierre,
  cruza_medianoche: hora_cierre < hora_apertura,
  activo: true,
});

// Hora argentina explícita: el resultado no depende de la zona del navegador
const ar = (fechaHora: string) => new Date(`${fechaHora}-03:00`);

test('sin horarios: no informado', () => {
  assert.equal(evaluarEstadoHorario([]).estado, 'no_informado');
});

test('el lunes se evalúa con dia_semana 0', () => {
  const horarios = [turno(0, '08:00', '12:00')];
  assert.equal(evaluarEstadoHorario(horarios, ar('2026-10-12T10:00:00')).estado, 'abierto');
  // El domingo (dia 6) no tiene turnos
  assert.equal(evaluarEstadoHorario(horarios, ar('2026-10-18T10:00:00')).mensaje, 'Cerrado hoy');
});

test('dos turnos el mismo día', () => {
  const horarios = [turno(2, '08:00', '12:00', 1), turno(2, '16:00', '20:00', 2)];
  assert.equal(evaluarEstadoHorario(horarios, ar('2026-10-14T13:00:00')).mensaje, 'Cerrado en este momento');
  assert.equal(evaluarEstadoHorario(horarios, ar('2026-10-14T17:00:00')).estado, 'abierto');
});

test('aviso de cierre en los últimos 30 minutos', () => {
  const r = evaluarEstadoHorario([turno(2, '08:00', '12:00')], ar('2026-10-14T11:45:00'));
  assert.equal(r.estado, 'cierra_pronto');
  assert.equal(r.mensaje, 'Cierra pronto (15 min)');
});

test('turno nocturno del viernes sigue abierto la madrugada del sábado', () => {
  const horarios = [turno(4, '20:00', '02:00')];
  assert.equal(evaluarEstadoHorario(horarios, ar('2026-10-16T19:00:00')).estado, 'cerrado');
  assert.equal(evaluarEstadoHorario(horarios, ar('2026-10-16T21:00:00')).estado, 'abierto');
  assert.equal(evaluarEstadoHorario(horarios, ar('2026-10-17T01:00:00')).estado, 'abierto');
  assert.equal(evaluarEstadoHorario(horarios, ar('2026-10-17T01:45:00')).estado, 'cierra_pronto');
  assert.equal(evaluarEstadoHorario(horarios, ar('2026-10-17T03:00:00')).estado, 'cerrado');
});

test('un turno nocturno del sábado no abre la madrugada del mismo sábado', () => {
  const horarios = [turno(5, '20:00', '02:00')];
  assert.equal(evaluarEstadoHorario(horarios, ar('2026-10-17T01:00:00')).estado, 'cerrado');
});

test('turnos inactivos no cuentan', () => {
  const inactivo = { ...turno(2, '08:00', '20:00'), activo: false };
  assert.equal(evaluarEstadoHorario([inactivo], ar('2026-10-14T10:00:00')).estado, 'no_informado');
});
