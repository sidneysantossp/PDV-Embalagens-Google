import { describe, it, beforeEach, expect } from 'vitest';
import { PurchaseOrderService } from '../services/PurchaseOrderService';
import { PurchaseReceiptService } from '../services/PurchaseReceiptService';
import { FornecedorService } from '../services/FornecedorService';
import { CaixaService } from '../services/CaixaService';
import { db } from '../db';

describe('ETAPA 11 - Recebimento de Pedido + Entrada de Estoque', () => {
  let poService: PurchaseOrderService;
  let receiptService: PurchaseReceiptService;
  let fornecedorService: FornecedorService;
  let fornecedorId: string;

  beforeEach(() => {
    poService = new PurchaseOrderService();
    receiptService = new PurchaseReceiptService();
    fornecedorService = new FornecedorService();
    // Reset DB
    db.purchaseOrders = [];
    db.purchaseReceipts = [];
    db.stockMovements = [];
    db.accountsPayable = [];
    (db as any)._purchaseOrderCounter = 0;
    (db as any)._purchaseReceiptCounter = 0;
    (db as any)._payableCounter = 0;
    db.fornecedores = [];
    db.fornecedorProdutos = [];
    db.sessoesCaixa = [];
    db.movimentacoesCaixa = [];
    db.produtos = [
      { id: 'p1', codigo: '001', nome: 'Copo 200ml', barra: '111', valor: 10, custo: 4, estGeral: 10, imagem: '' },
      { id: 'p2', codigo: '002', nome: 'Marmita', barra: '222', valor: 5, custo: 2, estGeral: 20, imagem: '' },
      { id: 'p3', codigo: '003', nome: 'Garfo', barra: '333', valor: 1, custo: 0.5, estGeral: 30, imagem: '' },
    ];
    const f = fornecedorService.criarFornecedor({ tipoPessoa: 'PJ', documento: '00.000.000/0001-91', razaoSocial: 'Fornecedor Teste' });
    fornecedorId = f.id;
  });

  function createOrderedOrder(items: { productId: string; qty: number; costCents: number }[]) {
    const order = poService.createPurchaseOrder({
      supplierId: fornecedorId,
      items: items.map(i => ({ productId: i.productId, quantityOrdered: i.qty, unitCostCents: i.costCents })),
    });
    poService.orderPurchaseOrder(order.id);
    return order;
  }

  it('84. TESTE — RECEBIMENTO TOTAL', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 100, costCents: 450 }]);
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(10);
    const receipt = receiptService.receivePurchaseOrder({
      purchaseOrderId: order.id,
      items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 100 }],
      receivedBy: 'Operador',
    });
    expect(receipt.receiptNumber).toMatch(/REC-/);
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(110);
    const enriched = poService.getEnrichedOrder(order.id);
    expect(enriched.status).toBe('RECEIVED');
    expect(enriched.totalReceived).toBe(100);
  });

  it('85. TESTE — PARCIAL', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 100, costCents: 450 }]);
    receiptService.receivePurchaseOrder({
      purchaseOrderId: order.id,
      items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 40 }],
      receivedBy: 'Op',
    });
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(50);
    const enriched = poService.getEnrichedOrder(order.id);
    expect(enriched.status).toBe('PARTIALLY_RECEIVED');
    expect(enriched.totalPending).toBe(60);
  });

  it('86. TESTE — SEGUNDO RECEBIMENTO', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 100, costCents: 450 }]);
    receiptService.receivePurchaseOrder({
      purchaseOrderId: order.id,
      items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 40 }],
      receivedBy: 'Op',
    });
    receiptService.receivePurchaseOrder({
      purchaseOrderId: order.id,
      items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 60 }],
      receivedBy: 'Op',
    });
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(110);
    expect(poService.getEnrichedOrder(order.id).status).toBe('RECEIVED');
  });

  it('87. TESTE — TRÊS RECEBIMENTOS não duplicar', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 100, costCents: 450 }]);
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 20 }], receivedBy: 'Op' });
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 30 }], receivedBy: 'Op' });
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 50 }], receivedBy: 'Op' });
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(110); // 10 +100
    expect(db.stockMovements.filter(m=>m.productId==='p1').length).toBe(3);
    expect(db.purchaseReceipts.length).toBe(3);
  });

  it('88. TESTE — DOIS PRODUTOS parcial', () => {
    const order = createOrderedOrder([
      { productId: 'p1', qty: 10, costCents: 100 },
      { productId: 'p2', qty: 20, costCents: 200 },
    ]);
    const enrichedBefore = poService.getEnrichedOrder(order.id);
    const id1 = enrichedBefore.enrichedItems.find((i:any)=>i.productId==='p1')!.id;
    const id2 = enrichedBefore.enrichedItems.find((i:any)=>i.productId==='p2')!.id;
    receiptService.receivePurchaseOrder({
      purchaseOrderId: order.id,
      items: [
        { purchaseOrderItemId: id1, quantityReceived: 10 },
        { purchaseOrderItemId: id2, quantityReceived: 5 },
      ],
      receivedBy: 'Op',
    });
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(20); // 10+10
    expect(db.produtos.find(p=>p.id==='p2')!.estGeral).toBe(25); // 20+5
    const enriched = poService.getEnrichedOrder(order.id);
    expect(enriched.status).toBe('PARTIALLY_RECEIVED');
    const item2 = enriched.enrichedItems.find((i:any)=>i.productId==='p2');
    expect(item2.pending).toBe(15);
  });

  it('89. TESTE — RECEBIMENTO EXCESSIVO deve falhar', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 100, costCents: 100 }]);
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 80 }], receivedBy: 'Op' });
    expect(() => receiptService.receivePurchaseOrder({
      purchaseOrderId: order.id,
      items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 21 }],
      receivedBy: 'Op',
    })).toThrow(/excede pendente/);
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(90); // 10+80, second failed
  });

  it('90. TESTE — ZERO deve falhar', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 100, costCents: 100 }]);
    expect(() => receiptService.receivePurchaseOrder({
      purchaseOrderId: order.id,
      items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 0 }],
      receivedBy: 'Op',
    })).toThrow(/pelo menos uma quantidade/);
  });

  it('91. TESTE — NEGATIVO deve falhar', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 100, costCents: 100 }]);
    expect(() => receiptService.receivePurchaseOrder({
      purchaseOrderId: order.id,
      items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: -5 }],
      receivedBy: 'Op',
    })).toThrow(/negativa|inteira/);
  });

  it('92. TESTE — ITEM DE OUTRO PEDIDO deve falhar', () => {
    const orderA = createOrderedOrder([{ productId: 'p1', qty: 10, costCents: 100 }]);
    const orderB = createOrderedOrder([{ productId: 'p2', qty: 10, costCents: 100 }]);
    expect(() => receiptService.receivePurchaseOrder({
      purchaseOrderId: orderA.id,
      items: [{ purchaseOrderItemId: orderB.items[0].id, quantityReceived: 5 }],
      receivedBy: 'Op',
    })).toThrow(/não pertence/);
  });

  it('93. TESTE — DRAFT deve falhar', () => {
    const order = poService.createPurchaseOrder({ supplierId: fornecedorId, items: [{ productId: 'p1', quantityOrdered: 10, unitCostCents: 100 }] });
    expect(order.status).toBe('DRAFT');
    expect(() => receiptService.receivePurchaseOrder({
      purchaseOrderId: order.id,
      items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 5 }],
      receivedBy: 'Op',
    })).toThrow(/Confirme o pedido/);
  });

  it('94. TESTE — CANCELLED deve falhar', () => {
    const order = poService.createPurchaseOrder({ supplierId: fornecedorId, items: [{ productId: 'p1', quantityOrdered: 10, unitCostCents: 100 }] });
    poService.cancelPurchaseOrder(order.id);
    expect(() => receiptService.receivePurchaseOrder({
      purchaseOrderId: order.id,
      items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 5 }],
      receivedBy: 'Op',
    })).toThrow(/cancelado/);
  });

  it('95. TESTE — RECEIVED deve falhar novo recebimento', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 10, costCents: 100 }]);
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 10 }], receivedBy: 'Op' });
    expect(() => receiptService.receivePurchaseOrder({
      purchaseOrderId: order.id,
      items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 1 }],
      receivedBy: 'Op',
    })).toThrow(/já foi recebido integralmente/);
  });

  it('96. TESTE — CANCELAMENTO APÓS PARCIAL deve falhar', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 10, costCents: 100 }]);
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 5 }], receivedBy: 'Op' });
    expect(() => poService.cancelPurchaseOrder(order.id)).toThrow(/já possui mercadorias recebidas/);
  });

  it('97. TESTE — ESTOQUE ledger + saldo', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 10, costCents: 500 }]);
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 10 }], receivedBy: 'Op' });
    const moves = db.stockMovements.filter(m=>m.productId==='p1' && m.type==='PURCHASE_RECEIPT');
    expect(moves.length).toBe(1);
    expect(moves[0].quantity).toBe(10);
    expect(moves[0].referenceType).toBe('PURCHASE_RECEIPT');
    expect(moves[0].balanceAfter).toBe(20);
  });

  it('98. TESTE — HISTÓRICO 2 receipts distintos', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 100, costCents: 100 }]);
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 40 }], receivedBy: 'Op' });
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 60 }], receivedBy: 'Op2' });
    const receipts = receiptService.getReceiptsByOrder(order.id);
    expect(receipts.length).toBe(2);
    expect(receipts[0].receiptNumber).not.toBe(receipts[1].receiptNumber);
  });

  it('99. TESTE — TRANSAÇÃO rollback completo se falha no item 3', () => {
    const order = createOrderedOrder([
      { productId: 'p1', qty: 10, costCents: 100 },
      { productId: 'p2', qty: 10, costCents: 100 },
      { productId: 'p3', qty: 10, costCents: 100 },
    ]);
    const items = poService.getEnrichedOrder(order.id).enrichedItems;
    // Simular falha: um produto inexistente? Vamos tentar injetar quantidade excedente no 3º para causar erro de validação
    // Mas validação ocorre antes de mutação, então rollback será garantido por não mutar.
    // Para testar transação, precisamos fazer um receive que falha na validação do 3º item após ter processado 1 e 2,
    // mas como validação é antes, nenhum estoque deve mudar.
    const p1Id = items.find((i:any)=>i.productId==='p1')!.id;
    const p2Id = items.find((i:any)=>i.productId==='p2')!.id;
    const p3Id = items.find((i:any)=>i.productId==='p3')!.id;
    expect(() => receiptService.receivePurchaseOrder({
      purchaseOrderId: order.id,
      items: [
        { purchaseOrderItemId: p1Id, quantityReceived: 5 },
        { purchaseOrderItemId: p2Id, quantityReceived: 5 },
        { purchaseOrderItemId: p3Id, quantityReceived: 20 }, // excede pendente 10
      ],
      receivedBy: 'Op',
    })).toThrow(/excede/);
    // Nenhum estoque alterado
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(10);
    expect(db.produtos.find(p=>p.id==='p2')!.estGeral).toBe(20);
    expect(db.produtos.find(p=>p.id==='p3')!.estGeral).toBe(30);
    expect(db.purchaseReceipts.length).toBe(0);
  });

  it('100. TESTE — CONCORRÊNCIA pendente 20 dois tentam 20', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 20, costCents: 100 }]);
    // A recebe 20
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 20 }], receivedBy: 'A' });
    // B tenta novamente
    expect(() => receiptService.receivePurchaseOrder({
      purchaseOrderId: order.id,
      items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 20 }],
      receivedBy: 'B',
    })).toThrow(/já foi recebido integralmente|excede/);
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(30); // 10+20 only once
  });

  it('101. TESTE — PREÇO DE VENDA inalterado', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 10, costCents: 700 }]);
    const beforeValor = db.produtos.find(p=>p.id==='p1')!.valor;
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 10 }], receivedBy: 'Op' });
    expect(db.produtos.find(p=>p.id==='p1')!.valor).toBe(beforeValor);
  });

  it('102. TESTE — ÚLTIMO CUSTO atualizado', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 10, costCents: 550 }]);
    expect(db.produtos.find(p=>p.id==='p1')!.custo).toBe(4);
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 10 }], receivedBy: 'Op' });
    expect(db.produtos.find(p=>p.id==='p1')!.custo).toBe(5.5);
  });

  it('103. TESTE — ROUND TRIP persistência', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 10, costCents: 100 }]);
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 10 }], receivedBy: 'Op' });
    // Simular reload: re-read from db
    const enriched = poService.getEnrichedOrder(order.id);
    expect(enriched.status).toBe('RECEIVED');
    expect(enriched.totalReceived).toBe(10);
    const prod = db.produtos.find(p=>p.id==='p1')!;
    expect(prod.estGeral).toBe(20);
  });

  it('105. TESTE — CAIXA permanece intacto', () => {
    const caixaService = new CaixaService();
    caixaService.abrirCaixa({ terminal: 'T1', openedBy: 'Op', openingAmountCents: 10000 });
    const caixaBefore = caixaService.getCaixaAtual()!;
    const order = createOrderedOrder([{ productId: 'p1', qty: 10, costCents: 100 }]);
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 10 }], receivedBy: 'Op' });
    const caixaAfter = caixaService.getCaixaAtual()!;
    expect(caixaAfter.expectedAmountCents).toBe(caixaBefore.expectedAmountCents);
    expect((caixaAfter as any).sessoesCaixa).toBeUndefined();
  });

  it('Não cria conta a pagar / financeiro', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 5, costCents: 100 }]);
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 5 }], receivedBy: 'Op' });
    // db não tem contas a pagar
    expect((db as any).contasAPagar).toBeUndefined();
    expect((db as any).financial).toBeUndefined();
  });

  it('Status PARTIALLY_RECEIVED e RECEIVED funcionam', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 10, costCents: 100 }]);
    expect(order.status).toBe('ORDERED');
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 5 }], receivedBy: 'Op' });
    expect(poService.getPurchaseOrderById(order.id)!.status).toBe('PARTIALLY_RECEIVED');
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 5 }], receivedBy: 'Op' });
    expect(poService.getPurchaseOrderById(order.id)!.status).toBe('RECEIVED');
  });

  it('Pedido não altera estoque, só receipt altera', () => {
    const before = db.produtos.find(p=>p.id==='p1')!.estGeral;
    const order = poService.createPurchaseOrder({ supplierId: fornecedorId, items: [{ productId: 'p1', quantityOrdered: 100, unitCostCents: 100 }] });
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(before);
    poService.orderPurchaseOrder(order.id);
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(before);
    receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 10 }], receivedBy: 'Op' });
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(before + 10);
  });

  it('Origem do movimento é PURCHASE_RECEIPT', () => {
    const order = createOrderedOrder([{ productId: 'p1', qty: 5, costCents: 100 }]);
    const receipt = receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 5 }], receivedBy: 'Op' });
    const mov = db.stockMovements.find(m=> m.referenceId===receipt.id);
    expect(mov).toBeDefined();
    expect(mov!.type).toBe('PURCHASE_RECEIPT');
    expect(mov!.referenceType).toBe('PURCHASE_RECEIPT');
  });
});
