import { db } from '../db.js';
import type { AccountPayable, PayableStatus, AccountPayablePayment, PayablePaymentMethod } from '../types.js';
import { CaixaRepository } from '../repositories/CaixaRepository.js';

function nextPayableNumber(): string {
  db._payableCounter = (db._payableCounter || 0) + 1;
  return `CP${String(db._payableCounter).padStart(6, '0')}`;
}

function toISODate(date: Date): string {
  // Returns YYYY-MM-DD local
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  // dateStr is YYYY-MM-DD or ISO, parse as local
  const base = new Date(dateStr + 'T12:00:00'); // noon to avoid DST
  base.setDate(base.getDate() + days);
  return toISODate(base);
}

function isValidISODate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + 'T12:00:00');
  return !isNaN(d.getTime()) && toISODate(d) === str;
}

function getTodayISO(): string {
  return toISODate(new Date());
}

export function getPayableDerivedSituation(p: AccountPayable, today?: string): 'OPEN' | 'DUE_TODAY' | 'OVERDUE' | 'CANCELLED' | 'PAID' | 'PARTIALLY_PAID' {
  if (p.status === 'CANCELLED') return 'CANCELLED';
  if (p.status === 'PAID') return 'PAID';
  if (p.status === 'PARTIALLY_PAID') {
    // For PARTIALLY_PAID, also consider overdue situation but return PARTIALLY_PAID as base status
    // Caller can check dueDate separately for vencida indicator
    return 'PARTIALLY_PAID';
  }
  const t = today || getTodayISO();
  if (p.dueDate === t) return 'DUE_TODAY';
  if (p.dueDate < t) return 'OVERDUE';
  return 'OPEN';
}

