import { describe, it, beforeEach, expect } from 'vitest';
import { AccountPayableService, getPaidCents, getRemainingCents } from '../services/AccountPayableService';
import { FornecedorService } from '../services/FornecedorService';
import { CaixaService } from '../services/CaixaService';
import { db } from '../db';

function toISODate(d: Date){ return d.toISOString().slice(0,10); }
function addDays(s:string, days:number){ const d=new Date(s+'T12:00:00'); d.setDate(d.getDate()+days); return toISODate(d); }

describe('ETAPA 14 - Pagamento Parcial', ()=>{
  let payableService: AccountPayableService;
  let fornecedorService: FornecedorService;
  let caixaService: CaixaService;
  let fornecedorId:string;

  beforeEach(()=>{
    payableService=new AccountPayableService();
    fornecedorService=new FornecedorService();
    caixaService=new CaixaService();
    db.accountsPayable=[];
    db.accountPayablePayments=[];
    db.movimentacoesCaixa=[];
    db.sessoesCaixa=[];
    db.vendas=[];
    (db as any)._payableCounter=0;
    (db as any)._payablePaymentCounter=0;
    db.fornecedores=[];
    db.produtos=[{id:'p1',codigo:'001',nome:'Copo',barra:'111',valor:10,custo:4,estGeral:100,imagem:''}];
    const f=fornecedorService.criarFornecedor({tipoPessoa:'PJ',documento:'00.000.000/0001-91',razaoSocial:'Fornecedor Teste'});
    fornecedorId=f.id;
  });

  function createPayable(amount=10000, dueDate='2026-12-01'){
    return payableService.createManual({supplierId:fornecedorId,description:'Teste',amountCents:amount,dueDate,createdBy:'Op'});
  }

  it('65. TESTE — PAGAMENTO PARCIAL PIX',()=>{
    const payable=createPayable(10000);
    const result=payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:4000,paidBy:'Op'});
    expect(result.payable.status).toBe('PARTIALLY_PAID');
    expect(getPaidCents(payable.id)).toBe(4000);
    expect(getRemainingCents(payable)).toBe(6000);
  });

  it('66. TESTE — SEGUNDO PAGAMENTO',()=>{
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:4000,paidBy:'Op'});
    const result=payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:3000,paidBy:'Op'});
    expect(result.payable.status).toBe('PARTIALLY_PAID');
    expect(getPaidCents(payable.id)).toBe(7000);
    expect(getRemainingCents(payable)).toBe(3000);
  });

  it('67. TESTE — QUITAÇÃO',()=>{
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:4000,paidBy:'Op'});
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:3000,paidBy:'Op'});
    const result=payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:3000,paidBy:'Op'});
    expect(result.payable.status).toBe('PAID');
    expect(getPaidCents(payable.id)).toBe(10000);
    expect(getRemainingCents(payable)).toBe(0);
  });

  it('68. TESTE — CASH PARCIAL',()=>{
    caixaService.abrirCaixa({terminal:'T1',openedBy:'Op',openingAmountCents:5000});
    const payable=createPayable(10000);
    const result=payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'CASH',amountCents:3000,paidBy:'Op'});
    expect(result.payable.status).toBe('PARTIALLY_PAID');
    expect(getRemainingCents(payable)).toBe(7000);
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(2000);
  });

  it('69. TESTE — PIX + CASH',()=>{
    caixaService.abrirCaixa({terminal:'T1',openedBy:'Op',openingAmountCents:10000});
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:4000,paidBy:'Op'});
    const result=payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'CASH',amountCents:6000,paidBy:'Op'});
    expect(result.payable.status).toBe('PAID');
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(4000);
  });

  it('70. TESTE — CASH + TRANSFER',()=>{
    caixaService.abrirCaixa({terminal:'T1',openedBy:'Op',openingAmountCents:10000});
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'CASH',amountCents:3000,paidBy:'Op'});
    const result=payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'BANK_TRANSFER',amountCents:7000,paidBy:'Op'});
    expect(result.payable.status).toBe('PAID');
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(7000);
  });

  it('71. TESTE — ACIMA DO SALDO DA CONTA',()=>{
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:8000,paidBy:'Op'});
    expect(()=>payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:2001,paidBy:'Op'})).toThrow(/maior que o saldo restante/);
    expect(getPaidCents(payable.id)).toBe(8000);
  });

  it('72. TESTE — ZERO',()=>{
    const payable=createPayable(10000);
    expect(()=>payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:0,paidBy:'Op'})).toThrow(/maior que zero/);
  });

  it('73. TESTE — NEGATIVO',()=>{
    const payable=createPayable(10000);
    expect(()=>payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:-100,paidBy:'Op'})).toThrow(/maior que zero/);
  });

  it('74. TESTE — SALDO DE CAIXA INSUFICIENTE',()=>{
    caixaService.abrirCaixa({terminal:'T1',openedBy:'Op',openingAmountCents:3000});
    const payable=createPayable(10000);
    expect(()=>payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'CASH',amountCents:4000,paidBy:'Op'})).toThrow(/Saldo insuficiente/);
    expect(getPaidCents(payable.id)).toBe(0);
    expect(payableService.getById(payable.id)!.status).toBe('OPEN');
  });

  it('75. TESTE — SEM CAIXA CASH falha mas PIX passa',()=>{
    const payable=createPayable(10000);
    expect(()=>payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'CASH',amountCents:1000,paidBy:'Op'})).toThrow(/Abra o caixa/);
    const result=payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:1000,paidBy:'Op'});
    expect(result.payable.status).toBe('PARTIALLY_PAID');
  });

  it('76. TESTE — QUITAÇÃO EXATA',()=>{
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:6250,paidBy:'Op'});
    const remaining=getRemainingCents(payable);
    expect(remaining).toBe(3750);
    const result=payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:3750,paidBy:'Op'});
    expect(result.payable.status).toBe('PAID');
    expect(getRemainingCents(payable)).toBe(0);
  });

  it('77. TESTE — CONCORRÊNCIA dois que excedem',()=>{
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:6000,paidBy:'A'});
    // saldo restante 4000, tentar 5000 deve falhar
    expect(()=>payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:5000,paidBy:'B'})).toThrow(/maior que o saldo restante/);
    expect(getPaidCents(payable.id)).toBe(6000);
    // tentar 4000 deve passar e quitar
    const result=payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:4000,paidBy:'B'});
    expect(result.payable.status).toBe('PAID');
  });

  it('78. TESTE — CANCELAMENTO PARCIAL bloqueado',()=>{
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:1000,paidBy:'Op'});
    expect(()=>payableService.cancelPayable(payable.id,{reason:'Outro',cancelledBy:'Op'})).toThrow(/já possui pagamentos/);
    expect(payableService.getById(payable.id)!.status).toBe('PARTIALLY_PAID');
  });

  it('79. TESTE — EDIÇÃO DE VALOR bloqueada após pagamento',()=>{
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:1000,paidBy:'Op'});
    expect(()=>payableService.updateOpenPayable(payable.id,{amountCents:12000})).toThrow(/Não é possível alterar o valor/);
    expect(payableService.getById(payable.id)!.amountCents).toBe(10000);
  });

  it('80. TESTE — RESUMO por saldo restante',()=>{
    const pA=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:pA.id,paymentMethod:'PIX',amountCents:4000,paidBy:'Op'});
    const pB=createPayable(5000);
    const summary=payableService.getSummary();
    expect(summary.totalOpenCents).toBe(11000); // 6000 +5000
  });

  it('81. TESTE — VENCIDA PARCIAL saldo restante',()=>{
    const yesterday=addDays(toISODate(new Date()),-1);
    const payable=createPayable(10000, yesterday);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:6000,paidBy:'Op'});
    const summary=payableService.getSummary();
    expect(summary.overdueCents).toBe(4000);
    expect(summary.totalOpenCents).toBe(4000);
  });

  it('82. TESTE — CASH SUMMARY múltiplos parciais',()=>{
    caixaService.abrirCaixa({terminal:'T1',openedBy:'Op',openingAmountCents:10000});
    // venda cash 20000
    db.vendas.push({
      id:'v1',data:new Date().toISOString(),subtotal:200,desconto:0,total:200,
      itens:[],status:'COMPLETED',sessaoCaixaId:db.sessoesCaixa[0].id,
      pagamentos:[{id:'p1',vendaId:'v1',metodo:'CASH',valorCentavos:20000,valorRecebidoCentavos:20000,trocoCentavos:0,installments:1}]
    } as any);
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'CASH',amountCents:3000,paidBy:'Op'});
    const payable2=createPayable(5000);
    payableService.payAccountPayable({accountPayableId:payable2.id,paymentMethod:'PIX',amountCents:5000,paidBy:'Op'});
    // saldo físico: 10000+20000-3000=27000 (PIX não conta)
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(27000);
  });

  it('83. TESTE — MÚLTIPLOS CASH movimentos',()=>{
    caixaService.abrirCaixa({terminal:'T1',openedBy:'Op',openingAmountCents:10000});
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'CASH',amountCents:1000,paidBy:'Op'});
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'CASH',amountCents:2000,paidBy:'Op'});
    const movs=db.movimentacoesCaixa.filter(m=>m.type==='PAYABLE_PAYMENT');
    expect(movs.length).toBe(2);
    expect(movs.reduce((s,m)=>s+m.amountCents,0)).toBe(3000);
  });

  it('84. TESTE — TRANSAÇÃO falha rollback',()=>{
    caixaService.abrirCaixa({terminal:'T1',openedBy:'Op',openingAmountCents:10000});
    const payable=createPayable(10000);
    const origPush=(db.movimentacoesCaixa as any).push;
    (db.movimentacoesCaixa as any).push=()=>{ throw new Error('Falha simulada'); };
    expect(()=>payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'CASH',amountCents:1000,paidBy:'Op'})).toThrow(/Falha simulada/);
    expect(getPaidCents(payable.id)).toBe(0);
    expect(payableService.getById(payable.id)!.status).toBe('OPEN');
    (db.movimentacoesCaixa as any).push=origPush;
  });

  it('85. TESTE — ROUND TRIP parcial',()=>{
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:4000,paidBy:'Op'});
    const reloaded=payableService.getById(payable.id)!;
    expect(reloaded.status).toBe('PARTIALLY_PAID');
    expect(getPaidCents(payable.id)).toBe(4000);
    expect(getRemainingCents(reloaded)).toBe(6000);
    expect(payableService.getPaymentsByPayableId(payable.id).length).toBe(1);
  });

  it('Valor integral continua funcionando',()=>{
    const payable=createPayable(10000);
    const result=payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:10000,paidBy:'Op'});
    expect(result.payable.status).toBe('PAID');
    expect(getRemainingCents(payable)).toBe(0);
  });

  it('OPEN -> PAID direto',()=>{
    const payable=createPayable(10000);
    const result=payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:10000,paidBy:'Op'});
    expect(result.payable.status).toBe('PAID');
  });

  it('PARTIALLY_PAID continua aceitando',()=>{
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:3000,paidBy:'Op'});
    expect(payableService.getById(payable.id)!.status).toBe('PARTIALLY_PAID');
    const result2=payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:2000,paidBy:'Op'});
    expect(result2.payable.status).toBe('PARTIALLY_PAID');
    expect(getPaidCents(payable.id)).toBe(5000);
  });

  it('Imutabilidade pagamentos',()=>{
    const payable=createPayable(10000);
    const result=payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:4000,paidBy:'Op'});
    const paymentId=result.payment.id;
    // não existe edição de pagamento, garantir que não há método para editar
    expect((payableService as any).updatePayment).toBeUndefined();
    // tentar alterar pagamento diretamente não deve ser permitido via serviço
    expect(db.accountPayablePayments.find(p=>p.id===paymentId)!.amountCents).toBe(4000);
  });

  it('Preservação dados anteriores PAID',()=>{
    const payable=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:payable.id,paymentMethod:'PIX',amountCents:10000,paidBy:'Op'});
    const reloaded=payableService.getById(payable.id)!;
    expect(reloaded.status).toBe('PAID');
    expect(getPaidCents(payable.id)).toBe(10000);
    expect(getRemainingCents(reloaded)).toBe(0);
  });

  it('Filtro Parcialmente pagas',()=>{
    const pOpen=createPayable(10000);
    const pPartial=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:pPartial.id,paymentMethod:'PIX',amountCents:3000,paidBy:'Op'});
    const pPaid=createPayable(10000);
    payableService.payAccountPayable({accountPayableId:pPaid.id,paymentMethod:'PIX',amountCents:10000,paidBy:'Op'});
    const res=payableService.search({statusFilter:'PARTIALLY_PAID'});
    expect(res.length).toBe(1);
    expect(res[0].id).toBe(pPartial.id);
  });
});
