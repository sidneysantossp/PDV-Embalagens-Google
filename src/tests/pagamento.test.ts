import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { VendaService } from '../services/VendaService.js';
import { CaixaService } from '../services/CaixaService.js';
import { db } from '../db.js';

describe('VendaService Tests - Pagamento Misto', () => {
  let vendaService: VendaService;
  let caixaService: CaixaService;
  let sessaoId = '';

  beforeEach(() => {
    db.sessoesCaixa = [];
    db.vendas = [];
    db.movimentacoesCaixa = [];
    (db as any).cancelamentos = [];
    
    // Add product
    if (!db.produtos.find(p => p.id === '1')) {
       db.produtos.push({ id: '1', codigo: '001', nome: 'Teste', barra: '123', valor: 10, custo: 5, estGeral: 100 });
    } else {
       db.produtos.find(p => p.id === '1')!.estGeral = 100;
    }

    caixaService = new CaixaService();
    vendaService = new VendaService();
    const sessao = caixaService.abrirCaixa({ terminal: 'T1', openedBy: 'Op1', openingAmountCents: 10000 });
    sessaoId = sessao.id;
  });

  it('Pagamento com 1 forma', () => {
    const venda = vendaService.finalizarVenda({
      subtotal: 100,
      desconto: 0,
      total: 100,
      sessaoCaixaId: sessaoId,
      itens: [{ produtoId: '1', quantidade: 1, valorUnitario: 100, total: 100 }],
      pagamentos: [
        { metodo: 'PIX', valorCentavos: 10000 }
      ]
    });

    assert.strictEqual(venda.pagamentos?.length, 1);
    assert.strictEqual(venda.pagamentos[0].metodo, 'PIX');
  });

  it('Pagamento com 2 formas', () => {
    const venda = vendaService.finalizarVenda({
      subtotal: 100,
      desconto: 0,
      total: 100,
      sessaoCaixaId: sessaoId,
      itens: [{ produtoId: '1', quantidade: 1, valorUnitario: 100, total: 100 }],
      pagamentos: [
        { metodo: 'PIX', valorCentavos: 6000 },
        { metodo: 'CASH', valorCentavos: 4000, valorRecebidoCentavos: 5000 }
      ]
    });

    assert.strictEqual(venda.pagamentos?.length, 2);
    const cash = venda.pagamentos.find(p => p.metodo === 'CASH')!;
    assert.strictEqual(cash.trocoCentavos, 1000);
    assert.strictEqual(cash.valorRecebidoCentavos, 5000);
  });

  it('Pagamento com 3 formas', () => {
    const venda = vendaService.finalizarVenda({
      subtotal: 100,
      desconto: 0,
      total: 100,
      sessaoCaixaId: sessaoId,
      itens: [{ produtoId: '1', quantidade: 1, valorUnitario: 100, total: 100 }],
      pagamentos: [
        { metodo: 'PIX', valorCentavos: 3000 },
        { metodo: 'DEBIT_CARD', valorCentavos: 3000 },
        { metodo: 'CASH', valorCentavos: 4000, valorRecebidoCentavos: 4000 }
      ]
    });

    assert.strictEqual(venda.pagamentos?.length, 3);
  });

  it('Pagamento com 4 formas', () => {
    const venda = vendaService.finalizarVenda({
      subtotal: 100,
      desconto: 0,
      total: 100,
      sessaoCaixaId: sessaoId,
      itens: [{ produtoId: '1', quantidade: 1, valorUnitario: 100, total: 100 }],
      pagamentos: [
        { metodo: 'PIX', valorCentavos: 2500 },
        { metodo: 'DEBIT_CARD', valorCentavos: 2500 },
        { metodo: 'CREDIT_CARD', valorCentavos: 2500 },
        { metodo: 'CASH', valorCentavos: 2500, valorRecebidoCentavos: 2500 }
      ]
    });

    assert.strictEqual(venda.pagamentos?.length, 4);
  });

  it('Bloqueio de soma menor', () => {
    assert.throws(() => {
      vendaService.finalizarVenda({
        subtotal: 100,
        desconto: 0,
        total: 100,
        sessaoCaixaId: sessaoId,
        itens: [{ produtoId: '1', quantidade: 1, valorUnitario: 100, total: 100 }],
        pagamentos: [
          { metodo: 'PIX', valorCentavos: 9000 }
        ]
      });
    }, /diverge do total/);
  });

  it('Bloqueio de soma maior', () => {
    assert.throws(() => {
      vendaService.finalizarVenda({
        subtotal: 100,
        desconto: 0,
        total: 100,
        sessaoCaixaId: sessaoId,
        itens: [{ produtoId: '1', quantidade: 1, valorUnitario: 100, total: 100 }],
        pagamentos: [
          { metodo: 'PIX', valorCentavos: 11000 }
        ]
      });
    }, /diverge do total/);
  });

  it('Bloqueio de método duplicado', () => {
    assert.throws(() => {
      vendaService.finalizarVenda({
        subtotal: 100,
        desconto: 0,
        total: 100,
        sessaoCaixaId: sessaoId,
        itens: [{ produtoId: '1', quantidade: 1, valorUnitario: 100, total: 100 }],
        pagamentos: [
          { metodo: 'PIX', valorCentavos: 5000 },
          { metodo: 'PIX', valorCentavos: 5000 }
        ]
      });
    }, /duplicado/);
  });

  it('Bloqueio de CASH recebido menor', () => {
    assert.throws(() => {
      vendaService.finalizarVenda({
        subtotal: 100,
        desconto: 0,
        total: 100,
        sessaoCaixaId: sessaoId,
        itens: [{ produtoId: '1', quantidade: 1, valorUnitario: 100, total: 100 }],
        pagamentos: [
          { metodo: 'CASH', valorCentavos: 10000, valorRecebidoCentavos: 9000 }
        ]
      });
    }, /menor que o valor aplicado/);
  });

  it('Cancelamento de venda mista com ajuste correto no caixa', () => {
    const venda = vendaService.finalizarVenda({
      subtotal: 100,
      desconto: 0,
      total: 100,
      sessaoCaixaId: sessaoId,
      itens: [{ produtoId: '1', quantidade: 2, valorUnitario: 50, total: 100 }], // estoque original = 100
      pagamentos: [
        { metodo: 'CASH', valorCentavos: 4000, valorRecebidoCentavos: 4000 },
        { metodo: 'PIX', valorCentavos: 6000 }
      ]
    });

    const caixaPre = caixaService.getCaixaAtual();
    assert.strictEqual(caixaPre?.entradasVendasCash, 4000);
    assert.strictEqual(caixaPre?.expectedAmountCents, 14000); // 10000 initial + 4000

    // Cancela
    vendaService.cancelarVenda(venda.id, 'Motivo de teste', 'Op1', 'Obs');

    const caixaPost = caixaService.getCaixaAtual();
    assert.strictEqual(caixaPost?.entradasVendasCash, 0);
    assert.strictEqual(caixaPost?.expectedAmountCents, 10000); // Back to initial

    const p = db.produtos.find(prod => prod.id === '1');
    assert.strictEqual(p?.estGeral, 100);
  });
});

