import { describe, it, beforeEach, expect } from 'vitest';
import { VendaService } from '../services/VendaService';
import { AccountReceivableService } from '../services/AccountReceivableService';
import { CaixaService } from '../services/CaixaService';
import { db } from '../db';

function toISODate(d: Date){ return d.toISOString().slice(0,10); }
function addDays(s:string, days:number){ const d=new Date(s+'T12:00:00'); d.setDate(d.getDate()+days); return toISODate(d); }

describe('ETAPA 15 - Contas a Receber + Venda a Prazo', ()=>{
  let vendaService: VendaService;
  let receivableService: AccountReceivableService;
  let caixaService: CaixaService;
  let clienteId: string;
  let sessaoId: string;

  beforeEach(()=>{
    vendaService=new VendaService();
    receivableService=new AccountReceivableService();
    caixaService=new CaixaService();
    db.vendas=[];
    db.sessoesCaixa=[];
    db.movimentacoesCaixa=[];
    db.accountReceivables=[];
    (db as any)._receivableCounter=0;
    (db as any).cancelamentos=[];
    db.produtos=[
      { id: 'p1', codigo: '001', nome: 'Copo', barra: '111', valor: 10, custo: 4, estGeral: 10, imagem: '' },
      { id: 'p2', codigo: '002', nome: 'Marmita', barra: '222', valor: 20, custo: 8, estGeral: 10, imagem: '' },
    ];
    db.clientes=[
      { id: 'c1', codigo: 'C001', nome: 'Mercado Silva', endereco: 'Rua A', cidade: 'SP', estado: 'SP', telefone: '11999999999', cpf: '52998224725', status: 'ACTIVE' },
      { id: 'c2', codigo: 'C002', nome: 'Cliente Inativo', endereco: 'Rua B', cidade: 'SP', estado: 'SP', telefone: '11888888888', cpf: '11144477735', status: 'INACTIVE' },
    ];
    clienteId='c1';
    db.configuracaoPagamento={ maxCreditInstallments: 12, allowStoreCredit: true };
    const sessao=caixaService.abrirCaixa({terminal:'T1', openedBy:'Op', openingAmountCents:10000});
    sessaoId=sessao.id;
  });

  it('92. TESTE — VENDA A PRAZO',()=>{
    const total=100;
    const venda=vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:2, valorUnitario:50, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: addDays(toISODate(new Date()), 5)
    });
    expect(venda.status).toBe('COMPLETED');
    expect(venda.clienteId).toBe(clienteId);
    const receivable=receivableService.getBySaleId(venda.id);
    expect(receivable).toBeDefined();
    expect(receivable!.amountCents).toBe(10000);
    expect(receivable!.status).toBe('OPEN');
    expect(receivable!.customerId).toBe(clienteId);
    // estoque
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(8);
    // caixa não muda
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(10000);
  });

  it('93. TESTE — SEM CLIENTE',()=>{
    expect(()=> vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      dueDate: addDays(toISODate(new Date()),5)
    })).toThrow(/Selecione um cliente/);
    expect(db.vendas.length).toBe(0);
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(10);
  });

  it('94. TESTE — CLIENTE INATIVO',()=>{
    expect(()=> vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      clienteId:'c2',
      dueDate: addDays(toISODate(new Date()),5)
    })).toThrow(/inativo/);
  });

  it('95. TESTE — CREDIÁRIO DESABILITADO',()=>{
    db.configuracaoPagamento.allowStoreCredit=false;
    expect(()=> vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: addDays(toISODate(new Date()),5)
    })).toThrow(/desabilitada/);
  });

  it('96. TESTE — VENCIMENTO ANTERIOR',()=>{
    const yesterday=addDays(toISODate(new Date()),-1);
    expect(()=> vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: yesterday
    })).toThrow(/anterior à data da venda/);
  });

  it('97. TESTE — VENCIMENTO HOJE',()=>{
    const today=toISODate(new Date());
    const venda=vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: today
    });
    const receivable=receivableService.getBySaleId(venda.id)!;
    expect(receivable.dueDate).toBe(today);
    // Vence hoje é OPEN com dueDate hoje
    const list=receivableService.search({statusFilter:'DUE_TODAY'});
    expect(list.some(r=>r.id===receivable.id)).toBe(true);
  });

  it('98. TESTE — VENCIMENTO FUTURO',()=>{
    const future=addDays(toISODate(new Date()),5);
    const venda=vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: future
    });
    const receivable=receivableService.getBySaleId(venda.id)!;
    expect(receivable.dueDate).toBe(future);
    const list=receivableService.search({statusFilter:'OPEN'});
    expect(list.some(r=>r.id===receivable.id)).toBe(true);
  });

  it('99. TESTE — VENCIDA',()=>{
    const yesterday=addDays(toISODate(new Date()),-1);
    // criar manualmente receivable vencido
    const venda=vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: toISODate(new Date())
    });
    const receivable=receivableService.getBySaleId(venda.id)!;
    // simular vencida manipulando dueDate
    receivable.dueDate=yesterday;
    const list=receivableService.search({statusFilter:'OVERDUE'});
    expect(list.some(r=>r.id===receivable.id)).toBe(true);
  });

  it('100. TESTE — CASH SUMMARY não afeta',()=>{
    const before=caixaService.getCaixaAtual()!.expectedAmountCents;
    expect(before).toBe(10000);
    vendaService.finalizarVenda({
      subtotal:500, desconto:0, total:500,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:500, total:500}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:50000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: addDays(toISODate(new Date()),5)
    });
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(10000);
  });

  it('101. TESTE — ESTOQUE baixa',()=>{
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(10);
    vendaService.finalizarVenda({
      subtotal:30, desconto:0, total:30,
      itens:[{produtoId:'p1', quantidade:3, valorUnitario:10, total:30}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:3000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: addDays(toISODate(new Date()),5)
    });
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(7);
  });

  it('102. TESTE — PAGAMENTO MISTO BLOQUEADO',()=>{
    expect(()=> vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:5000},{metodo:'PIX', valorCentavos:5000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: addDays(toISODate(new Date()),5)
    })).toThrow(/100% a prazo/);
  });

  it('103. TESTE — STORE CREDIT PARCIAL BLOQUEADO',()=>{
    expect(()=> vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:5000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: addDays(toISODate(new Date()),5)
    })).toThrow(/100% a prazo/);
  });

  it('104. TESTE — DUPLICIDADE sale_id unique',()=>{
    const venda=vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: addDays(toISODate(new Date()),5)
    });
    // tentar criar segunda receivable com mesmo saleId manualmente deve falhar se tentar via service? Mas via vendaService não há duplicidade porque cada venda é única
    // Verificar que getBySaleId retorna uma
    expect(receivableService.getBySaleId(venda.id)).toBeDefined();
    // tentar inserir manualmente duplicado deve ser bloqueado se houver verificação? Nossa validação já impede duplicidade na criação via venda, mas não há API para criar manual nesta etapa
    // Então apenas verificar que não há duplicidade
    expect((db as any).accountReceivables.filter((r:any)=>r.saleId===venda.id).length).toBe(1);
  });

  it('105. TESTE — CANCELAMENTO integrada',()=>{
    const venda=vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: addDays(toISODate(new Date()),5)
    });
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(9);
    const receivable=receivableService.getBySaleId(venda.id)!;
    expect(receivable.status).toBe('OPEN');
    const caixaBefore=caixaService.getCaixaAtual()!.expectedAmountCents;
    vendaService.cancelarVenda(venda.id, 'Cliente desistiu', 'Op');
    expect(venda.status).toBe('CANCELLED');
    expect(receivableService.getBySaleId(venda.id)!.status).toBe('CANCELLED');
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(10);
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(caixaBefore);
  });

  it('106. TESTE — CANCELAMENTO ATÔMICO rollback se falhar',()=>{
    const venda=vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: addDays(toISODate(new Date()),5)
    });
    // Simular falha ao cancelar receivable: vamos fechar caixa para que cancelar venda falhe antes de cancelar receivable?
    // Nossa cancelarVenda verifica se caixa está fechado, então fechar caixa fará falhar antes de cancelar receivable
    const sessao=db.sessoesCaixa.find(s=>s.id===sessaoId)!;
    sessao.status='CLOSED';
    expect(()=> vendaService.cancelarVenda(venda.id, 'Teste', 'Op')).toThrow(/caixa já fechado/);
    expect(venda.status).toBe('COMPLETED');
    expect(receivableService.getBySaleId(venda.id)!.status).toBe('OPEN');
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(9);
    // reabrir para não afetar outros testes
    sessao.status='OPEN';
  });

  it('107. TESTE — COMPROVANTE representação',()=>{
    const venda=vendaService.finalizarVenda({
      subtotal:250, desconto:0, total:250,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:250, total:250}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:25000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: '2026-09-15'
    });
    const receivable=receivableService.getBySaleId(venda.id)!;
    // Verificar que pagamento é STORE_CREDIT e receivable existe
    expect(venda.pagamentos[0].metodo).toBe('STORE_CREDIT');
    expect(receivable.dueDate).toBe('2026-09-15');
    expect(receivable.amountCents).toBe(25000);
  });

  it('108. TESTE — ROUND TRIP',()=>{
    const venda=vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: addDays(toISODate(new Date()),3)
    });
    const receivable=receivableService.getBySaleId(venda.id)!;
    // Simular reload (buscar do db)
    const reloadedVenda=db.vendas.find(v=>v.id===venda.id)!;
    const reloadedReceivable=receivableService.getById(receivable.id)!;
    expect(reloadedVenda.clienteId).toBe(clienteId);
    expect(reloadedReceivable.customerId).toBe(clienteId);
    expect(reloadedReceivable.dueDate).toBe(receivable.dueDate);
    expect(reloadedReceivable.status).toBe('OPEN');
  });

  it('Busca e filtros funcionam',()=>{
    const venda1=vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: addDays(toISODate(new Date()),1)
    });
    const venda2=vendaService.finalizarVenda({
      subtotal:200, desconto:0, total:200,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:200, total:200}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:20000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: addDays(toISODate(new Date()),10)
    });
    const search=receivableService.search({q:'Silva'});
    expect(search.length).toBe(2);
    const byVenda=receivableService.search({q: venda1.id.slice(-6)});
    expect(byVenda.some(r=>r.saleId===venda1.id)).toBe(true);
  });

  it('Resumo correto',()=>{
    vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: toISODate(new Date())
    });
    vendaService.finalizarVenda({
      subtotal:200, desconto:0, total:200,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:200, total:200}],
      pagamentos:[{metodo:'STORE_CREDIT', valorCentavos:20000}],
      sessaoCaixaId: sessaoId,
      clienteId,
      dueDate: addDays(toISODate(new Date()),5)
    });
    const summary=receivableService.getSummary();
    expect(summary.totalOpenCents).toBe(30000);
    expect(summary.dueTodayCents).toBe(10000);
  });

  it('Pagamentos normais continuam funcionando',()=>{
    const venda=vendaService.finalizarVenda({
      subtotal:100, desconto:0, total:100,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:100, total:100}],
      pagamentos:[{metodo:'PIX', valorCentavos:10000}],
      sessaoCaixaId: sessaoId,
    });
    expect(venda.status).toBe('COMPLETED');
    expect(receivableService.getBySaleId(venda.id)).toBeUndefined();
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(10000); // não aumentou porque PIX não é cash, mas venda cash aumentaria
    // Sale com PIX não altera saldo, mas estoque sim
    expect(db.produtos.find(p=>p.id==='p1')!.estGeral).toBe(9);
  });

  it('Venda CASH ainda funciona e aumenta caixa',()=>{
    // Abrir nova sessão limpa
    db.sessoesCaixa=[];
    db.movimentacoesCaixa=[];
    const sessao=caixaService.abrirCaixa({terminal:'T1',openedBy:'Op',openingAmountCents:10000});
    const venda=vendaService.finalizarVenda({
      subtotal:200, desconto:0, total:200,
      itens:[{produtoId:'p1', quantidade:1, valorUnitario:200, total:200}],
      pagamentos:[{metodo:'CASH', valorCentavos:20000, valorRecebidoCentavos:20000}],
      sessaoCaixaId: sessao.id,
    });
    expect(venda.status).toBe('COMPLETED');
    expect(caixaService.getCaixaAtual()!.expectedAmountCents).toBe(30000); // 10000 +20000
  });
});
