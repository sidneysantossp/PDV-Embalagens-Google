import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CaixaService } from '../services/CaixaService.js';
import { db } from '../db.js';

describe('CaixaService Tests', () => {
  let service: CaixaService;

  beforeEach(() => {
    // Reset do DB em memória para cada teste
    db.sessoesCaixa = [];
    db.movimentacoesCaixa = [];
    service = new CaixaService();
  });

  it('56. TESTES — SUPRIMENTO', () => {
    service.abrirCaixa({ terminal: 'Caixa 01', openedBy: 'Operador', openingAmountCents: 10000 }); // R$ 100,00
    
    const mov = service.registrarMovimentacao({ type: 'SUPPLY', amountCents: 5000, reason: 'Troco' }); // R$ 50,00
    
    assert.strictEqual(mov.type, 'SUPPLY');
    assert.strictEqual(mov.amountCents, 5000);
    
    const caixa = service.getCaixaAtual();
    assert.strictEqual(caixa?.expectedAmountCents, 15000); // 100 + 50
  });

  it('57. TESTES — SANGRIA', () => {
    service.abrirCaixa({ terminal: 'Caixa 01', openedBy: 'Operador', openingAmountCents: 10000 });
    
    const mov = service.registrarMovimentacao({ type: 'WITHDRAWAL', amountCents: 3000, reason: 'Retirada' }); // R$ 30,00
    
    assert.strictEqual(mov.type, 'WITHDRAWAL');
    assert.strictEqual(mov.amountCents, 3000);
    
    const caixa = service.getCaixaAtual();
    assert.strictEqual(caixa?.expectedAmountCents, 7000); // 100 - 30
  });

  it('58. TESTE COMBINADO', () => {
    service.abrirCaixa({ terminal: 'Caixa 01', openedBy: 'Operador', openingAmountCents: 10000 });
    
    service.registrarMovimentacao({ type: 'SUPPLY', amountCents: 5000, reason: 'Troco' });
    service.registrarMovimentacao({ type: 'WITHDRAWAL', amountCents: 2000, reason: 'Retirada 1' });
    service.registrarMovimentacao({ type: 'WITHDRAWAL', amountCents: 3000, reason: 'Retirada 2' });
    
    const caixa = service.getCaixaAtual();
    assert.strictEqual(caixa?.expectedAmountCents, 10000); // 100 + 50 - 20 - 30 = 100
  });

  it('59. TESTE DE SANGRIA EXCESSIVA', () => {
    service.abrirCaixa({ terminal: 'Caixa 01', openedBy: 'Operador', openingAmountCents: 10000 });
    
    assert.throws(() => {
      service.registrarMovimentacao({ type: 'WITHDRAWAL', amountCents: 15000, reason: 'Retirada maior que saldo' });
    }, /Saldo insuficiente/);
  });

  it('60. TESTE SEM CAIXA', () => {
    assert.throws(() => {
      service.registrarMovimentacao({ type: 'SUPPLY', amountCents: 5000, reason: 'Troco' });
    }, /Nenhum caixa aberto/);
  });

  it('61. TESTE EM CAIXA FECHADO', () => {
    service.abrirCaixa({ terminal: 'Caixa 01', openedBy: 'Operador', openingAmountCents: 10000 });
    service.fecharCaixa({ countedAmountCents: 10000 });
    
    assert.throws(() => {
      service.registrarMovimentacao({ type: 'SUPPLY', amountCents: 5000, reason: 'Troco' });
    }, /Nenhum caixa aberto/); // Porque o status não é 'OPEN' mais
  });

  it('63. TESTE DO FECHAMENTO', () => {
    service.abrirCaixa({ terminal: 'Caixa 01', openedBy: 'Operador', openingAmountCents: 10000 });
    service.registrarMovimentacao({ type: 'SUPPLY', amountCents: 2000, reason: 'Troco' }); // Saldo esperado 120
    
    const fechado = service.fecharCaixa({ countedAmountCents: 13000, closingNote: 'Sobrou 10' }); // Informa 130
    
    assert.strictEqual(fechado.status, 'CLOSED');
    assert.strictEqual(fechado.expectedAmountCents, 12000);
    assert.strictEqual(fechado.countedAmountCents, 13000);
    assert.strictEqual(fechado.differenceAmountCents, 1000); // 130 - 120
  });
});
