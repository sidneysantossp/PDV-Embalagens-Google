import { describe, it, beforeEach, expect } from 'vitest';
import { VendaService } from '../services/VendaService';
import { AccountReceivableService, getReceivablePaidCents, getReceivableRemainingCents } from '../services/AccountReceivableService';
import { AccountPayableService } from '../services/AccountPayableService';
import { CaixaService } from '../services/CaixaService';
import { db } from '../db';

function toISODate(d: Date){ return d.toISOString().slice(0,10); }
function addDays(s:string, days:number){ const d=new Date(s+'T12:00:00'); d.setDate(d.getDate()+days); return toISODate(d); }

describe('ETAPA 17 - Recebimento Parcial Contas a Receber',()=>{
  let vendaService: VendaService;
  let receivableService: AccountReceivableService;
  let caixaService: CaixaService;
  let clienteId:string;
  let sessaoId:string;

  beforeEach(()=>{
    vendaService=new VendaService();
    receivableService=new AccountReceivableService();
    caixaService=new CaixaService();
    db.vendas=[];
    db.sessoesCaixa=[];
    db.movimentacoesCaixa=[];
    db.accountReceivables=[];
    db.accountReceivablePayments=[];
    (db as any)._receivableCounter=0;
    (db as any)._receivablePaymentCounter=0;
    (db as any).cancelamentos=[];
    db.produtos=[{ id: 'p1', codigo: '001', nome: 'Copo', barra: '111', valor: 10, custo: 4, estGeral: 10, imagem: '' }];
    db.clientes=[{ id: 'c1', codigo: 'C001', nome: 'Mercado Silva', endereco: 'Rua A', cidade: 'SP', estado: 'SP', telefone: '11999999999', cpf: '52998224725', status: 'ACTIVE' }];
    clienteId='c1';
    db.configuracaoPagamento={ maxCreditInstallments: 12, allowStoreCredit: true };
    const sessao=caixaService.abrirCaixa({terminal:'T1', openedBy:'Op', openingAmountCents:5000});
    sessaoId=sessao.id;
  });

  function createReceivable(amountCents=10000, dueDate?:string){
    const due = dueDate || addDays(toISODate(new Date()),5);
    const venda=vendaService.finalizarVenda({
      subtotal: amountCents/100, desconto:0, total: amountCents/100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario: amountCents/100, total: amountCents/100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos: amountCents}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: due
    });
    const receivable=receivableService.getBySaleId(venda.id)!;
    return { venda, receivable };
  }

  it('74. TESTE — PRIMEIRO PARCIAL PIX',()=>{
    const { receivable } = createReceivable(10000);
    const result=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:4000, receivedBy:'Op'});
    expect(result.receivable.status).toBe('PARTIALLY_PAID');
    expect(getReceivablePaidCents(receivable.id)).toBe(4000);
    expect(getReceivableRemainingCents(receivable)).toBe(6000);
  });

  it('75. TESTE — SEGUNDO RECEBIMENTO',()=>{
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:4000, receivedBy:'Op'});
    const result=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'BANK_TRANSFER', amountCents:3000, receivedBy:'Op'});
    expect(result.receivable.status).toBe('PARTIALLY_PAID');
    expect(getReceivablePaidCents(receivable.id)).toBe(7000);
    expect(getReceivableRemainingCents(receivable)).toBe(3000);
  });

  it('76. TESTE — QUITAÇÃO',()=>{
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:4000, receivedBy:'Op'});
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'BANK_TRANSFER', amountCents:3000, receivedBy:'Op'});
    const result=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', amountCents:3000, receivedBy:'Op'});
    expect(result.receivable.status).toBe('PAID');
    expect(getReceivablePaidCents(receivable.id)).toBe(10000);
    expect(getReceivableRemainingCents(receivable)).toBe(0);
  });

  it('77. TESTE — CASH',()=>{
    const before=caixaService.getCaixaAtual()!.expectedAmountCents;
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', amountCents:3000, receivedBy:'Op'});
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(before+3000);
  });

  it('78. TESTE — PIX + CASH',()=>{
    db.sessoesCaixa=[];
    db.movimentacoesCaixa=[];
    const sessao=caixaService.abrirCaixa({terminal:'T1', openedBy:'Op', openingAmountCents:10000});
    sessaoId=sessao.id;
    const before=caixaService.getCaixaAtual()!.expectedAmountCents;
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:4000, receivedBy:'Op'});
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(before);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', amountCents:6000, receivedBy:'Op'});
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(before+6000);
    expect(receivableService.getById(receivable.id)!.status).toBe('PAID');
  });

  it('79. TESTE — CASH + TRANSFER',()=>{
    const before=caixaService.getCaixaAtual()!.expectedAmountCents;
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', amountCents:2500, receivedBy:'Op'});
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'BANK_TRANSFER', amountCents:7500, receivedBy:'Op'});
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(before+2500);
  });

  it('80. TESTE — MÚLTIPLOS CASH',()=>{
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', amountCents:1000, receivedBy:'Op'});
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', amountCents:2000, receivedBy:'Op'});
    const movs=db.movimentacoesCaixa.filter(m=>m.type==='RECEIVABLE_RECEIPT' && m.referenceId===receivable.id);
    expect(movs.length).toBe(2);
    expect(movs.reduce((s,m)=>s+m.amountCents,0)).toBe(3000);
  });

  it('81. TESTE — ACIMA DO REMAINING',()=>{
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:8000, receivedBy:'Op'});
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:2001, receivedBy:'Op'})).toThrow(/maior que o saldo restante/);
  });

  it('82. TESTE — ZERO',()=>{
    const { receivable } = createReceivable(10000);
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:0, receivedBy:'Op'})).toThrow(/maior que zero/);
  });

  it('83. TESTE — NEGATIVO',()=>{
    const { receivable } = createReceivable(10000);
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:-100, receivedBy:'Op'})).toThrow(/maior que zero/);
  });

  it('84. TESTE — CASH SEM CAIXA',()=>{
    const { receivable } = createReceivable(10000);
    db.sessoesCaixa=[];
    db.movimentacoesCaixa=[];
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', amountCents:1000, receivedBy:'Op'})).toThrow(/Abra o caixa/);
    expect(receivableService.getById(receivable.id)!.status).toBe('OPEN');
    // PIX ainda funciona sem caixa
    const result=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:1000, receivedBy:'Op'});
    expect(result.receivable.status).toBe('PARTIALLY_PAID');
  });

  it('85. TESTE — PAID bloqueado',()=>{
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:10000, receivedBy:'Op'});
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:100, receivedBy:'Op'})).toThrow(/já foi recebida/);
  });

  it('86. TESTE — CANCELLED bloqueado',()=>{
    const { venda, receivable } = createReceivable(10000);
    vendaService.cancelarVenda(venda.id, 'Teste', 'Op');
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:1000, receivedBy:'Op'})).toThrow(/cancelada/);
  });

  it('87. TESTE — CANCELAMENTO DA SALE PARCIAL bloqueado',()=>{
    const { venda, receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:100, receivedBy:'Op'});
    expect(()=> vendaService.cancelarVenda(venda.id, 'Teste', 'Op')).toThrow(/já possui recebimentos/);
    expect(venda.status).toBe('COMPLETED');
    expect(receivableService.getById(receivable.id)!.status).toBe('PARTIALLY_PAID');
  });

  it('88. TESTE — CANCELAMENTO ANTES DE RECEBER permite',()=>{
    const { venda, receivable } = createReceivable(10000);
    vendaService.cancelarVenda(venda.id, 'Teste', 'Op');
    expect(venda.status).toBe('CANCELLED');
    expect(receivableService.getById(receivable.id)!.status).toBe('CANCELLED');
  });

  it('89. TESTE — RESUMO por saldo restante',()=>{
    const { receivable: rA } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: rA.id, paymentMethod:'PIX', amountCents:4000, receivedBy:'Op'});
    const { receivable: rB } = createReceivable(5000);
    const summary=receivableService.getSummary();
    expect(summary.totalOpenCents).toBe(11000); // 6000 +5000
  });

  it('90. TESTE — VENCIDA PARCIAL',()=>{
    const { receivable } = createReceivable(10000);
    receivable.dueDate=addDays(toISODate(new Date()),-1);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:6000, receivedBy:'Op'});
    const summary=receivableService.getSummary();
    expect(summary.overdueCents).toBe(4000);
  });

  it('91. TESTE — CASH SUMMARY com parciais',()=>{
    db.sessoesCaixa=[];
    db.movimentacoesCaixa=[];
    const sessao=caixaService.abrirCaixa({terminal:'T1', openedBy:'Op', openingAmountCents:10000});
    sessaoId=sessao.id;
    // Venda CASH 20000
    db.vendas.push({
      id:'v1', data:new Date().toISOString(), subtotal:200, desconto:0, total:200,
      itens:[], status:'COMPLETED', sessaoCaixaId: sessao.id,
      pagamentos:[{id:'p1', vendaId:'v1', metodo:'CASH', valorCentavos:20000, valorRecebidoCentavos:20000, trocoCentavos:0, installments:1}]
    } as any);
    const { receivable: r1 } = createReceivable(5000);
    receivableService.receiveAccountReceivable({accountReceivableId: r1.id, paymentMethod:'CASH', amountCents:3000, receivedBy:'Op'});
    const { receivable: r2 } = createReceivable(5000);
    receivableService.receiveAccountReceivable({accountReceivableId: r2.id, paymentMethod:'PIX', amountCents:5000, receivedBy:'Op'});
    const { receivable: r3 } = createReceivable(5000);
    receivableService.receiveAccountReceivable({accountReceivableId: r3.id, paymentMethod:'CASH', amountCents:2000, receivedBy:'Op'});
    const payableService=new AccountPayableService();
    if(!db.fornecedores.find((x:any)=>x.id==='f1')) db.fornecedores.push({id:'f1', tipoPessoa:'PJ', documento:'00000000000191', razaoSocial:'Forn', status:'ACTIVE', createdAt:new Date().toISOString()} as any);
    const payable=payableService.createManual({supplierId:'f1', description:'Teste', amountCents:4000, dueDate: toISODate(new Date()), createdBy:'Op'});
    payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'CASH', paidBy:'Op'});
    caixaService.registrarMovimentacao({type:'WITHDRAWAL', amountCents:1000, reason:'Sangria'});
    const caixa=caixaService.getCaixaAtual()!;
    expect(caixa.expectedAmountCents).toBe(30000);
  });

  it('92. TESTE — TRANSAÇÃO rollback',()=>{
    const { receivable } = createReceivable(10000);
    const origPush=(db.movimentacoesCaixa as any).push;
    (db.movimentacoesCaixa as any).push=()=>{ throw new Error('Falha simulada'); };
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', amountCents:1000, receivedBy:'Op'})).toThrow(/Falha simulada/);
    expect(getReceivablePaidCents(receivable.id)).toBe(0);
    expect(receivableService.getById(receivable.id)!.status).toBe('OPEN');
    (db.movimentacoesCaixa as any).push=origPush;
  });

  it('93. TESTE — CONCORRÊNCIA',()=>{
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:6000, receivedBy:'A'});
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:5000, receivedBy:'B'})).toThrow(/maior que o saldo restante/);
    expect(getReceivablePaidCents(receivable.id)).toBe(6000);
    // segunda tenta 4000 deve passar
    const result=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:4000, receivedBy:'B'});
    expect(result.receivable.status).toBe('PAID');
  });

  it('Valor integral continua',()=>{
    const { receivable } = createReceivable(10000);
    const result=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:10000, receivedBy:'Op'});
    expect(result.receivable.status).toBe('PAID');
  });

  it('OPEN -> PAID direto',()=>{
    const { receivable } = createReceivable(10000);
    const result=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:10000, receivedBy:'Op'});
    expect(result.receivable.status).toBe('PAID');
  });

  it('Imutabilidade',()=>{
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:4000, receivedBy:'Op'});
    const paymentId=(db as any).accountReceivablePayments[0].id;
    expect((receivableService as any).updatePayment).toBeUndefined();
    expect((db as any).accountReceivablePayments.find((p:any)=>p.id===paymentId).amountCents).toBe(4000);
  });

  it('Filtro Parcialmente recebidas',()=>{
    const { receivable: rOpen } = createReceivable(10000);
    const { receivable: rPartial } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: rPartial.id, paymentMethod:'PIX', amountCents:3000, receivedBy:'Op'});
    const { receivable: rPaid } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: rPaid.id, paymentMethod:'PIX', amountCents:10000, receivedBy:'Op'});
    const res=receivableService.search({statusFilter:'PARTIALLY_PAID'});
    expect(res.length).toBe(1);
    expect(res[0].id).toBe(rPartial.id);
  });
});
