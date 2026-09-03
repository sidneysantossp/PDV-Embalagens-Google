import { describe, it, beforeEach, expect } from 'vitest';
import { AccountPayableService, getPaidCents, getRemainingCents } from '../services/AccountPayableService';
import { AccountReceivableService, getReceivablePaidCents, getReceivableRemainingCents } from '../services/AccountReceivableService';
import { FornecedorService } from '../services/FornecedorService';
import { VendaService } from '../services/VendaService';
import { CaixaService } from '../services/CaixaService';
import { db } from '../db';

function toISODate(d: Date){ return d.toISOString().slice(0,10); }
function addDays(s:string, days:number){ const d=new Date(s+'T12:00:00'); d.setDate(d.getDate()+days); return toISODate(d); }

describe('ETAPA 18 - Estorno',()=>{
  let payableService: AccountPayableService;
  let receivableService: AccountReceivableService;
  let fornecedorService: FornecedorService;
  let vendaService: VendaService;
  let caixaService: CaixaService;
  let fornecedorId:string;
  let clienteId:string;
  let sessaoId:string;

  beforeEach(()=>{
    payableService=new AccountPayableService();
    receivableService=new AccountReceivableService();
    fornecedorService=new FornecedorService();
    vendaService=new VendaService();
    caixaService=new CaixaService();
    db.accountsPayable=[];
    db.accountPayablePayments=[];
    db.accountPayablePaymentReversals=[];
    db.accountReceivables=[];
    db.accountReceivablePayments=[];
    db.accountReceivablePaymentReversals=[];
    db.movimentacoesCaixa=[];
    db.sessoesCaixa=[];
    db.vendas=[];
    db.purchaseOrders=[];
    db.purchaseReceipts=[];
    db.stockMovements=[];
    (db as any)._payableCounter=0;
    (db as any)._payablePaymentCounter=0;
    (db as any)._receivableCounter=0;
    (db as any)._receivablePaymentCounter=0;
    (db as any)._purchaseOrderCounter=0;
    (db as any)._purchaseReceiptCounter=0;
    (db as any).cancelamentos=[];
    db.fornecedores=[];
    db.clientes=[];
    db.produtos=[{ id: 'p1', codigo: '001', nome: 'Copo', barra: '111', valor: 10, custo: 4, estGeral: 10, imagem: '' }];
    db.configuracaoPagamento={ maxCreditInstallments: 12, allowStoreCredit: true };
    const f=fornecedorService.criarFornecedor({tipoPessoa:'PJ', documento:'00.000.000/0001-91', razaoSocial:'Fornecedor Teste'});
    fornecedorId=f.id;
    db.clientes.push({ id: 'c1', codigo: 'C001', nome: 'Mercado Silva', endereco: 'Rua A', cidade: 'SP', estado: 'SP', telefone: '11999999999', cpf: '52998224725', status: 'ACTIVE' });
    clienteId='c1';
    const sessao=caixaService.abrirCaixa({terminal:'T1', openedBy:'Op', openingAmountCents:10000});
    sessaoId=sessao.id;
  });

  it('88. PAYABLE PIX estorno',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:10000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const pay=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'PIX', amountCents:4000, paidBy:'Op'});
    expect(pay.payable.status).toBe('PARTIALLY_PAID');
    const reversal=payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'Lançamento incorreto', reversedBy:'Op'});
    expect(reversal.payable.status).toBe('OPEN');
    expect(getPaidCents(payable.id)).toBe(0);
    expect(getRemainingCents(payable)).toBe(10000);
    // cash inalterado
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(10000);
  });

  it('89. PAYABLE PARCIAL estornar PIX',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:10000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const p1=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'PIX', amountCents:4000, paidBy:'Op'});
    const p2=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'CASH', amountCents:3000, paidBy:'Op'});
    expect(getPaidCents(payable.id)).toBe(7000);
    payableService.reverseAccountPayablePayment({paymentId: p1.payment.id, reason:'Duplicidade', reversedBy:'Op'});
    expect(getPaidCents(payable.id)).toBe(3000);
    expect(payableService.getById(payable.id)!.status).toBe('PARTIALLY_PAID');
  });

  it('90. PAYABLE PAID -> PARTIAL após estorno',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:10000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const p1=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'PIX', amountCents:4000, paidBy:'Op'});
    const p2=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'BANK_TRANSFER', amountCents:6000, paidBy:'Op'});
    expect(payableService.getById(payable.id)!.status).toBe('PAID');
    payableService.reverseAccountPayablePayment({paymentId: p2.payment.id, reason:'Outro', reversedBy:'Op'});
    expect(getPaidCents(payable.id)).toBe(4000);
    expect(payableService.getById(payable.id)!.status).toBe('PARTIALLY_PAID');
  });

  it('91. PAYABLE CASH estorno com compensação',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:3000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const pay=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'CASH', amountCents:3000, paidBy:'Op'});
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(7000);
    const rev=payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'Pagamento não confirmado', reversedBy:'Op'});
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(10000);
    expect(rev.reversal.cashMovementId).toBeDefined();
    const mov=db.movimentacoesCaixa.find(m=> m.id===rev.reversal.cashMovementId);
    expect(mov?.type).toBe('PAYABLE_PAYMENT_REVERSAL');
  });

  it('92. PAYABLE CASH com caixa fechado bloqueia estorno',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:3000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const pay=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'CASH', amountCents:3000, paidBy:'Op'});
    // fechar caixa
    caixaService.fecharCaixa({countedAmountCents: caixaService.getCaixaAtual()!.expectedAmountCents});
    expect(()=> payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'})).toThrow(/caixa já fechado/);
    expect(getPaidCents(payable.id)).toBe(3000);
  });

  it('93. RECEIVABLE PIX estorno',()=>{
    const { receivable } = (()=>{ const v=vendaService.finalizarVenda({subtotal:100, desconto:0, total:100, itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}], pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}], sessaoCaixaId: sessaoId, clienteId, dueDate: addDays(toISODate(new Date()),5)}); return { receivable: receivableService.getBySaleId(v.id)! }; })();
    const pay=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:4000, receivedBy:'Op'});
    expect(receivableService.getById(receivable.id)!.status).toBe('PARTIALLY_PAID');
    receivableService.reverseAccountReceivablePayment({paymentId: pay.payment.id, reason:'Duplicidade', reversedBy:'Op'});
    expect(receivableService.getById(receivable.id)!.status).toBe('OPEN');
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(10000);
  });

  it('94. RECEIVABLE CASH estorno com compensação',()=>{
    const { receivable } = (()=>{ const v=vendaService.finalizarVenda({subtotal:100, desconto:0, total:100, itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}], pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}], sessaoCaixaId: sessaoId, clienteId, dueDate: addDays(toISODate(new Date()),5)}); return { receivable: receivableService.getBySaleId(v.id)! }; })();
    const pay=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', amountCents:3000, receivedBy:'Op'});
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(13000);
    const rev=receivableService.reverseAccountReceivablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'});
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(10000);
    const mov=db.movimentacoesCaixa.find(m=> m.id===rev.reversal.cashMovementId);
    expect(mov?.type).toBe('RECEIVABLE_PAYMENT_REVERSAL');
  });

  it('95. RECEIVABLE CASH sem saldo bloqueia estorno',()=>{
    const { receivable } = (()=>{ const v=vendaService.finalizarVenda({subtotal:100, desconto:0, total:100, itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}], pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}], sessaoCaixaId: sessaoId, clienteId, dueDate: addDays(toISODate(new Date()),5)}); return { receivable: receivableService.getBySaleId(v.id)! }; })();
    // abrir caixa com 2000
    db.sessoesCaixa=[];
    db.movimentacoesCaixa=[];
    const sessao=caixaService.abrirCaixa({terminal:'T1', openedBy:'Op', openingAmountCents:2000});
    sessaoId=sessao.id;
    // criar outro receivable e receber 3000 (entrada de 3000, saldo 5000)
    const { receivable: r2 } = (()=>{ const v=vendaService.finalizarVenda({subtotal:100, desconto:0, total:100, itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}], pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}], sessaoCaixaId: sessaoId, clienteId, dueDate: addDays(toISODate(new Date()),5)}); return { receivable: receivableService.getBySaleId(v.id)! }; })();
    receivableService.receiveAccountReceivable({accountReceivableId: r2.id, paymentMethod:'CASH', amountCents:3000, receivedBy:'Op'});
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(5000);
    // gastar para deixar saldo 2000
    caixaService.registrarMovimentacao({type:'WITHDRAWAL', amountCents:3000, reason:'Sangria'});
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(2000);
    // tentar estornar 3000 (precisa saída 3000, mas saldo só 2000) -> bloqueia
    expect(()=> receivableService.reverseAccountReceivablePayment({paymentId: (db as any).accountReceivablePayments.find((p:any)=> p.accountReceivableId===r2.id).id, reason:'Outro', reversedBy:'Op'})).toThrow(/Saldo insuficiente/);
  });

  it('96. RECEIVABLE CASH caixa fechado bloqueia',()=>{
    const { receivable } = (()=>{ const v=vendaService.finalizarVenda({subtotal:100, desconto:0, total:100, itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}], pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}], sessaoCaixaId: sessaoId, clienteId, dueDate: addDays(toISODate(new Date()),5)}); return { receivable: receivableService.getBySaleId(v.id)! }; })();
    const pay=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'CASH', amountCents:3000, receivedBy:'Op'});
    caixaService.fecharCaixa({countedAmountCents: caixaService.getCaixaAtual()!.expectedAmountCents});
    expect(()=> receivableService.reverseAccountReceivablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'})).toThrow(/caixa já fechado/);
  });

  it('97. DUPLO ESTORNO bloqueado',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:4000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const pay=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'PIX', amountCents:4000, paidBy:'Op'});
    payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'});
    expect(()=> payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'})).toThrow(/já foi estornado/);
  });

  it('98. CONCORRÊNCIA estorno',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:4000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const pay=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'PIX', amountCents:4000, paidBy:'Op'});
    payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'A', reversedBy:'Op'});
    expect(()=> payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'B', reversedBy:'Op2'})).toThrow(/já foi estornado/);
  });

  it('99. PAYMENT ORIGINAL PRESERVADO',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:6000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const pay=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'CASH', amountCents:6000, paidBy:'Op'});
    const originalAmount=pay.payment.amountCents;
    payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'});
    const original=db.accountPayablePayments.find(p=>p.id===pay.payment.id);
    expect(original!.amountCents).toBe(originalAmount);
    expect(original!.paymentMethod).toBe('CASH');
  });

  it('100. CASH MOVEMENT ORIGINAL PRESERVADO',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:6000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const pay=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'CASH', amountCents:6000, paidBy:'Op'});
    const origMovId=pay.payment.cashMovementId!;
    const origMov=db.movimentacoesCaixa.find(m=>m.id===origMovId);
    payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'});
    const stillOrig=db.movimentacoesCaixa.find(m=>m.id===origMovId);
    expect(stillOrig).toBeDefined();
    expect(stillOrig!.amountCents).toBe(6000);
    const compMov=db.movimentacoesCaixa.find(m=> m.type==='PAYABLE_PAYMENT_REVERSAL');
    expect(compMov).toBeDefined();
  });

  it('101. TOTAL PAGO efetivo',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:10000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const p1=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'PIX', amountCents:3000, paidBy:'Op'});
    const p2=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'CASH', amountCents:2000, paidBy:'Op'});
    const p3=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'BANK_TRANSFER', amountCents:1000, paidBy:'Op'});
    payableService.reverseAccountPayablePayment({paymentId: p2.payment.id, reason:'Outro', reversedBy:'Op'});
    expect(getPaidCents(payable.id)).toBe(4000); // 3000+1000
  });

  it('103. RESUMO PAYABLE após estorno',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:10000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const pay=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'PIX', amountCents:6000, paidBy:'Op'});
    expect(payableService.getSummary().totalOpenCents).toBe(4000);
    payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'});
    expect(payableService.getSummary().totalOpenCents).toBe(10000);
  });

  it('104. RESUMO RECEIVABLE após estorno',()=>{
    const { receivable } = (()=>{ const v=vendaService.finalizarVenda({subtotal:100, desconto:0, total:100, itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}], pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}], sessaoCaixaId: sessaoId, clienteId, dueDate: addDays(toISODate(new Date()),5)}); return { receivable: receivableService.getBySaleId(v.id)! }; })();
    const pay=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:4000, receivedBy:'Op'});
    expect(receivableService.getSummary().totalOpenCents).toBe(6000);
    receivableService.reverseAccountReceivablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'});
    expect(receivableService.getSummary().totalOpenCents).toBe(10000);
  });

  it('105. SALE CANCEL BLOCK quando tem recebimento efetivo',()=>{
    const { venda, receivable } = (()=>{ const v=vendaService.finalizarVenda({subtotal:100, desconto:0, total:100, itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}], pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}], sessaoCaixaId: sessaoId, clienteId, dueDate: addDays(toISODate(new Date()),5)}); return { venda: v, receivable: receivableService.getBySaleId(v.id)! }; })();
    receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:5000, receivedBy:'Op'});
    expect(()=> vendaService.cancelarVenda(venda.id, 'Teste', 'Op')).toThrow(/já possui recebimentos/);
  });

  it('106. SALE após reversal permite cancel (se OPEN)',()=>{
    const { venda, receivable } = (()=>{ const v=vendaService.finalizarVenda({subtotal:100, desconto:0, total:100, itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}], pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}], sessaoCaixaId: sessaoId, clienteId, dueDate: addDays(toISODate(new Date()),5)}); return { venda: v, receivable: receivableService.getBySaleId(v.id)! }; })();
    const pay=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:5000, receivedBy:'Op'});
    receivableService.reverseAccountReceivablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'});
    // agora effective 0, deve permitir cancel
    const result=vendaService.cancelarVenda(venda.id, 'Teste', 'Op');
    expect(result.vendaId).toBe(venda.id);
    expect(receivableService.getById(receivable.id)!.status).toBe('CANCELLED');
  });

  it('107. PAYABLE CANCEL após estorno permite',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:6000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const pay=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'PIX', amountCents:6000, paidBy:'Op'});
    // não pode cancelar enquanto tem pagamento efetivo
    expect(()=> payableService.cancelPayable(payable.id, {reason:'Outro', cancelledBy:'Op'})).toThrow(/já possui pagamentos|já paga/);
    payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'});
    expect(payableService.getById(payable.id)!.status).toBe('OPEN');
    const cancelled=payableService.cancelPayable(payable.id, {reason:'Outro', cancelledBy:'Op'});
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('108. ESTOQUE inalterado',()=>{
    const before=db.produtos.find(p=>p.id==='p1')!.estGeral;
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:10000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const pay=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'PIX', amountCents:1000, paidBy:'Op'});
    payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'});
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(before);
    const { receivable } = (()=>{ const v=vendaService.finalizarVenda({subtotal:100, desconto:0, total:100, itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}], pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}], sessaoCaixaId: sessaoId, clienteId, dueDate: addDays(toISODate(new Date()),5)}); return { receivable: receivableService.getBySaleId(v.id)! }; })();
    const pay2=receivableService.receiveAccountReceivable({accountReceivableId: receivable.id, paymentMethod:'PIX', amountCents:1000, receivedBy:'Op'});
    const before2=db.produtos.find(p=>p.id==='p1')!.estGeral;
    receivableService.reverseAccountReceivablePayment({paymentId: pay2.payment.id, reason:'Outro', reversedBy:'Op'});
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(before2);
  });

  it('111. TRANSAÇÃO CASH falha rollback',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:5000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const pay=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'CASH', amountCents:5000, paidBy:'Op'});
    const origPush=(db.movimentacoesCaixa as any).push;
    (db.movimentacoesCaixa as any).push=()=>{ throw new Error('Falha'); };
    expect(()=> payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'})).toThrow(/Falha/);
    expect(getPaidCents(payable.id)).toBe(5000);
    expect(payableService.getById(payable.id)!.status).toBe('PAID');
    (db.movimentacoesCaixa as any).push=origPush;
  });

  it('112. ROUND TRIP',()=>{
    const payable=payableService.createManual({supplierId:fornecedorId, description:'Teste', amountCents:10000, dueDate: toISODate(new Date()), createdBy:'Op'});
    const pay=payableService.payAccountPayable({accountPayableId: payable.id, paymentMethod:'CASH', amountCents:4000, paidBy:'Op'});
    const rev=payableService.reverseAccountPayablePayment({paymentId: pay.payment.id, reason:'Outro', reversedBy:'Op'});
    expect(db.accountPayablePaymentReversals.find(r=> r.id===rev.reversal.id)).toBeDefined();
    expect(payableService.getById(payable.id)!.status).toBe('OPEN');
    expect(db.movimentacoesCaixa.some(m=> m.type==='PAYABLE_PAYMENT_REVERSAL')).toBe(true);
  });
});
