import { describe, it, beforeEach, expect } from 'vitest';
import { PurchaseOrderService } from '../services/PurchaseOrderService';
import { PurchaseReceiptService } from '../services/PurchaseReceiptService';
import { AccountPayableService, getPayableDerivedSituation } from '../services/AccountPayableService';
import { FornecedorService } from '../services/FornecedorService';
import { CaixaService } from '../services/CaixaService';
import { db } from '../db';

function toISODate(d: Date) { return d.toISOString().slice(0,10); }
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate()+days);
  return toISODate(d);
}

describe('ETAPA 12 - Contas a Pagar', () => {
  let poService: PurchaseOrderService;
  let receiptService: PurchaseReceiptService;
  let payableService: AccountPayableService;
  let fornecedorService: FornecedorService;
  let fornecedorId: string;

  beforeEach(() => {
    poService = new PurchaseOrderService();
    receiptService = new PurchaseReceiptService();
    payableService = new AccountPayableService();
    fornecedorService = new FornecedorService();
    db.purchaseOrders = [];
    db.purchaseReceipts = [];
    db.stockMovements = [];
    db.accountsPayable = [];
    (db as any)._purchaseOrderCounter = 0;
    (db as any)._purchaseReceiptCounter = 0;
    (db as any)._payableCounter = 0;
    db.fornecedores = [];
    db.fornecedorProdutos = [];
    db.produtos = [
      { id: 'p1', codigo: '001', nome: 'Copo 200ml', barra: '111', valor: 10, custo: 4, estGeral: 100, imagem: '' },
      { id: 'p2', codigo: '002', nome: 'Marmita', barra: '222', valor: 5, custo: 2, estGeral: 200, imagem: '' },
    ];
    db.sessoesCaixa = [];
    db.movimentacoesCaixa = [];
    const f = fornecedorService.criarFornecedor({ tipoPessoa: 'PJ', documento: '00.000.000/0001-91', razaoSocial: 'Fornecedor Teste', prazoPadraoPagamento: 30 });
    fornecedorId = f.id;
  });

  function createReceipt(totalCents = 50000, prazo?: number) {
    // if prazo defined, update fornecedor
    if (prazo !== undefined) {
      const f = db.fornecedores.find(x=>x.id===fornecedorId)!;
      f.prazoPadraoPagamento = prazo;
    }
    const order = poService.createPurchaseOrder({ supplierId: fornecedorId, items: [{ productId: 'p1', quantityOrdered: 10, unitCostCents: totalCents/10 }] });
    poService.orderPurchaseOrder(order.id);
    const receipt = receiptService.receivePurchaseOrder({ purchaseOrderId: order.id, items: [{ purchaseOrderItemId: order.items[0].id, quantityReceived: 10 }], receivedBy: 'Op' });
    // receipt.receivedAt is now; but for test 88 we need specific date, we will override receivedAt to fixed date if needed outside
    return { order, receipt };
  }

  it('87. TESTE — GERAR DO RECEBIMENTO', () => {
    const { receipt } = createReceipt(50000);
    const payable = payableService.createFromReceipt({ purchaseReceiptId: receipt.id, createdBy: 'Op' });
    expect(payable.amountCents).toBe(50000);
    expect(payable.supplierId).toBe(fornecedorId);
    expect(payable.purchaseReceiptId).toBe(receipt.id);
    expect(payable.status).toBe('OPEN');
    expect(payable.payableNumber).toMatch(/CP/);
  });

  it('88. TESTE — VENCIMENTO DEFAULT 30 dias', () => {
    const { receipt } = createReceipt(50000, 30);
    // Force receipt date to known date for deterministic test
    const fixedDate = '2026-09-03T10:00:00.000Z';
    receipt.receivedAt = fixedDate;
    // Need to re-create payable after fixing date; clear previous payables
    db.accountsPayable = [];
    (db as any)._payableCounter = 0;
    const payable = payableService.createFromReceipt({ purchaseReceiptId: receipt.id, createdBy: 'Op' });
    expect(payable.dueDate).toBe('2026-10-03');
  });

  it('89. TESTE — PRAZO ZERO mesma data', () => {
    const { receipt } = createReceipt(50000, 0);
    receipt.receivedAt = '2026-09-03T10:00:00.000Z';
    db.accountsPayable = [];
    (db as any)._payableCounter = 0;
    const payable = payableService.createFromReceipt({ purchaseReceiptId: receipt.id, createdBy: 'Op' });
    expect(payable.dueDate).toBe('2026-09-03');
  });

  it('90. TESTE — DUPLICIDADE bloqueada', () => {
    const { receipt } = createReceipt(50000);
    payableService.createFromReceipt({ purchaseReceiptId: receipt.id, createdBy: 'Op' });
    expect(()=> payableService.createFromReceipt({ purchaseReceiptId: receipt.id, createdBy: 'Op' })).toThrow(/Já existe/);
    expect(db.accountsPayable.length).toBe(1);
  });

  it('91. TESTE — CONCORRÊNCIA duplicidade', () => {
    const { receipt } = createReceipt(50000);
    // Simular dois cliques simultâneos - serviço verifica constraint antes de push, mas se ambos passam validação inicial?
    // Nosso serviço verifica novamente antes de push, então segundo deve falhar
    payableService.createFromReceipt({ purchaseReceiptId: receipt.id, createdBy: 'Op1' });
    expect(()=> payableService.createFromReceipt({ purchaseReceiptId: receipt.id, createdBy: 'Op2' })).toThrow(/Já existe/);
    expect(db.accountsPayable.length).toBe(1);
  });

  it('92. TESTE — CONTA MANUAL', () => {
    const payable = payableService.createManual({ supplierId: fornecedorId, description: 'Frete negociado', amountCents: 10000, dueDate: '2026-12-01', createdBy: 'Op' });
    expect(payable.status).toBe('OPEN');
    expect(payable.sourceType).toBe('MANUAL');
    expect(payable.purchaseReceiptId).toBeNull();
  });

  it('93. TESTE — VALOR ZERO falha', () => {
    expect(()=> payableService.createManual({ supplierId: fornecedorId, description: 'Teste', amountCents: 0, dueDate: '2026-12-01', createdBy: 'Op' })).toThrow(/maior que zero/);
  });

  it('94. TESTE — VALOR NEGATIVO falha', () => {
    expect(()=> payableService.createManual({ supplierId: fornecedorId, description: 'Teste', amountCents: -100, dueDate: '2026-12-01', createdBy: 'Op' })).toThrow(/maior que zero/);
  });

  it('95. TESTE — EDIÇÃO OPEN', () => {
    const payable = payableService.createManual({ supplierId: fornecedorId, description: 'Teste', amountCents: 10000, dueDate: '2026-12-01', createdBy: 'Op' });
    const updated = payableService.updateOpenPayable(payable.id, { amountCents: 12000 });
    expect(updated.amountCents).toBe(12000);
    const reloaded = payableService.getById(payable.id)!;
    expect(reloaded.amountCents).toBe(12000);
  });

  it('96. TESTE — CANCELAMENTO', () => {
    const payable = payableService.createManual({ supplierId: fornecedorId, description: 'Teste', amountCents: 10000, dueDate: '2026-12-01', createdBy: 'Op' });
    const cancelled = payableService.cancelPayable(payable.id, { reason: 'Duplicidade', cancelledBy: 'Op' });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancellationReason).toBe('Duplicidade');
    expect(cancelled.cancelledAt).toBeDefined();
    // dados originais preservados
    expect(cancelled.amountCents).toBe(10000);
  });

  it('97. TESTE — CANCELADA FORA DO RESUMO', () => {
    const p1 = payableService.createManual({ supplierId: fornecedorId, description: 'A', amountCents: 50000, dueDate: '2026-12-01', createdBy: 'Op' });
    const p2 = payableService.createManual({ supplierId: fornecedorId, description: 'B', amountCents: 50000, dueDate: '2026-12-01', createdBy: 'Op' });
    payableService.cancelPayable(p1.id, { reason: 'Outro', cancelledBy: 'Op' });
    const summary = payableService.getSummary();
    expect(summary.totalOpenCents).toBe(50000);
    expect(summary.countOpen).toBe(1);
  });

  it('98. TESTE — VENCIDA derivada', () => {
    const yesterday = addDays(toISODate(new Date()), -1);
    const payable = payableService.createManual({ supplierId: fornecedorId, description: 'Vencida', amountCents: 10000, dueDate: yesterday, createdBy: 'Op' });
    expect(payable.status).toBe('OPEN');
    expect(getPayableDerivedSituation(payable)).toBe('OVERDUE');
  });

  it('99. TESTE — VENCE HOJE', () => {
    const today = toISODate(new Date());
    const payable = payableService.createManual({ supplierId: fornecedorId, description: 'Hoje', amountCents: 10000, dueDate: today, createdBy: 'Op' });
    expect(getPayableDerivedSituation(payable)).toBe('DUE_TODAY');
  });

  it('100. TESTE — FUTURA Em aberto', () => {
    const tomorrow = addDays(toISODate(new Date()), 1);
    const payable = payableService.createManual({ supplierId: fornecedorId, description: 'Futura', amountCents: 10000, dueDate: tomorrow, createdBy: 'Op' });
    expect(getPayableDerivedSituation(payable)).toBe('OPEN');
  });

  it('101. TESTE — CAIXA inalterado', () => {
    const caixaService = new CaixaService();
    caixaService.abrirCaixa({ terminal: 'T1', openedBy: 'Op', openingAmountCents: 10000 });
    const before = caixaService.getCaixaAtual()!.expectedAmountCents;
    const { receipt } = createReceipt(100000);
    payableService.createFromReceipt({ purchaseReceiptId: receipt.id, createdBy: 'Op' });
    const after = caixaService.getCaixaAtual()!.expectedAmountCents;
    expect(after).toBe(before);
    // cancelar também não altera
    const payable = db.accountsPayable[0];
    payableService.cancelPayable(payable.id, { reason: 'Outro', cancelledBy: 'Op' });
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(before);
  });

  it('102. TESTE — ESTOQUE inalterado', () => {
    const before = db.produtos.find(p=>p.id==='p1')!.estGeral;
    const { receipt } = createReceipt(10000);
    const afterReceipt = db.produtos.find(p=>p.id==='p1')!.estGeral;
    // receipt já aumentou estoque em 10, payable não deve alterar mais
    expect(afterReceipt).toBe(before + 10);
    payableService.createFromReceipt({ purchaseReceiptId: receipt.id, createdBy: 'Op' });
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(afterReceipt);
  });

  it('103. TESTE — RECEBIMENTO inalterado', () => {
    const { receipt } = createReceipt(10000);
    const beforeTotal = receipt.totalReceivedCents;
    payableService.createFromReceipt({ purchaseReceiptId: receipt.id, amountCents: 5000, createdBy: 'Op', dueDate: '2026-12-01' });
    const after = db.purchaseReceipts.find(r=>r.id===receipt.id)!;
    expect(after.totalReceivedCents).toBe(beforeTotal);
  });

  it('104. TESTE — ROUND TRIP', () => {
    const payable = payableService.createManual({ supplierId: fornecedorId, description: 'Round', amountCents: 12345, dueDate: '2026-12-01', createdBy: 'Op' });
    const reloaded = payableService.getById(payable.id)!;
    expect(reloaded.amountCents).toBe(12345);
    expect(reloaded.dueDate).toBe('2026-12-01');
    expect(reloaded.supplierId).toBe(fornecedorId);
    expect(reloaded.sourceType).toBe('MANUAL');
    expect(reloaded.status).toBe('OPEN');
  });

  it('Busca e filtros funcionam', () => {
    payableService.createManual({ supplierId: fornecedorId, description: 'Aluguel', amountCents: 10000, dueDate: '2026-12-01', createdBy: 'Op' });
    const { receipt } = createReceipt(20000);
    payableService.createFromReceipt({ purchaseReceiptId: receipt.id, description: 'Compra especial REC', createdBy: 'Op', dueDate: '2026-12-02' });
    // busca por descrição
    let res = payableService.search({ q: 'Aluguel' });
    expect(res.length).toBe(1);
    expect(res[0].description).toBe('Aluguel');
    // busca por REC
    res = payableService.search({ q: receipt.receiptNumber });
    expect(res.length).toBe(1);
    // filtro OPEN
    res = payableService.search({ statusFilter: 'OPEN' });
    expect(res.length).toBe(2);
  });

  it('Resumo correto', () => {
    const today = toISODate(new Date());
    const yesterday = addDays(today, -1);
    const tomorrow = addDays(today, 1);
    payableService.createManual({ supplierId: fornecedorId, description: 'Hoje', amountCents: 80000, dueDate: today, createdBy: 'Op' });
    payableService.createManual({ supplierId: fornecedorId, description: 'Vencida', amountCents: 120000, dueDate: yesterday, createdBy: 'Op' });
    payableService.createManual({ supplierId: fornecedorId, description: 'Futura', amountCents: 450000, dueDate: tomorrow, createdBy: 'Op' });
    const summary = payableService.getSummary();
    expect(summary.totalOpenCents).toBe(650000);
    expect(summary.dueTodayCents).toBe(80000);
    expect(summary.overdueCents).toBe(120000);
  });

  it('Edição bloqueada em CANCELLED', () => {
    const p = payableService.createManual({ supplierId: fornecedorId, description: 'Teste', amountCents: 10000, dueDate: '2026-12-01', createdBy: 'Op' });
    payableService.cancelPayable(p.id, { reason: 'Outro', cancelledBy: 'Op' });
    expect(()=> payableService.updateOpenPayable(p.id, { description: 'Novo' })).toThrow(/Apenas contas em aberto|cancelada/);
  });

  it('Não permite trocar fornecedor de conta de recebimento', () => {
    const { receipt } = createReceipt(10000);
    const payable = payableService.createFromReceipt({ purchaseReceiptId: receipt.id, createdBy: 'Op' });
    expect(()=> payableService.updateOpenPayable(payable.id, { supplierId: 'fake-other-id' })).toThrow(/Não é permitido alterar fornecedor/);
  });

  it('Valores em centavos inteiros', () => {
    const payable = payableService.createManual({ supplierId: fornecedorId, description: 'Teste', amountCents: 125090, dueDate: '2026-12-01', createdBy: 'Op' });
    expect(payable.amountCents).toBe(125090);
    expect(Number.isInteger(payable.amountCents)).toBe(true);
  });

  it('Número da conta sequencial CP', () => {
    const p1 = payableService.createManual({ supplierId: fornecedorId, description: 'A', amountCents: 10000, dueDate: '2026-12-01', createdBy: 'Op' });
    const p2 = payableService.createManual({ supplierId: fornecedorId, description: 'B', amountCents: 10000, dueDate: '2026-12-02', createdBy: 'Op' });
    expect(p1.payableNumber).toBe('CP000001');
    expect(p2.payableNumber).toBe('CP000002');
  });
});
