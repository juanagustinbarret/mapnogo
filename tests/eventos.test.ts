import { test } from 'node:test';
import assert from 'node:assert/strict';
import { horaCorta, textoFechaEvento, textoHorarioEvento } from '../src/lib/eventos.ts';

test('fecha del evento en formato argentino (antes se mostraba 2026-10-25)', () => {
  assert.equal(textoFechaEvento('2026-10-25'), '25/10/2026');
  assert.equal(textoFechaEvento(''), '');
  assert.equal(textoFechaEvento(null), '');
});

test('horario del evento sin segundos ni "??"', () => {
  assert.equal(horaCorta('21:00:00'), '21:00');
  assert.equal(horaCorta('9:30'), '09:30');
  assert.equal(horaCorta('x'), '');
  assert.equal(textoHorarioEvento('21:00:00', '23:30:00'), '21:00 a 23:30 hs');
  assert.equal(textoHorarioEvento('21:00:00', null), '21:00 hs'); // antes: "21:00:00 a ??"
  assert.equal(textoHorarioEvento(null, '23:00'), '');
});

import { archivoCalendario, linkComoLlegarEvento, linkEvento } from '../src/lib/eventos.ts';

const evento = {
  id: 'e1',
  titulo: 'Fiesta del Agua; edición 2026',
  descripcion: 'Shows en vivo,\npatio de comidas',
  fecha_evento: '2026-10-25',
  hora_inicio: '18:00:00',
  hora_fin: '23:30:00',
  ubicacion_texto: 'Parque Municipal',
};

test('cómo llegar: Google Maps con el lugar en Nogoyá', () => {
  assert.equal(
    linkComoLlegarEvento('Parque Municipal'),
    'https://www.google.com/maps/dir/?api=1&destination=Parque%20Municipal%2C%20Nogoy%C3%A1%2C%20Entre%20R%C3%ADos',
  );
  assert.equal(linkComoLlegarEvento('Plaza Libertad, Nogoyá'), 'https://www.google.com/maps/dir/?api=1&destination=Plaza%20Libertad%2C%20Nogoy%C3%A1');
  assert.equal(linkComoLlegarEvento(''), null);
  assert.equal(linkComoLlegarEvento(null), null);
});

test('link para compartir el evento', () => {
  assert.equal(linkEvento('https://mapnogo.vercel.app/', 'e1'), 'https://mapnogo.vercel.app/?evento=e1');
});

test('agendar: horario argentino pasado a UTC y textos escapados', () => {
  const ics = archivoCalendario(evento, new Date('2026-10-20T12:00:00Z'));
  assert.match(ics, /DTSTART:20261025T210000Z/); // 18:00 en Argentina
  assert.match(ics, /DTEND:20261026T023000Z/); // 23:30 en Argentina
  assert.match(ics, /SUMMARY:Fiesta del Agua\\; edición 2026/);
  assert.match(ics, /DESCRIPTION:Shows en vivo\\,\\npatio de comidas/);
  assert.match(ics, /LOCATION:Parque Municipal\\, Nogoyá\\, Entre Ríos/);
  assert.ok(ics.includes('\r\n'));
});

test('agendar: sin hora de fin dura 2 horas; si termina después de medianoche, al día siguiente', () => {
  assert.match(archivoCalendario({ ...evento, hora_fin: null }), /DTSTART:20261025T210000Z\r\nDTEND:20261025T230000Z/);
  assert.match(archivoCalendario({ ...evento, hora_inicio: '22:00', hora_fin: '02:00' }), /DTSTART:20261026T010000Z\r\nDTEND:20261026T050000Z/);
});

test('agendar: sin hora es un evento de todo el día', () => {
  assert.match(archivoCalendario({ ...evento, hora_inicio: null, hora_fin: null }), /DTSTART;VALUE=DATE:20261025\r\nDTEND;VALUE=DATE:20261026/);
});

import { puntoDelEvento } from '../src/lib/eventos.ts';

test('punto del evento: acepta números o textos y descarta valores inválidos', () => {
  assert.deepEqual(puntoDelEvento({ latitud: -32.3939, longitud: -59.7881 }), { lat: -32.3939, lng: -59.7881 });
  assert.deepEqual(puntoDelEvento({ latitud: '-32.39', longitud: '-59.79' }), { lat: -32.39, lng: -59.79 });
  assert.equal(puntoDelEvento({}), null);
  assert.equal(puntoDelEvento({ latitud: -32.39, longitud: null }), null);
  assert.equal(puntoDelEvento({ latitud: 0, longitud: 0 }), null);
  assert.equal(puntoDelEvento({ latitud: -59.79, longitud: -32.39 }), null); // invertidas
  assert.equal(puntoDelEvento({ latitud: '', longitud: '' }), null);
});

test('cómo llegar: con punto marcado usa las coordenadas, no el nombre', () => {
  assert.equal(
    linkComoLlegarEvento('Parque Municipal', { lat: -32.3939, lng: -59.7881 }),
    'https://www.google.com/maps/dir/?api=1&destination=-32.393900,-59.788100',
  );
  assert.equal(linkComoLlegarEvento(null, { lat: -32.39, lng: -59.79 }), 'https://www.google.com/maps/dir/?api=1&destination=-32.390000,-59.790000');
  assert.match(linkComoLlegarEvento('Parque Municipal', null) ?? '', /destination=Parque%20Municipal/);
});

test('agendar: con punto agrega GEO', () => {
  const ics = archivoCalendario({ ...evento, latitud: -32.3939, longitud: -59.7881 });
  assert.match(ics, /GEO:-32\.393900;-59\.788100\r\n/);
  assert.doesNotMatch(archivoCalendario(evento), /GEO:/);
});