export function isPayablePaymentReversed(paymentId: string): boolean {
  return (db as any).accountPayablePaymentReversals.some((r:any)=> r.accountPayablePaymentId === paymentId);
}
export function getPaidCents(payableId: string): number {
  return db.accountPayablePayments.filter(p => p.accountPayableId === payableId && !isPayablePaymentReversed(p.id)).reduce((s, p) => s + p.amountCents, 0);
}
export function getRemainingCents(payable: AccountPayable): number {
  const paid = getPaidCents(payable.id);
  return payable.amountCents - paid;
}
export function getPaymentsByPayableId(payableId: string): import('../types.js').AccountPayablePayment[] {
  return db.accountPayablePayments.filter(p => p.accountPayableId === payableId).sort((a,b)=> new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
}

export class AccountPayableService {
  getById(id: string): AccountPayable | undefined {
    return db.accountsPayable.find(a => a.id === id);
  }

  getByReceiptId(receiptId: string): AccountPayable | undefined {
    return db.accountsPayable.find(a => a.purchaseReceiptId === receiptId);
  }

  list(): AccountPayable[] {
    return [...db.accountsPayable].sort((a, b) => {
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  search(params: { q?: string; statusFilter?: string; dueFrom?: string; dueTo?: string }): AccountPayable[] {
    let list = this.list();
    const q = (params.q || '').trim().toLowerCase();
    if (q) {
      list = list.filter(p => {
        const supplier = db.fornecedores.find(f => f.id === p.supplierId);
        const doc = (supplier?.documento || p.supplierDocumentSnapshot || '').toLowerCase();
        return (
          p.description.toLowerCase().includes(q) ||
          (p.supplierNameSnapshot || '').toLowerCase().includes(q) ||
          (supplier?.nomeFantasia || supplier?.razaoSocial || supplier?.nome || '').toLowerCase().includes(q) ||
          doc.includes(q) ||
          (p.receiptNumberSnapshot || '').toLowerCase().includes(q) ||
          (p.orderNumberSnapshot || '').toLowerCase().includes(q) ||
          p.payableNumber.toLowerCase().includes(q)
        );
      });
    }
    if (params.statusFilter && params.statusFilter !== 'ALL') {
      const today = getTodayISO();
      list = list.filter(p => {
        switch (params.statusFilter) {
          case 'OPEN': return p.status === 'OPEN';
          case 'PARTIALLY_PAID': return p.status === 'PARTIALLY_PAID';
          case 'CANCELLED': return p.status === 'CANCELLED';
          case 'PAID': return p.status === 'PAID';
          case 'DUE_TODAY': return (p.status === 'OPEN' || p.status === 'PARTIALLY_PAID') && p.dueDate === today;
          case 'OVERDUE': return (p.status === 'OPEN' || p.status === 'PARTIALLY_PAID') && p.dueDate < today;
          case 'FUTURE': return (p.status === 'OPEN' || p.status === 'PARTIALLY_PAID') && p.dueDate > today;
          default: return true;
        }
      });
    }
    if (params.dueFrom) {
      list = list.filter(p => p.dueDate >= params.dueFrom!);
    }
    if (params.dueTo) {
      list = list.filter(p => p.dueDate <= params.dueTo!);
    }
    return list;
  }

  getSummary() {
    const today = getTodayISO();
    // Em aberto considera saldo restante de OPEN e PARTIALLY_PAID
    const openLike = db.accountsPayable.filter(p => p.status === 'OPEN' || p.status === 'PARTIALLY_PAID');
    const totalOpen = openLike.reduce((s, p) => s + getRemainingCents(p), 0);
    const dueToday = openLike.filter(p => p.dueDate === today).reduce((s, p) => s + getRemainingCents(p), 0);
    const overdue = openLike.filter(p => p.dueDate < today).reduce((s, p) => s + getRemainingCents(p), 0);
    const countOpen = openLike.length;
    return { totalOpenCents: totalOpen, dueTodayCents: dueToday, overdueCents: overdue, countOpen };
  }

  createFromReceipt(data: {
    purchaseReceiptId: string;
    description?: string;
    amountCents?: number;
    dueDate?: string; // YYYY-MM-DD
    notes?: string;
    createdBy: string;
  }): AccountPayable {
    const receipt = db.purchaseReceipts.find(r => r.id === data.purchaseReceiptId);
    if (!receipt) throw new Error('Recebimento não encontrado.');

    // Proteção duplicidade
    const existing = db.accountsPayable.find(a => a.purchaseReceiptId === data.purchaseReceiptId);
    if (existing) throw new Error('Já existe uma conta a pagar vinculada a este recebimento.');

    // Carregar fornecedor
    const supplier = db.fornecedores.find(f => f.id === receipt.supplierId);
    if (!supplier) throw new Error('Fornecedor do recebimento não encontrado.');

    const order = db.purchaseOrders.find(o => o.id === receipt.purchaseOrderId);

    // Defaults
    const defaultDescription = data.description?.trim()
      || `Compra — Pedido ${order?.orderNumber || receipt.purchaseOrderId} — Recebimento ${receipt.receiptNumber} — ${supplier.nomeFantasia || supplier.razaoSocial || supplier.nome || supplier.documento}`;

    const amountCents = data.amountCents !== undefined ? data.amountCents : receipt.totalReceivedCents;
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('Valor da conta deve ser inteiro maior que zero.');

    let dueDate = data.dueDate;
    if (!dueDate) {
      // sugerir usando prazo do fornecedor
      const prazo = supplier.prazoPadraoPagamento;
      if (prazo !== undefined && prazo !== null) {
        // receipt.receivedAt is ISO timestamp
        const receiptDate = receipt.receivedAt.slice(0, 10); // YYYY-MM-DD
        dueDate = addDays(receiptDate, prazo);
      } else {
        throw new Error('Data de vencimento é obrigatória.');
      }
    }
    if (!isValidISODate(dueDate)) throw new Error('Data de vencimento inválida. Use YYYY-MM-DD.');

    const description = defaultDescription;
    if (!description || description.trim().length === 0) throw new Error('Descrição é obrigatória.');
    if (description.length > 500) throw new Error('Descrição muito longa.');
    if (data.notes && data.notes.length > 1000) throw new Error('Observação muito longa. Máximo 1000 caracteres.');

    const now = new Date().toISOString();
    const payable: AccountPayable = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 4),
      payableNumber: nextPayableNumber(),
      supplierId: supplier.id,
      supplierNameSnapshot: supplier.nomeFantasia || supplier.razaoSocial || supplier.nome || '',
      supplierDocumentSnapshot: supplier.documento,
      sourceType: 'PURCHASE_RECEIPT',
      sourceId: receipt.id,
      purchaseReceiptId: receipt.id,
      description: description.trim(),
      amountCents,
      dueDate,
      status: 'OPEN',
      notes: data.notes?.trim() || undefined,
      createdBy: data.createdBy || 'Operador',
      createdAt: now,
      updatedAt: now,
      receiptNumberSnapshot: receipt.receiptNumber,
      orderNumberSnapshot: order?.orderNumber,
      orderIdSnapshot: order?.id,
    };

    // Simular constraint unique: verificar novamente antes de push (concorrência)
    if (db.accountsPayable.some(a => a.purchaseReceiptId === data.purchaseReceiptId)) {
      throw new Error('Já existe uma conta a pagar vinculada a este recebimento.');
    }

    db.accountsPayable.push(payable);
    return payable;
  }

  createManual(data: {
    supplierId: string;
    description: string;
    amountCents: number;
    dueDate: string;
    notes?: string;
    createdBy: string;
  }): AccountPayable {
    const supplier = db.fornecedores.find(f => f.id === data.supplierId);
    if (!supplier) throw new Error('Fornecedor não encontrado.');
    if (supplier.status !== 'ACTIVE') {
      // Permitir se for inativo? Spec says manual should allow active only for creation, but histórico permanece.
      // Vamos bloquear criação com inativo para forçar ativo
      throw new Error('Fornecedor inativo não pode ser usado para nova conta.');
    }
    if (!data.description || data.description.trim().length === 0) throw new Error('Descrição é obrigatória.');
    if (data.description.length > 500) throw new Error('Descrição muito longa.');
    if (!Number.isInteger(data.amountCents) || data.amountCents <= 0) throw new Error('Valor da conta deve ser inteiro maior que zero.');
    if (!isValidISODate(data.dueDate)) throw new Error('Data de vencimento inválida. Use YYYY-MM-DD.');
    if (data.notes && data.notes.length > 1000) throw new Error('Observação muito longa. Máximo 1000 caracteres.');

    const now = new Date().toISOString();
    const payable: AccountPayable = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 4),
      payableNumber: nextPayableNumber(),
      supplierId: supplier.id,
      supplierNameSnapshot: supplier.nomeFantasia || supplier.razaoSocial || supplier.nome || '',
      supplierDocumentSnapshot: supplier.documento,
      sourceType: 'MANUAL',
      sourceId: null,
      purchaseReceiptId: null,
      description: data.description.trim(),
      amountCents: data.amountCents,
      dueDate: data.dueDate,
      status: 'OPEN',
      notes: data.notes?.trim() || undefined,
      createdBy: data.createdBy || 'Operador',
      createdAt: now,
      updatedAt: now,
    };
    db.accountsPayable.push(payable);
    return payable;
  }

  updateOpenPayable(id: string, data: { description?: string; amountCents?: number; dueDate?: string; notes?: string; supplierId?: string }): AccountPayable {
    const payable = this.getById(id);
    if (!payable) throw new Error('Conta não encontrada.');
    if (payable.status === 'PAID') throw new Error('Não é possível editar uma conta já paga.');
    if (payable.status === 'CANCELLED') throw new Error('Não é possível editar uma conta cancelada.');
    if (payable.status !== 'OPEN' && payable.status !== 'PARTIALLY_PAID') throw new Error('Apenas contas em aberto podem ser editadas.');

    const paidCents = getPaidCents(payable.id);
    const hasPayments = paidCents > 0;

    if (hasPayments) {
      if (data.amountCents !== undefined && data.amountCents !== payable.amountCents) {
        throw new Error('Não é possível alterar o valor de uma conta que já possui pagamentos.');
      }
      if (data.supplierId && data.supplierId !== payable.supplierId) {
        throw new Error('Não é possível alterar o fornecedor de uma conta que já possui pagamentos.');
      }
      if (data.dueDate !== undefined && data.dueDate !== payable.dueDate) {
        throw new Error('Não é possível alterar o vencimento de uma conta que já possui pagamentos.');
      }
    }

    if (!hasPayments) {
      if (payable.sourceType === 'PURCHASE_RECEIPT') {
        if (data.supplierId && data.supplierId !== payable.supplierId) {
          throw new Error('Não é permitido alterar fornecedor de conta originada de recebimento.');
        }
      } else {
        if (data.supplierId && data.supplierId !== payable.supplierId) {
          const newSupplier = db.fornecedores.find(f => f.id === data.supplierId);
          if (!newSupplier) throw new Error('Fornecedor não encontrado.');
          if (newSupplier.status !== 'ACTIVE') throw new Error('Fornecedor inativo não pode ser usado.');
          payable.supplierId = newSupplier.id;
          payable.supplierNameSnapshot = newSupplier.nomeFantasia || newSupplier.razaoSocial || newSupplier.nome || '';
          payable.supplierDocumentSnapshot = newSupplier.documento;
        }
      }
      if (data.amountCents !== undefined) {
        if (!Number.isInteger(data.amountCents) || data.amountCents <= 0) throw new Error('Valor da conta deve ser inteiro maior que zero.');
        payable.amountCents = data.amountCents;
      }
      if (data.dueDate !== undefined) {
        if (!isValidISODate(data.dueDate)) throw new Error('Data de vencimento inválida.');
        payable.dueDate = data.dueDate;
      }
    }

    if (data.description !== undefined) {
      if (!data.description || data.description.trim().length === 0) throw new Error('Descrição é obrigatória.');
      if (data.description.length > 500) throw new Error('Descrição muito longa.');
      payable.description = data.description.trim();
    }
    if (data.notes !== undefined) {
      if (data.notes && data.notes.length > 1000) throw new Error('Observação muito longa.');
      payable.notes = data.notes?.trim() || undefined;
    }
    payable.updatedAt = new Date().toISOString();
    return payable;
  }

  cancelPayable(id: string, data: { reason: string; cancelledBy: string; notes?: string }): AccountPayable {
    const payable = this.getById(id);
    if (!payable) throw new Error('Conta não encontrada.');
    if (payable.status === 'CANCELLED') throw new Error('Conta já está cancelada.');
    if (payable.status === 'PAID') throw new Error('Não é possível cancelar uma conta já paga.');
    const paidCents = getPaidCents(payable.id);
    if (paidCents > 0) throw new Error('Não é possível cancelar uma conta que já possui pagamentos.');
    if (payable.status !== 'OPEN') throw new Error('Apenas contas em aberto podem ser canceladas.');
    if (!data.reason || data.reason.trim().length === 0) throw new Error('Motivo do cancelamento é obrigatório.');

    payable.status = 'CANCELLED';
    payable.cancelledBy = data.cancelledBy || 'Operador';
    payable.cancelledAt = new Date().toISOString();
    payable.cancellationReason = data.reason.trim();
    if (data.notes) {
      payable.notes = (payable.notes ? payable.notes + '\n' : '') + `Cancelamento: ${data.notes}`;
    }
    payable.updatedAt = new Date().toISOString();
    return payable;
  }

  // ETAPA 13/14 - Pagamento (integral e parcial)
  getPaymentByPayableId(accountPayableId: string): AccountPayablePayment | undefined {
    // Retorna o último pagamento (para compatibilidade 1:1 antiga)
    const payments = db.accountPayablePayments.filter(p => p.accountPayableId === accountPayableId).sort((a,b)=> new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
    return payments[0];
  }

  getPaymentsByPayableId(accountPayableId: string): AccountPayablePayment[] {
    return getPaymentsByPayableId(accountPayableId);
  }

  payAccountPayable(data: { accountPayableId: string; paymentMethod: PayablePaymentMethod; amountCents?: number; notes?: string; paidBy: string }): { payable: AccountPayable; payment: AccountPayablePayment } {
    const payable = this.getById(data.accountPayableId);
    if (!payable) throw new Error('Conta não encontrada.');
    if (payable.status === 'PAID') throw new Error('Esta conta já foi paga.');
    if (payable.status === 'CANCELLED') throw new Error('Não é possível pagar uma conta cancelada.');
    if (payable.status !== 'OPEN' && payable.status !== 'PARTIALLY_PAID') throw new Error('Apenas contas em aberto podem ser pagas.');

    if (!['CASH', 'PIX', 'BANK_TRANSFER'].includes(data.paymentMethod)) {
      throw new Error('Forma de pagamento inválida.');
    }

    if (data.notes && data.notes.length > 1000) throw new Error('Observação muito longa. Máximo 1000 caracteres.');

    // Calcular saldo restante dentro da transação (recalculo)
    const paidBefore = getPaidCents(payable.id);
    const remainingBefore = payable.amountCents - paidBefore;
    if (remainingBefore <= 0) throw new Error('Esta conta já foi paga.');

    let amountCents: number;
    if (data.amountCents !== undefined && data.amountCents !== null) {
      amountCents = data.amountCents;
      if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('Valor do pagamento deve ser inteiro maior que zero.');
      if (amountCents > remainingBefore) throw new Error('O valor do pagamento não pode ser maior que o saldo restante.');
    } else {
      // Se não informado, usa saldo restante (integral)
      amountCents = remainingBefore;
    }
    const now = new Date().toISOString();
    const paidBy = (data.paidBy || 'Operador').trim() || 'Operador';

    // Snapshot for rollback
    const snapshot = {
      payables: JSON.parse(JSON.stringify(db.accountsPayable)),
      payments: JSON.parse(JSON.stringify(db.accountPayablePayments)),
      caixaMovs: JSON.parse(JSON.stringify(db.movimentacoesCaixa)),
      payableCounter: db._payablePaymentCounter,
    };

    try {
      let cashSessionId: string | null = null;
      let cashMovementId: string | null = null;

      if (data.paymentMethod === 'CASH') {
        const caixaRepo = new CaixaRepository();
        const sessaoAberta = caixaRepo.getSessaoAberta();
        if (!sessaoAberta) throw new Error('Abra o caixa antes de realizar um pagamento em dinheiro.');

        // Recalcular saldo disponível dentro da transação
        const movs = caixaRepo.getMovimentacoesSessao(sessaoAberta.id);
        const entradas = movs.filter(m => m.type === 'SUPPLY').reduce((acc, m) => acc + m.amountCents, 0);
        const saidas = movs.filter(m => m.type === 'WITHDRAWAL' || m.type === 'PAYABLE_PAYMENT').reduce((acc, m) => acc + m.amountCents, 0);
        const entradasVendasCash = db.vendas
          .filter(v => v.sessaoCaixaId === sessaoAberta.id && v.status === 'COMPLETED')
          .flatMap(v => v.pagamentos || [])
          .filter(p => p.metodo === 'CASH')
          .reduce((acc, p) => acc + p.valorCentavos, 0);
        const saldoDisponivel = sessaoAberta.openingAmountCents + entradas + entradasVendasCash - saidas;

        if (amountCents > saldoDisponivel) throw new Error('Saldo insuficiente no caixa para realizar este pagamento.');

        cashSessionId = sessaoAberta.id;

        // Criar CashMovement
        const movementId = Date.now().toString() + Math.random().toString(36).slice(2,4);
        const supplierName = payable.supplierNameSnapshot || db.fornecedores.find(f=>f.id===payable.supplierId)?.nomeFantasia || payable.supplierId;
        const reason = `Pagamento de conta ${payable.payableNumber} — ${supplierName}`;
        const mov: any = {
          id: movementId,
          sessionId: sessaoAberta.id,
          type: 'PAYABLE_PAYMENT' as const,
          amountCents,
          reason,
          note: data.notes,
          operator: paidBy,
          createdAt: now,
          referenceType: 'ACCOUNT_PAYABLE',
          referenceId: payable.id,
        };
        db.movimentacoesCaixa.push(mov);
        cashMovementId = mov.id;
      }

      // Criar pagamento
      const paymentId = Date.now().toString() + Math.random().toString(36).slice(2,4);
      db._payablePaymentCounter = (db._payablePaymentCounter || 0) + 1;
      const payment: AccountPayablePayment = {
        id: paymentId,
        accountPayableId: payable.id,
        payableNumberSnapshot: payable.payableNumber,
        paymentMethod: data.paymentMethod,
        amountCents,
        cashSessionId,
        cashMovementId,
        paidBy,
        paidAt: now,
        notes: data.notes?.trim() || undefined,
        createdAt: now,
      };
      db.accountPayablePayments.push(payment);

      // Recalcular saldo após pagamento e atualizar status
      const paidAfter = getPaidCents(payable.id); // já inclui pagamento criado
      const remainingAfter = payable.amountCents - paidAfter;
      if (remainingAfter === 0) {
        payable.status = 'PAID';
        payable.paidAt = now;
        payable.paidBy = paidBy;
        payable.paymentMethod = data.paymentMethod;
        payable.paymentId = paymentId;
      } else if (remainingAfter > 0) {
        payable.status = 'PARTIALLY_PAID';
        // Para parcialmente paga, não sobrescreve paidAt final, mas mantém histórico
        // Limpa campos PAID antigos se existirem (caso tenha sido PAID antes? não deve)
        // Mantém último pagamento info opcional
      } else {
        // Should not happen due to validação, but rollback if negative
        throw new Error('O valor do pagamento não pode ser maior que o saldo restante.');
      }
      payable.updatedAt = now;

      return { payable, payment };
    } catch (e) {
      // ROLLBACK
      db.accountsPayable = snapshot.payables;
      db.accountPayablePayments = snapshot.payments;
      db.movimentacoesCaixa = snapshot.caixaMovs;
      db._payablePaymentCounter = snapshot.payableCounter;
      throw e;
    }
  }

  reverseAccountPayablePayment(data: { paymentId: string; reason: string; notes?: string; reversedBy: string }): { reversal: import('../types.js').AccountPayablePaymentReversal; payable: AccountPayable; compensatoryMovement?: any } {
    const payment = db.accountPayablePayments.find((p:any)=> p.id===data.paymentId);
    if (!payment) throw new Error('Pagamento não encontrado.');
    if (isPayablePaymentReversed(payment.id)) throw new Error('Este pagamento já foi estornado.');
    if (!data.reason || data.reason.trim().length===0) throw new Error('Motivo do estorno é obrigatório.');
    if (data.notes && data.notes.length > 1000) throw new Error('Observação muito longa.');

    const payable = this.getById(payment.accountPayableId);
    if (!payable) throw new Error('Conta não encontrada.');

    // Snapshot for rollback
    const snapshot = {
      payables: JSON.parse(JSON.stringify(db.accountsPayable)),
      payments: JSON.parse(JSON.stringify(db.accountPayablePayments)),
      reversals: JSON.parse(JSON.stringify((db as any).accountPayablePaymentReversals)),
      caixaMovs: JSON.parse(JSON.stringify(db.movimentacoesCaixa)),
    };

    try {
      const now = new Date().toISOString();
      const reversedBy = (data.reversedBy || 'Operador').trim() || 'Operador';

      let compensatoryMovementId: string | null = null;

      if (payment.paymentMethod === 'CASH') {
        // Validar caixa original ainda OPEN
        const originalMovement = db.movimentacoesCaixa.find((m:any)=> m.id===payment.cashMovementId);
        if (!originalMovement) throw new Error('Movimentação original não encontrada.');
        const originalSession = db.sessoesCaixa.find((s:any)=> s.id===payment.cashSessionId);
        if (!originalSession || originalSession.status !== 'OPEN') {
          throw new Error('Não é possível estornar uma movimentação em dinheiro de um caixa já fechado.');
        }
        const caixaRepo = new CaixaRepository();
        const sessaoAtual = caixaRepo.getSessaoAberta();
        if (!sessaoAtual || sessaoAtual.id !== payment.cashSessionId) {
          throw new Error('Não é possível estornar uma movimentação em dinheiro de um caixa já fechado.');
        }
        // Criar movimento compensatório de ENTRADA
        const compId = Date.now().toString() + Math.random().toString(36).slice(2,4);
        const reason = `Estorno de pagamento ${payable.payableNumber} — ${payable.supplierNameSnapshot || ''}`;
        const mov: any = {
          id: compId,
          sessionId: sessaoAtual.id,
          type: 'PAYABLE_PAYMENT_REVERSAL' as const,
          amountCents: payment.amountCents,
          reason,
          note: data.notes,
          operator: reversedBy,
          createdAt: now,
          referenceType: 'ACCOUNT_PAYABLE',
          referenceId: payable.id,
        };
        db.movimentacoesCaixa.push(mov);
        compensatoryMovementId = mov.id;
      }

      const reversalId = Date.now().toString() + Math.random().toString(36).slice(2,4);
      const reversal: import('../types.js').AccountPayablePaymentReversal = {
        id: reversalId,
        accountPayablePaymentId: payment.id,
        reason: data.reason.trim(),
        notes: data.notes?.trim() || undefined,
        reversedBy,
        reversedAt: now,
        cashMovementId: compensatoryMovementId,
        createdAt: now,
      };
      (db as any).accountPayablePaymentReversals.push(reversal);

      // Recalcular status da conta baseado em pagamentos efetivos
      const paidAfter = getPaidCents(payable.id);
      const remainingAfter = payable.amountCents - paidAfter;
      if (remainingAfter === 0 && paidAfter > 0) {
        payable.status = 'PAID';
      } else if (remainingAfter > 0 && paidAfter > 0) {
        payable.status = 'PARTIALLY_PAID';
      } else if (paidAfter === 0) {
        payable.status = 'OPEN';
        // limpar campos de pagamento final se existirem
        delete (payable as any).paidAt;
        delete (payable as any).paidBy;
        delete (payable as any).paymentMethod;
        delete (payable as any).paymentId;
      }
      payable.updatedAt = now;

      return { reversal, payable, compensatoryMovement: compensatoryMovementId ? db.movimentacoesCaixa.find((m:any)=> m.id===compensatoryMovementId) : undefined };
    } catch (e) {
      (db as any).accountPayablePaymentReversals = snapshot.reversals;
      db.accountsPayable = snapshot.payables;
      db.accountPayablePayments = snapshot.payments;
      db.movimentacoesCaixa = snapshot.caixaMovs;
      throw e;
    }
  }
}
