import { db } from '../db.js';
import type { AccountReceivable, AccountReceivablePayment } from '../types.js';
import { CaixaRepository } from '../repositories/CaixaRepository.js';

function toISODate(d: Date){ return d.toISOString().slice(0,10); }
function getTodayISO(){ return toISODate(new Date()); }

export function getReceivableDerivedSituation(r: AccountReceivable): string {
  if (r.status === 'CANCELLED') return 'CANCELLED';
  if (r.status === 'PAID') return 'PAID';
  if (r.status === 'PARTIALLY_PAID') return 'PARTIALLY_PAID';
  const today = getTodayISO();
  if (r.dueDate === today) return 'DUE_TODAY';
  if (r.dueDate < today) return 'OVERDUE';
  return 'OPEN';
}

export function isReceivablePaymentReversed(paymentId: string): boolean {
  return (db as any).accountReceivablePaymentReversals?.some((r:any)=> r.accountReceivablePaymentId===paymentId) || false;
}
export function getReceivablePaidCents(receivableId: string): number {
  return (db as any).accountReceivablePayments.filter((p:any)=> p.accountReceivableId===receivableId && !isReceivablePaymentReversed(p.id)).reduce((s:number,p:any)=> s+p.amountCents,0);
}
export function getReceivableRemainingCents(receivable: AccountReceivable): number {
  return receivable.amountCents - getReceivablePaidCents(receivable.id);
}
export function getReceivablePayments(receivableId: string): AccountReceivablePayment[] {
  return (db as any).accountReceivablePayments.filter((p:any)=> p.accountReceivableId===receivableId).sort((a:any,b:any)=> new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
}
export function getEffectiveReceivablePayments(receivableId: string): AccountReceivablePayment[] {
  return (db as any).accountReceivablePayments.filter((p:any)=> p.accountReceivableId===receivableId && !isReceivablePaymentReversed(p.id));
}

export class AccountReceivableService {
  getById(id: string): AccountReceivable | undefined {
    return (db as any).accountReceivables.find((r: any) => r.id === id);
  }
  getBySaleId(saleId: string): AccountReceivable | undefined {
    return (db as any).accountReceivables.find((r: any) => r.saleId === saleId);
  }
  list(): AccountReceivable[] {
    return [...(db as any).accountReceivables].sort((a:any,b:any)=> {
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
  search(params: { q?: string; statusFilter?: string; dueFrom?: string; dueTo?: string }): AccountReceivable[] {
    let list = this.list();
    const q = (params.q||'').trim().toLowerCase();
    if (q) {
      list = list.filter(r=>{
        const customer = db.clientes.find(c=>c.id===r.customerId);
        return (
          r.description.toLowerCase().includes(q) ||
          r.receivableNumber.toLowerCase().includes(q) ||
          r.saleId.toLowerCase().includes(q) ||
          (customer?.nome||'').toLowerCase().includes(q) ||
          (customer?.cpf||customer?.cnpj||'').toLowerCase().includes(q) ||
          (r.customerNameSnapshot||'').toLowerCase().includes(q)
        );
      });
    }
    if (params.statusFilter && params.statusFilter !== 'ALL') {
      const today = getTodayISO();
      list = list.filter(r=>{
        switch(params.statusFilter){
          case 'OPEN': return r.status==='OPEN';
          case 'PARTIALLY_PAID': return r.status==='PARTIALLY_PAID';
          case 'CANCELLED': return r.status==='CANCELLED';
          case 'PAID': return r.status==='PAID';
          case 'DUE_TODAY': return (r.status==='OPEN' || r.status==='PARTIALLY_PAID') && r.dueDate===today;
          case 'OVERDUE': return (r.status==='OPEN' || r.status==='PARTIALLY_PAID') && r.dueDate < today;
          default: return true;
        }
      });
    }
    if (params.dueFrom) list = list.filter(r=> r.dueDate >= params.dueFrom!);
    if (params.dueTo) list = list.filter(r=> r.dueDate <= params.dueTo!);
    return list;
  }
  getSummary(){
    const today=getTodayISO();
    const openLike = (db as any).accountReceivables.filter((r:any)=>r.status==='OPEN' || r.status==='PARTIALLY_PAID');
    const totalOpen = openLike.reduce((s:number,r:any)=> s + getReceivableRemainingCents(r),0);
    const dueToday = openLike.filter((r:any)=>r.dueDate===today).reduce((s:number,r:any)=> s + getReceivableRemainingCents(r),0);
    const overdue = openLike.filter((r:any)=>r.dueDate < today).reduce((s:number,r:any)=> s + getReceivableRemainingCents(r),0);
    return { totalOpenCents: totalOpen, dueTodayCents: dueToday, overdueCents: overdue, countOpen: openLike.length };
  }

  getPaymentByReceivableId(accountReceivableId: string): AccountReceivablePayment | undefined {
    return (db as any).accountReceivablePayments.find((p:any)=> p.accountReceivableId===accountReceivableId);
  }

  receiveAccountReceivable(data: { accountReceivableId: string; paymentMethod: 'CASH' | 'PIX' | 'BANK_TRANSFER'; amountCents?: number; notes?: string; receivedBy: string }): { receivable: AccountReceivable; payment: AccountReceivablePayment } {
    const receivable = this.getById(data.accountReceivableId);
    if (!receivable) throw new Error('Conta não encontrada.');
    if (receivable.status === 'PAID') throw new Error('Esta conta já foi recebida.');
    if (receivable.status === 'CANCELLED') throw new Error('Não é possível receber uma conta cancelada.');
    if (receivable.status !== 'OPEN' && receivable.status !== 'PARTIALLY_PAID') throw new Error('Apenas contas em aberto podem ser recebidas.');

    if (!['CASH','PIX','BANK_TRANSFER'].includes(data.paymentMethod)) throw new Error('Forma de pagamento inválida.');
    if (data.notes && data.notes.length > 1000) throw new Error('Observação muito longa. Máximo 1000 caracteres.');

    const paidBefore = getReceivablePaidCents(receivable.id);
    const remainingBefore = receivable.amountCents - paidBefore;
    if (remainingBefore <= 0) throw new Error('Esta conta já foi recebida.');

    let amountCents: number;
    if (data.amountCents !== undefined && data.amountCents !== null) {
      amountCents = data.amountCents;
      if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('Valor recebido deve ser inteiro maior que zero.');
      if (amountCents > remainingBefore) throw new Error('O valor recebido não pode ser maior que o saldo restante.');
    } else {
      amountCents = remainingBefore;
    }
    const now = new Date().toISOString();
    const receivedBy = (data.receivedBy || 'Operador').trim() || 'Operador';

    const snapshot = {
      receivables: JSON.parse(JSON.stringify((db as any).accountReceivables)),
      payments: JSON.parse(JSON.stringify((db as any).accountReceivablePayments)),
      caixaMovs: JSON.parse(JSON.stringify(db.movimentacoesCaixa)),
      counter: (db as any)._receivablePaymentCounter,
    };

    try {
      let cashSessionId: string | null = null;
      let cashMovementId: string | null = null;

      if (data.paymentMethod === 'CASH') {
        const caixaRepo = new CaixaRepository();
        const sessaoAberta = caixaRepo.getSessaoAberta();
        if (!sessaoAberta) throw new Error('Abra o caixa antes de receber uma conta em dinheiro.');
        cashSessionId = sessaoAberta.id;
        const movementId = Date.now().toString() + Math.random().toString(36).slice(2,4);
        const customerName = receivable.customerNameSnapshot || db.clientes.find(c=>c.id===receivable.customerId)?.nome || receivable.customerId;
        const reason = `Recebimento de conta ${receivable.receivableNumber} — ${customerName}`;
        const mov: any = {
          id: movementId,
          sessionId: sessaoAberta.id,
          type: 'RECEIVABLE_RECEIPT' as const,
          amountCents,
          reason,
          note: data.notes,
          operator: receivedBy,
          createdAt: now,
          referenceType: 'ACCOUNT_RECEIVABLE',
          referenceId: receivable.id,
        };
        db.movimentacoesCaixa.push(mov);
        cashMovementId = mov.id;
      }

      const paymentId = Date.now().toString() + Math.random().toString(36).slice(2,4);
      (db as any)._receivablePaymentCounter = ((db as any)._receivablePaymentCounter || 0) + 1;
      const payment: AccountReceivablePayment = {
        id: paymentId,
        accountReceivableId: receivable.id,
        receivableNumberSnapshot: receivable.receivableNumber,
        paymentMethod: data.paymentMethod,
        amountCents,
        cashSessionId,
        cashMovementId,
        receivedBy,
        receivedAt: now,
        notes: data.notes?.trim() || undefined,
        createdAt: now,
      };
      (db as any).accountReceivablePayments.push(payment);

      const paidAfter = getReceivablePaidCents(receivable.id);
      const remainingAfter = receivable.amountCents - paidAfter;
      if (remainingAfter === 0) {
        receivable.status = 'PAID';
        receivable.paidAt = now;
        receivable.paidBy = receivedBy;
        receivable.paymentMethod = data.paymentMethod;
        receivable.paymentId = paymentId;
      } else if (remainingAfter > 0) {
        receivable.status = 'PARTIALLY_PAID';
      } else {
        throw new Error('O valor recebido não pode ser maior que o saldo restante.');
      }
      receivable.updatedAt = now;

      return { receivable, payment };
    } catch (e) {
      (db as any).accountReceivables = snapshot.receivables;
      (db as any).accountReceivablePayments = snapshot.payments;
      db.movimentacoesCaixa = snapshot.caixaMovs;
      (db as any)._receivablePaymentCounter = snapshot.counter;
      throw e;
    }
  }

  reverseAccountReceivablePayment(data: { paymentId: string; reason: string; notes?: string; reversedBy: string }): { reversal: import('../types.js').AccountReceivablePaymentReversal; receivable: AccountReceivable } {
    const payment = (db as any).accountReceivablePayments.find((p:any)=> p.id===data.paymentId);
    if (!payment) throw new Error('Recebimento não encontrado.');
    if (isReceivablePaymentReversed(payment.id)) throw new Error('Este recebimento já foi estornado.');
    if (!data.reason || data.reason.trim().length===0) throw new Error('Motivo do estorno é obrigatório.');
    if (data.notes && data.notes.length > 1000) throw new Error('Observação muito longa.');

    const receivable = this.getById(payment.accountReceivableId);
    if (!receivable) throw new Error('Conta não encontrada.');

    const snapshot = {
      receivables: JSON.parse(JSON.stringify((db as any).accountReceivables)),
      payments: JSON.parse(JSON.stringify((db as any).accountReceivablePayments)),
      reversals: JSON.parse(JSON.stringify((db as any).accountReceivablePaymentReversals || [])),
      caixaMovs: JSON.parse(JSON.stringify(db.movimentacoesCaixa)),
    };

    try {
      const now = new Date().toISOString();
      const reversedBy = (data.reversedBy || 'Operador').trim() || 'Operador';
      let compensatoryMovementId: string | null = null;

      if (payment.paymentMethod === 'CASH') {
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
        // Validar saldo suficiente para saída compensatória (estorno de recebimento é saída)
        const movs = caixaRepo.getMovimentacoesSessao(sessaoAtual.id);
        const entradas = movs.filter((m:any)=> m.type==='SUPPLY' || m.type==='RECEIVABLE_RECEIPT' || m.type==='PAYABLE_PAYMENT_REVERSAL').reduce((s:number,m:any)=> s+m.amountCents,0);
        const saidas = movs.filter((m:any)=> m.type==='WITHDRAWAL' || m.type==='PAYABLE_PAYMENT' || m.type==='RECEIVABLE_PAYMENT_REVERSAL').reduce((s:number,m:any)=> s+m.amountCents,0);
        const entradasVendasCash = db.vendas.filter((v:any)=> v.sessaoCaixaId===sessaoAtual.id && v.status==='COMPLETED').flatMap((v:any)=> v.pagamentos||[]).filter((p:any)=> p.metodo==='CASH').reduce((s:number,p:any)=> s+p.valorCentavos,0);
        const saldoDisponivel = sessaoAtual.openingAmountCents + entradas + entradasVendasCash - saidas;
        if (payment.amountCents > saldoDisponivel) {
          throw new Error('Saldo insuficiente no caixa para estornar este recebimento em dinheiro.');
        }
        const compId = Date.now().toString() + Math.random().toString(36).slice(2,4);
        const customerName = receivable.customerNameSnapshot || db.clientes.find(c=>c.id===receivable.customerId)?.nome || receivable.customerId;
        const reason = `Estorno de recebimento ${receivable.receivableNumber} — ${customerName}`;
        const mov: any = {
          id: compId,
          sessionId: sessaoAtual.id,
          type: 'RECEIVABLE_PAYMENT_REVERSAL' as const,
          amountCents: payment.amountCents,
          reason,
          note: data.notes,
          operator: reversedBy,
          createdAt: now,
          referenceType: 'ACCOUNT_RECEIVABLE',
          referenceId: receivable.id,
        };
        db.movimentacoesCaixa.push(mov);
        compensatoryMovementId = mov.id;
      }

      const reversalId = Date.now().toString() + Math.random().toString(36).slice(2,4);
      const reversal: import('../types.js').AccountReceivablePaymentReversal = {
        id: reversalId,
        accountReceivablePaymentId: payment.id,
        reason: data.reason.trim(),
        notes: data.notes?.trim() || undefined,
        reversedBy,
        reversedAt: now,
        cashMovementId: compensatoryMovementId,
        createdAt: now,
      };
      (db as any).accountReceivablePaymentReversals = (db as any).accountReceivablePaymentReversals || [];
      (db as any).accountReceivablePaymentReversals.push(reversal);

      const paidAfter = getReceivablePaidCents(receivable.id);
      const remainingAfter = receivable.amountCents - paidAfter;
      if (remainingAfter === 0 && paidAfter > 0) {
        receivable.status = 'PAID';
      } else if (remainingAfter > 0 && paidAfter > 0) {
        receivable.status = 'PARTIALLY_PAID';
      } else if (paidAfter === 0) {
        receivable.status = 'OPEN';
        delete (receivable as any).paidAt;
        delete (receivable as any).paidBy;
        delete (receivable as any).paymentMethod;
        delete (receivable as any).paymentId;
      }
      receivable.updatedAt = now;

      return { reversal, receivable };
    } catch (e) {
      (db as any).accountReceivables = snapshot.receivables;
      (db as any).accountReceivablePayments = snapshot.payments;
      (db as any).accountReceivablePaymentReversals = snapshot.reversals;
      db.movimentacoesCaixa = snapshot.caixaMovs;
      throw e;
    }
  }
}