describe('VendaService Tests - Parcelamento Crédito', () => {
  let vendaService: VendaService;
  let caixaService: CaixaService;
  let sessaoId = '';

  beforeEach(() => {
    db.sessoesCaixa = [];
    db.vendas = [];
    db.movimentacoesCaixa = [];
    (db as any).cancelamentos = [];
    
    // reset configuracao
    db.configuracaoPagamento = { maxCreditInstallments: 12 };

    if (!db.produtos.find(p => p.id === '1')) {
       db.produtos.push({ id: '1', codigo: '001', nome: 'Teste', barra: '123', valor: 10, custo: 5, estGeral: 100 });
    } else {
       db.produtos.find(p => p.id === '1')!.estGeral = 100;
    }

    caixaService = new CaixaService();
    vendaService = new VendaService();

    const sessao = caixaService.abrirCaixa({ terminal: 'T1', openedBy: 'Op1', openingAmountCents: 10000 });
    sessaoId = sessao.id;
  });

  it('Pagamento de crédito em 1x', () => {
    const venda = vendaService.finalizarVenda({
      subtotal: 100,
      desconto: 0,
      total: 100,
      sessaoCaixaId: sessaoId,
      itens: [{ produtoId: '1', quantidade: 1, valorUnitario: 100, total: 100 }],
      pagamentos: [
        { metodo: 'CREDIT_CARD', valorCentavos: 10000, installments: 1 }
      ]
    });
    assert.strictEqual(venda.pagamentos?.[0].installments, 1);
  });

  it('Pagamento de crédito em 3x', () => {
    const venda = vendaService.finalizarVenda({
      subtotal: 100,
      desconto: 0,
      total: 100,
      sessaoCaixaId: sessaoId,
      itens: [{ produtoId: '1', quantidade: 1, valorUnitario: 100, total: 100 }],
      pagamentos: [
        { metodo: 'CREDIT_CARD', valorCentavos: 10000, installments: 3 }
      ]
    });
    assert.strictEqual(venda.pagamentos?.[0].installments, 3);
  });

  it('Bloqueia PIX parcelado', () => {
    assert.throws(() => {
      vendaService.finalizarVenda({
        subtotal: 100,
        desconto: 0,
        total: 100,
        sessaoCaixaId: sessaoId,
        itens: [{ produtoId: '1', quantidade: 1, valorUnitario: 100, total: 100 }],
        pagamentos: [
          { metodo: 'PIX', valorCentavos: 10000, installments: 3 }
        ]
      });
    }, /Parcelamento não permitido/);
  });

  it('Bloqueia Débito parcelado', () => {
    assert.throws(() => {
      vendaService.finalizarVenda({
        subtotal: 100,
        desconto: 0,
        total: 100,
        sessaoCaixaId: sessaoId,
        itens: [{ produtoId: '1', quantidade: 1, valorUnitario: 100, total: 100 }],
        pagamentos: [
          { metodo: 'DEBIT_CARD', valorCentavos: 10000, installments: 2 }
        ]
      });
    }, /Parcelamento não permitido/);
  });

  it('Bloqueia parcelas acima do limite configurado', () => {
    db.configuracaoPagamento.maxCreditInstallments = 6;
    assert.throws(() => {
      vendaService.finalizarVenda({
        subtotal: 100,
        desconto: 0,
        total: 100,
        sessaoCaixaId: sessaoId,
        itens: [{ produtoId: '1', quantidade: 1, valorUnitario: 100, total: 100 }],
        pagamentos: [
          { metodo: 'CREDIT_CARD', valorCentavos: 10000, installments: 7 }
        ]
      });
    }, /Número de parcelas no crédito deve ser entre/);
  });
});
