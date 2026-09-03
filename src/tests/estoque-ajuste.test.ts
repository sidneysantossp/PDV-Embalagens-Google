import { describe, it, beforeEach, expect } from 'vitest';
import { StockService } from '../services/StockService';
import { CaixaService } from '../services/CaixaService';
import { VendaService } from '../services/VendaService';
import { db } from '../db';

describe('ETAPA 19 - Ajuste de Estoque e Inventário',()=>{
  let stockService: StockService;
  let caixaService: CaixaService;

  beforeEach(()=>{
    stockService=new StockService();
    caixaService=new CaixaService();
    db.produtos=[
      { id: 'p1', codigo: '001', nome: 'Copo 200ml', barra: '111', valor: 10, custo: 4, estGeral: 10, imagem: '' },
      { id: 'p2', codigo: '002', nome: 'Marmita', barra: '222', valor: 20, custo: 8, estGeral: 5, imagem: '' },
    ];
    db.stockMovements=[];
    db.configuracaoEstoque={ allowNegativeStock: false };
    db.sessoesCaixa=[];
    db.movimentacoesCaixa=[];
    db.vendas=[];
    db.accountsPayable=[];
    db.accountReceivables=[];
    // Reset caixa
    caixaService.abrirCaixa({terminal:'T1', openedBy:'Op', openingAmountCents:10000});
  });

  it('71. ENTRADA MANUAL',()=>{
    const mov=stockService.adjustStock({ productId:'p1', direction:'INCREASE', quantity:5, reason:'FOUND_SURPLUS', operator:'Op' });
    expect(mov.quantity).toBe(5);
    expect(mov.type).toBe('MANUAL_ADJUSTMENT');
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(15);
  });

  it('72. SAÍDA MANUAL',()=>{
    const mov=stockService.adjustStock({ productId:'p1', direction:'DECREASE', quantity:3, reason:'BREAKAGE', operator:'Op' });
    expect(mov.quantity).toBe(-3);
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(7);
  });

  it('73. QUANTIDADE ZERO',()=>{
    expect(()=> stockService.adjustStock({ productId:'p1', direction:'INCREASE', quantity:0, reason:'FOUND_SURPLUS' })).toThrow(/maior que zero/);
  });

  it('74. QUANTIDADE NEGATIVA',()=>{
    expect(()=> stockService.adjustStock({ productId:'p1', direction:'INCREASE', quantity:-5, reason:'FOUND_SURPLUS' })).toThrow(/maior que zero/);
  });

  it('75. MOTIVO AUSENTE',()=>{
    expect(()=> stockService.adjustStock({ productId:'p1', direction:'INCREASE', quantity:5, reason: '' as any })).toThrow(/Motivo/);
  });

  it('76. OTHER SEM DESCRIÇÃO',()=>{
    expect(()=> stockService.adjustStock({ productId:'p1', direction:'INCREASE', quantity:5, reason:'OTHER' })).toThrow(/Outro/);
    // com notes deve passar
    const mov=stockService.adjustStock({ productId:'p1', direction:'INCREASE', quantity:5, reason:'OTHER', notes:'Ajuste especial', operator:'Op' });
    expect(mov.reason).toBe('OTHER');
  });

  it('77. ESTOQUE NEGATIVO BLOQUEADO',()=>{
    // saldo 10, tentar saída 13 com allowNegative false
    expect(()=> stockService.adjustStock({ productId:'p1', direction:'DECREASE', quantity:13, reason:'LOSS' })).toThrow(/Estoque insuficiente/);
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(10);
    expect(db.stockMovements.length).toBe(0);
  });

  it('78. ESTOQUE NEGATIVO PERMITIDO',()=>{
    db.configuracaoEstoque.allowNegativeStock=true;
    const mov=stockService.adjustStock({ productId:'p2', direction:'DECREASE', quantity:7, reason:'LOSS' });
    expect(db.produtos.find(p=>p.id==='p2')!.estGeral).toBe(-2);
    expect(mov.balanceAfter).toBe(-2);
  });

  it('79. INVENTÁRIO MENOR',()=>{
    // saldo 10, contagem 5 => -5
    const result=stockService.reconcileInventory({ productId:'p1', countedQuantity:5, operator:'Op' });
    expect(result.difference).toBe(-5);
    expect(result.movement!.quantity).toBe(-5);
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(5);
    expect(result.movement!.type).toBe('INVENTORY_ADJUSTMENT');
  });

  it('80. INVENTÁRIO MAIOR',()=>{
    const result=stockService.reconcileInventory({ productId:'p1', countedQuantity:14, operator:'Op' });
    expect(result.difference).toBe(4);
    expect(result.movement!.quantity).toBe(4);
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(14);
  });

  it('81. INVENTÁRIO IGUAL',()=>{
    const result=stockService.reconcileInventory({ productId:'p1', countedQuantity:10, operator:'Op' });
    expect(result.difference).toBe(0);
    expect(result.movement).toBeNull();
    expect(db.stockMovements.length).toBe(0);
    expect(result.message).toMatch(/já confere/);
  });

  it('82. CONTAGEM NEGATIVA',()=>{
    expect(()=> stockService.reconcileInventory({ productId:'p1', countedQuantity:-1 })).toThrow(/maior ou igual a zero/);
  });

  it('83. CONCORRÊNCIA DO AJUSTE',()=>{
    db.configuracaoEstoque.allowNegativeStock=false;
    // saldo 10, dois ajustes de saída 8 cada, apenas um deve passar
    const mov1=stockService.adjustStock({ productId:'p1', direction:'DECREASE', quantity:8, reason:'LOSS' });
    expect(mov1.balanceAfter).toBe(2);
    expect(()=> stockService.adjustStock({ productId:'p1', direction:'DECREASE', quantity:8, reason:'LOSS' })).toThrow(/Estoque insuficiente/);
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(2);
  });

  it('84. CONCORRÊNCIA DO INVENTÁRIO',()=>{
    // saldo inicial 10
    // venda reduz para 8 antes de confirmar inventário
    const vendaService=new VendaService();
    // criar venda de 2 unidades (precisa caixa)
    const sessao=db.sessoesCaixa[0];
    vendaService.finalizarVenda({
      subtotal:20, desconto:0, total:20,
      itens:[{produtoId:'p1', quantidade:2, valorUnitario:10, total:20}],
      pagamentos:[{metodo:'PIX', valorCentavos:2000}],
      sessaoCaixaId: sessao.id
    });
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(8);
    // agora inventário com contagem 7 (baseado no saldo original 10, mas current é 8, então difference -1)
    const result=stockService.reconcileInventory({ productId:'p1', countedQuantity:7 });
    expect(result.difference).toBe(-1);
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(7);
  });

  it('85. LEDGER',()=>{
    const mov=stockService.adjustStock({ productId:'p1', direction:'DECREASE', quantity:5, reason:'BREAKAGE', notes:'Caixa molhada', operator:'OpTeste' });
    expect(mov.productId).toBe('p1');
    expect(mov.quantity).toBe(-5);
    expect(mov.type).toBe('MANUAL_ADJUSTMENT');
    expect(mov.reason).toBe('BREAKAGE');
    expect(mov.operator).toBe('OpTeste');
    expect(mov.notes).toBe('Caixa molhada');
    expect(mov.balanceAfter).toBe(5);
    expect(mov.balanceBefore).toBe(10);
  });

  it('86. PREÇO inalterado',()=>{
    const beforeValor=db.produtos.find(p=>p.id==='p1')!.valor;
    stockService.adjustStock({ productId:'p1', direction:'DECREASE', quantity:5, reason:'LOSS' });
    expect(db.produtos.find(p=>p.id==='p1')!.valor).toBe(beforeValor);
  });

  it('87. CUSTO inalterado',()=>{
    const beforeCusto=db.produtos.find(p=>p.id==='p1')!.custo;
    stockService.adjustStock({ productId:'p1', direction:'INCREASE', quantity:5, reason:'FOUND_SURPLUS' });
    expect(db.produtos.find(p=>p.id==='p1')!.custo).toBe(beforeCusto);
  });

  it('88. FINANCEIRO inalterado',()=>{
    const caixaBefore=caixaService.getCaixaAtual()!.expectedAmountCents;
    stockService.adjustStock({ productId:'p1', direction:'DECREASE', quantity:5, reason:'LOSS' });
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(caixaBefore);
    expect(db.accountsPayable.length).toBe(0);
    expect(db.accountReceivables.length).toBe(0);
  });

  it('91. ROUND TRIP',()=>{
    stockService.adjustStock({ productId:'p1', direction:'INCREASE', quantity:5, reason:'FOUND_SURPLUS' });
    const prod=db.produtos.find(p=>p.id==='p1')!;
    expect(prod.estGeral).toBe(15);
    const mov=db.stockMovements[0];
    expect(mov.quantity).toBe(5);
    // Simular reload: buscar do db
    const reloadedProd=db.produtos.find(p=>p.id==='p1')!;
    const reloadedMov=db.stockMovements.find(m=>m.id===mov.id);
    expect(reloadedProd.estGeral).toBe(15);
    expect(reloadedMov).toBeDefined();
  });

  it('Histórico exibe ajustes',()=>{
    stockService.adjustStock({ productId:'p1', direction:'DECREASE', quantity:2, reason:'BREAKAGE' });
    stockService.adjustStock({ productId:'p1', direction:'INCREASE', quantity:1, reason:'FOUND_SURPLUS' });
    const movs=stockService.listMovements('p1');
    expect(movs.length).toBe(2);
    expect(movs[0].type).toBe('MANUAL_ADJUSTMENT');
  });

  it('Origem do movimento identificável',()=>{
    const mov1=stockService.adjustStock({ productId:'p1', direction:'DECREASE', quantity:1, reason:'BREAKAGE' });
    expect(mov1.referenceType).toBe('MANUAL_ADJUSTMENT');
    const inv=stockService.reconcileInventory({ productId:'p1', countedQuantity: 20 });
    expect(inv.movement!.referenceType).toBe('INVENTORY_ADJUSTMENT');
    expect(inv.movement!.type).toBe('INVENTORY_ADJUSTMENT');
  });
});
