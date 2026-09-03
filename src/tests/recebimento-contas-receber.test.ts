import { describe, it, beforeEach, expect } from 'vitest';
import { VendaService } from '../services/VendaService';
import { AccountReceivableService } from '../services/AccountReceivableService';
import { AccountPayableService } from '../services/AccountPayableService';
import { CaixaService } from '../services/CaixaService';
import { db } from '../db';

function toISODate(d: Date){ return d.toISOString().slice(0,10); }
function addDays(s:string, days:number){ const d=new Date(s+'T12:00:00'); d.setDate(d.getDate()+days); return toISODate(d); }

describe('ETAPA 16 - Recebimento Contas a Receber',()=>{
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
    db.produtos=[
      { id: 'p1', codigo: '001', nome: 'Copo', barra: '111', valor: 10, custo: 4, estGeral: 10, imagem: '' },
    ];
    db.clientes=[
      { id: 'c1', codigo: 'C001', nome: 'Mercado Silva', endereco: 'Rua A', cidade: 'SP', estado: 'SP', telefone: '11999999999', cpf: '52998224725', status: 'ACTIVE' },
    ];
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

  it('74. TESTE — CASH requer saldo? NÃO, é entrada',()=>{
    const { receivable } = createReceivable(10000);
    // Caixa saldo 5000, receber 10000 deve aumentar, não exigir saldo
    const result=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', receivedBy:'Op'});
    expect(result.receivable.status).toBe('PAID');
    expect(result.payment.amountCents).toBe(10000);
    expect(result.payment.cashSessionId).toBeDefined();
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(15000); // 5000+10000
  });

  it('76. TESTE — CASH SEM CAIXA falha',()=>{
    const { receivable } = createReceivable(10000);
    db.sessoesCaixa=[];
    db.movimentacoesCaixa=[];
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', receivedBy:'Op'})).toThrow(/Abra o caixa/);
    expect(receivableService.getById(receivable.id)!.status).toBe('OPEN');
    // reabrir para não afetar próximos testes (beforeEach já reabre, mas este teste precisa restaurar)
    caixaService.abrirCaixa({terminal:'T1', openedBy:'Op', openingAmountCents:5000});
  });

  it('77. TESTE — CASH COM CAIXA',()=>{
    const { receivable } = createReceivable(10000);
    const before=caixaService.getCaixaAtual()!.expectedAmountCents;
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', receivedBy:'Op'});
    const after=caixaService.getCaixaAtual()!.expectedAmountCents;
    expect(after).toBe(before+10000);
  });

  it('78. TESTE — PIX',()=>{
    const { receivable } = createReceivable(10000);
    const before=caixaService.getCaixaAtual()!.expectedAmountCents;
    const result=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', receivedBy:'Op'});
    expect(result.receivable.status).toBe('PAID');
    expect(result.payment.paymentMethod).toBe('PIX');
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(before);
  });

  it('79. TESTE — TRANSFER',()=>{
    const { receivable } = createReceivable(10000);
    const before=caixaService.getCaixaAtual()!.expectedAmountCents;
    const result=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'BANK_TRANSFER', receivedBy:'Op'});
    expect(result.receivable.status).toBe('PAID');
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(before);
  });

  it('80. TESTE — DUPLO RECEBIMENTO bloqueado',()=>{
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', receivedBy:'Op'});
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', receivedBy:'Op'})).toThrow(/já foi recebida/);
    expect((db as any).accountReceivablePayments.length).toBe(1);
  });

  it('81. TESTE — CANCELLED não pode receber',()=>{
    const { venda, receivable } = createReceivable(10000);
    vendaService.cancelarVenda(venda.id, 'Teste', 'Op');
    expect(receivableService.getById(receivable.id)!.status).toBe('CANCELLED');
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', receivedBy:'Op'})).toThrow(/cancelada/);
  });

  it('82. TESTE — PAID não pode receber novamente',()=>{
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', receivedBy:'Op'});
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', receivedBy:'Op'})).toThrow(/já foi recebida/);
  });

  it('83. TESTE — CASH MOVEMENT entrada única',()=>{
    const { receivable } = createReceivable(25000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', receivedBy:'Op'});
    const movs=db.movimentacoesCaixa.filter(m=>m.type==='RECEIVABLE_RECEIPT');
    expect(movs.length).toBe(1);
    expect(movs[0].amountCents).toBe(25000);
    expect(movs[0].referenceId).toBe(receivable.id);
  });

  it('84. TESTE — CASH SUMMARY completo',()=>{
    db.sessoesCaixa=[];
    db.movimentacoesCaixa=[];
    const sessao=caixaService.abrirCaixa({terminal:'T1', openedBy:'Op', openingAmountCents:10000});
    const sessId=sessao.id;
    sessaoId=sessId;
    caixaService.registrarMovimentacao({type:'SUPPLY', amountCents:5000, reason:'Suprimento'});
    db.vendas.push({
      id:'v1', data:new Date().toISOString(), subtotal:200, desconto:0, total:200,
      itens:[], status:'COMPLETED', sessaoCaixaId: sessId,
      pagamentos:[{id:'p1', vendaId:'v1', metodo:'CASH', valorCentavos:20000, valorRecebidoCentavos:20000, trocoCentavos:0, installments:1}]
    } as any);
    const { receivable } = createReceivable(7000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', receivedBy:'Op'});
    caixaService.registrarMovimentacao({type:'WITHDRAWAL', amountCents:3000, reason:'Sangria'});
    const payableService=new AccountPayableService();
    if(!db.fornecedores.find((x:any)=>x.id==='f1')) db.fornecedores.push({id:'f1', tipoPessoa:'PJ', documento:'00000000000191', razaoSocial:'Forn', status:'ACTIVE', createdAt:new Date().toISOString()} as any);
    const payable=payableService.createManual({supplierId:'f1', description:'Teste', amountCents:4000, dueDate: toISODate(new Date()), createdBy:'Op'});
    payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'CASH', paidBy:'Op'});
    const caixa=caixaService.getCaixaAtual()!;
    expect(caixa.expectedAmountCents).toBe(35000);
  });

  it('85. TESTE — PIX FORA DA GAVETA',()=>{
    const before=caixaService.getCaixaAtual()!.expectedAmountCents;
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', receivedBy:'Op'});
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(before);
  });

  it('86. TESTE — TRANSFER FORA DA GAVETA',()=>{
    const before=caixaService.getCaixaAtual()!.expectedAmountCents;
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'BANK_TRANSFER', receivedBy:'Op'});
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(before);
  });

  it('87. TESTE — SALE CANCEL APÓS PAYMENT bloqueado',()=>{
    const { venda, receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', receivedBy:'Op'});
    expect(()=> vendaService.cancelarVenda(venda.id, 'Teste', 'Op')).toThrow(/já foi recebido/);
    expect(venda.status).toBe('COMPLETED');
    expect(receivableService.getById(receivable.id)!.status).toBe('PAID');
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(9);
  });

  it('88. TESTE — SALE CANCEL ANTES DO PAYMENT permite',()=>{
    const { venda, receivable } = createReceivable(10000);
    vendaService.cancelarVenda(venda.id, 'Teste', 'Op');
    expect(venda.status).toBe('CANCELLED');
    expect(receivableService.getById(receivable.id)!.status).toBe('CANCELLED');
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(10);
  });

  it('89. TESTE — TRANSAÇÃO falha rollback',()=>{
    const { receivable } = createReceivable(10000);
    const origPush=(db.movimentacoesCaixa as any).push;
    (db.movimentacoesCaixa as any).push=()=>{ throw new Error('Falha simulada'); };
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', receivedBy:'Op'})).toThrow(/Falha simulada/);
    expect(receivableService.getById(receivable.id)!.status).toBe('OPEN');
    expect((db as any).accountReceivablePayments.length).toBe(0);
    (db.movimentacoesCaixa as any).push=origPush;
  });

  it('90. TESTE — CONCORRÊNCIA',()=>{
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', receivedBy:'A'});
    expect(()=> receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', receivedBy:'B'})).toThrow(/já foi recebida/);
  });

  it('91. TESTE — ESTOQUE inalterado',()=>{
    const { receivable } = createReceivable(10000);
    const before=db.produtos.find(p=>p.id==='p1')!.estGeral;
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', receivedBy:'Op'});
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(before);
  });

  it('92. TESTE — SALE não muda',()=>{
    const { venda, receivable } = createReceivable(10000);
    const saleBeforeStatus=venda.status;
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', receivedBy:'Op'});
    expect(venda.status).toBe(saleBeforeStatus);
    expect(venda.pagamentos[0].metodo).toBe('STORE_CREDIT');
  });

  it('93. TESTE — ROUND TRIP',()=>{
    const { receivable } = createReceivable(10000);
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', receivedBy:'Op', notes:'Obs'});
    const reloaded=receivableService.getById(receivable.id)!;
    const payment=(db as any).accountReceivablePayments.find((p:any)=>p.accountReceivableId===receivable.id);
    expect(reloaded.status).toBe('PAID');
    expect(payment.paymentMethod).toBe('PIX');
    expect(payment.notes).toBe('Obs');
    expect(payment.amountCents).toBe(10000);
  });

  it('Filtros Recebidas',()=>{
    const { receivable: r1 } = createReceivable(10000);
    const { receivable: r2 } = createReceivable(20000);
    receivableService.receiveAccountReceivable({accountReceivableId: r1.id, paymentMethod:'PIX', receivedBy:'Op'});
    const paidList=receivableService.search({statusFilter:'PAID'});
    expect(paidList.length).toBe(1);
    expect(paidList[0].id).toBe(r1.id);
    const openList=receivableService.search({statusFilter:'OPEN'});
    expect(openList.some(r=>r.id===r2.id)).toBe(true);
  });

  it('Resumo exclui PAID',()=>{
    const { receivable: r1 } = createReceivable(10000);
    const { receivable: r2 } = createReceivable(20000);
    receivableService.receiveAccountReceivable({accountReceivableId: r1.id, paymentMethod:'PIX', receivedBy:'Op'});
    const summary=receivableService.getSummary();
    expect(summary.totalOpenCents).toBe(20000);
    expect(summary.countOpen).toBe(1);
  });
});
