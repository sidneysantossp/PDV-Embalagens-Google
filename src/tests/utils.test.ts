import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { splitIntoInstallments } from '../utils.js';

describe('utils - splitIntoInstallments', () => {
  it('1x', () => {
    assert.deepStrictEqual(splitIntoInstallments(10000, 1), [10000]);
  });

  it('2x sem resto', () => {
    assert.deepStrictEqual(splitIntoInstallments(10000, 2), [5000, 5000]);
  });

  it('3x com resto 1', () => {
    // 10000 / 3 = 3333, resto 1
    // Deve ficar 3334, 3333, 3333
    assert.deepStrictEqual(splitIntoInstallments(10000, 3), [3334, 3333, 3333]);
  });

  it('3x com resto 2', () => {
    // 10001 / 3 = 3333, resto 2
    // Deve ficar 3334, 3334, 3333
    assert.deepStrictEqual(splitIntoInstallments(10001, 3), [3334, 3334, 3333]);
  });

  it('12x sem resto', () => {
    const res = splitIntoInstallments(12000, 12);
    assert.strictEqual(res.length, 12);
    assert.ok(res.every(r => r === 1000));
  });

  it('Soma deve bater exatamente o valor total', () => {
    const valor = 9999;
    const installments = 7;
    const res = splitIntoInstallments(valor, installments);
    const soma = res.reduce((a, b) => a + b, 0);
    assert.strictEqual(soma, valor);
  });
});
