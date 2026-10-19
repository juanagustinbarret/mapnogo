import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estrellasValidas } from '../src/lib/resenas.ts';

test('estrellas: siempre un entero entre 0 y 5 (no se cae la ficha)', () => {
  assert.equal(estrellasValidas(4), 4);
  assert.equal(estrellasValidas('5'), 5);
  assert.equal(estrellasValidas(9), 5);
  assert.equal(estrellasValidas(-1), 0);
  assert.equal(estrellasValidas(3.6), 4);
  assert.equal(estrellasValidas(null), 0);
  assert.equal(estrellasValidas('x'), 0);
  assert.doesNotThrow(() => [...Array(estrellasValidas(-3))]);
  assert.throws(() => [...Array(-3)]); // lo que pasaba antes
});
