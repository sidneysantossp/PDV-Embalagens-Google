import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type { Produto, Cliente, Venda, VendaItem } from './src/types';
import { db } from './src/db';
import { CaixaService } from './src/services/CaixaService';
import { VendaService } from './src/services/VendaService';
import { FornecedorService } from './src/services/FornecedorService';
import { PurchaseOrderService } from './src/services/PurchaseOrderService';
import { PurchaseReceiptService } from './src/services/PurchaseReceiptService';
import { AccountPayableService } from './src/services/AccountPayableService';
import { AccountReceivableService } from './src/services/AccountReceivableService';
import { StockService } from './src/services/StockService';
import { LowStockService } from './src/services/LowStockService';

const caixaService = new CaixaService();
const vendaService = new VendaService();
const fornecedorService = new FornecedorService();
const purchaseOrderService = new PurchaseOrderService();
const purchaseReceiptService = new PurchaseReceiptService();
const accountPayableService = new AccountPayableService();
const accountReceivableService = new AccountReceivableService();
const stockService = new StockService();
const lowStockService = new LowStockService();

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  app.get('/api/produtos', (req, res) => {
    res.json(db.produtos);
  });
  app.put('/api/produtos/:id/minimum-stock', (req, res) => {
    try { res.json(lowStockService.setMinimum(req.params.id, Number(req.body.minimumStockQuantity))); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.get('/api/clientes', (req, res) => {
    res.json(db.clientes);
  });
  app.post('/api/clientes', (req, res) => {
    const novo: Cliente = { id: Date.now().toString(), ...req.body };
    db.clientes.push(novo);
    res.json(novo);
  });

  app.get('/api/config/pagamento', (req, res) => {
    res.json(db.configuracaoPagamento);
  });

  app.put('/api/config/pagamento', (req, res) => {
    const { maxCreditInstallments, allowStoreCredit } = req.body;
    if (maxCreditInstallments !== undefined) {
      if (typeof maxCreditInstallments !== 'number' || maxCreditInstallments < 1 || maxCreditInstallments > 12) {
        return res.status(400).json({ error: 'maxCreditInstallments deve ser um número entre 1 e 12' });
      }
      db.configuracaoPagamento.maxCreditInstallments = maxCreditInstallments;
    }
    if (allowStoreCredit !== undefined) {
      db.configuracaoPagamento.allowStoreCredit = Boolean(allowStoreCredit);
    }
    res.json(db.configuracaoPagamento);
  });

  // Módulo C - Vendas / PDV
  app.post('/api/vendas', (req, res) => {
    try {
      const venda = vendaService.finalizarVenda(req.body);
      res.json(venda);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
  
  app.post('/api/vendas/:id/cancelar', (req, res) => {
    try {
      const { motivo, operador, observacao } = req.body;
      const cancelamento = vendaService.cancelarVenda(req.params.id, motivo, operador, observacao);
      res.json(cancelamento);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
  
  app.get('/api/vendas', (req, res) => {
    // Retorna as 50 vendas mais recentes com os cancelamentos (se houver)
    const vendasCompletas = db.vendas.map(v => {
      const cancelamento = (db as any).cancelamentos?.find((c: any) => c.vendaId === v.id);
      return { ...v, cancelamento };
    }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 50);
    res.json(vendasCompletas);
  });

  // Módulo D - Financeiro / Caixa
  app.get('/api/caixa/atual', (req, res) => {
    try {
      res.json(caixaService.getCaixaAtual());
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/caixa/movimentacao', (req, res) => {
    try {
      const mov = caixaService.registrarMovimentacao(req.body);
      res.json(mov);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/caixa/abrir', (req, res) => {
    try {
      const sessao = caixaService.abrirCaixa(req.body);
      res.json(sessao);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/caixa/fechar', (req, res) => {
    try {
      const sessao = caixaService.fecharCaixa(req.body);
      res.json(sessao);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/caixa/historico', (req, res) => {
    try {
      res.json(caixaService.getHistorico().slice(0, 20));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Módulo E - Fornecedores (movido antes do Vite)
  app.get('/api/fornecedores', (req, res) => {
    res.json(db.fornecedores);
  });

  app.post('/api/fornecedores', (req, res) => {
    try {
      const result = fornecedorService.criarFornecedor(req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put('/api/fornecedores/:id', (req, res) => {
    try {
      const result = fornecedorService.editarFornecedor(req.params.id, req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch('/api/fornecedores/:id/status', (req, res) => {
    try {
      const result = fornecedorService.setStatus(req.params.id, req.body.status);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/fornecedores/:id/produtos', (req, res) => {
    const vinculados = db.fornecedorProdutos.filter(fp => fp.supplierId === req.params.id);
    const result = vinculados.map(fp => {
      const produto = db.produtos.find(p => p.id === fp.productId);
      return { ...fp, produto };
    }).filter(fp => fp.produto);
    res.json(result);
  });

  app.post('/api/fornecedores/:id/produtos', (req, res) => {
    try {
      const result = fornecedorService.vincularProduto(req.params.id, req.body.productId, req.body.supplierProductCode);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/fornecedores/:id/produtos/:productId', (req, res) => {
    try {
      fornecedorService.desvincularProduto(req.params.id, req.params.productId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ===== Módulo Compras - Pedido de Compra + Recebimento (ETAPA 11) =====
  app.get('/api/purchase-orders', (req, res) => {
    try {
      const orders = purchaseOrderService.listPurchaseOrders();
      // enriched with progress
      const enriched = orders.map(o => {
        try { return purchaseOrderService.getEnrichedOrder(o.id); } catch { return o; }
      });
      res.json(enriched);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/purchase-orders/:id', (req, res) => {
    try {
      const enriched = purchaseOrderService.getEnrichedOrder(req.params.id);
      // also include supplier info
      const supplier = db.fornecedores.find(f => f.id === enriched.supplierId);
      res.json({ ...enriched, supplier });
    } catch (e: any) { res.status(404).json({ error: e.message }); }
  });

  app.post('/api/purchase-orders', (req, res) => {
    try {
      const order = purchaseOrderService.createPurchaseOrder(req.body);
      res.json(order);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/purchase-orders/:id/order', (req, res) => {
    try {
      const order = purchaseOrderService.orderPurchaseOrder(req.params.id);
      res.json(order);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/purchase-orders/:id/cancel', (req, res) => {
    try {
      const order = purchaseOrderService.cancelPurchaseOrder(req.params.id);
      res.json(order);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Recebimento
  app.post('/api/purchase-orders/:id/receive', (req, res) => {
    try {
      const receipt = purchaseReceiptService.receivePurchaseOrder({
        purchaseOrderId: req.params.id,
        items: req.body.items,
        notes: req.body.notes,
        receivedBy: req.body.receivedBy || req.body.received_by || 'Operador',
      });
      // return enriched receipt + new order status
      const order = purchaseOrderService.getPurchaseOrderById(req.params.id);
      res.json({
        receipt,
        newOrderStatus: order?.status,
        purchaseOrderId: order?.id,
        receiptNumber: receipt.receiptNumber,
        totalReceivedCents: receipt.totalReceivedCents,
      });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/purchase-orders/:id/receipts', (req, res) => {
    try {
      const receipts = purchaseReceiptService.getReceiptsByOrder(req.params.id);
      res.json(receipts);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/purchase-receipts/:id', (req, res) => {
    try {
      const receipt = purchaseReceiptService.getReceiptById(req.params.id);
      if (!receipt) throw new Error('Recebimento não encontrado.');
      const order = db.purchaseOrders.find(o => o.id === receipt.purchaseOrderId);
      const supplier = db.fornecedores.find(f => f.id === receipt.supplierId);
      res.json({ ...receipt, purchaseOrder: order, supplier });
    } catch (e: any) { res.status(404).json({ error: e.message }); }
  });

  // Estoque - movimentos e produto com histórico
  app.get('/api/produtos/:id/stock-movements', (req, res) => {
    const moves = db.stockMovements.filter(m => m.productId === req.params.id).sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(moves);
  });

  app.get('/api/stock-movements', (req, res) => {
    const moves = [...db.stockMovements].sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0,100);
    res.json(moves);
  });

  // ===== Módulo Financeiro - Contas a Pagar (ETAPA 12) =====
  app.get('/api/payables', (req, res) => {
    try {
      const { q, status, dueFrom, dueTo } = req.query as any;
      const list = accountPayableService.search({ q, statusFilter: status || 'ALL', dueFrom, dueTo });
      const isReversed = (pid:string)=> (db as any).accountPayablePaymentReversals?.some((r:any)=> r.accountPayablePaymentId===pid);
      const enriched = list.map(p => {
        const supplier = db.fornecedores.find(f => f.id === p.supplierId);
        const paidCents = db.accountPayablePayments.filter((pay:any)=> pay.accountPayableId===p.id && !isReversed(pay.id)).reduce((s,pay)=> s+pay.amountCents,0);
        const remainingCents = p.amountCents - paidCents;
        return { ...p, supplier, paidCents, remainingCents };
      });
      res.json(enriched);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/payables/summary', (req, res) => {
    try {
      res.json(accountPayableService.getSummary());
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/payables/:id', (req, res) => {
    try {
      const p = accountPayableService.getById(req.params.id);
      if (!p) throw new Error('Conta não encontrada.');
      const supplier = db.fornecedores.find(f => f.id === p.supplierId);
      let receipt = null, order = null;
      if (p.purchaseReceiptId) {
        receipt = db.purchaseReceipts.find(r => r.id === p.purchaseReceiptId) || null;
        if (receipt) order = db.purchaseOrders.find(o => o.id === receipt.purchaseOrderId) || null;
      }
      const isReversed = (pid:string)=> (db as any).accountPayablePaymentReversals?.some((r:any)=> r.accountPayablePaymentId===pid);
      const allPayments = db.accountPayablePayments.filter(pay => pay.accountPayableId === p.id).sort((a,b)=> new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
      const effectivePayments = allPayments.filter((pay:any)=> !isReversed(pay.id));
      const paidCents = effectivePayments.reduce((s:number,p:any)=> s+p.amountCents,0);
      const remainingCents = p.amountCents - paidCents;
      const payment = effectivePayments[0] || allPayments[0] || null;
      let cashSession=null, cashMovement=null;
      if(payment?.cashSessionId) cashSession=db.sessoesCaixa.find(s=>s.id===payment.cashSessionId) || null;
      if(payment?.cashMovementId) cashMovement=db.movimentacoesCaixa.find(m=>m.id===payment.cashMovementId) || null;
      // enrich payments with isReversed
      const payments = allPayments.map((pay:any)=> {
        const rev = (db as any).accountPayablePaymentReversals?.find((r:any)=> r.accountPayablePaymentId===pay.id) || null;
        return { ...pay, isReversed: !!rev, reversal: rev };
      });
      res.json({ ...p, supplier, receipt, order, payment, payments, paidCents, remainingCents, cashSession, cashMovement });
    } catch (e: any) { res.status(404).json({ error: e.message }); }
  });

  app.post('/api/payables/from-receipt', (req, res) => {
    try {
      const { purchaseReceiptId, description, amountCents, dueDate, notes, createdBy } = req.body;
      const payable = accountPayableService.createFromReceipt({
        purchaseReceiptId,
        description,
        amountCents,
        dueDate,
        notes,
        createdBy: createdBy || 'Operador',
      });
      res.json(payable);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/payables', (req, res) => {
    try {
      const { supplierId, description, amountCents, dueDate, notes, createdBy } = req.body;
      const payable = accountPayableService.createManual({
        supplierId,
        description,
        amountCents,
        dueDate,
        notes,
        createdBy: createdBy || 'Operador',
      });
      res.json(payable);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put('/api/payables/:id', (req, res) => {
    try {
      const payable = accountPayableService.updateOpenPayable(req.params.id, req.body);
      res.json(payable);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/payables/:id/cancel', (req, res) => {
    try {
      const { reason, cancelledBy, notes } = req.body;
      const payable = accountPayableService.cancelPayable(req.params.id, { reason, cancelledBy: cancelledBy || 'Operador', notes });
      res.json(payable);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/purchase-receipts/:id/payable', (req, res) => {
    try {
      const payable = accountPayableService.getByReceiptId(req.params.id);
      if (!payable) return res.json(null);
      res.json(payable);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ETAPA 13/14 - Pagamento de contas a pagar (integral e parcial)
  app.post('/api/payables/:id/pay', (req, res) => {
    try {
      const { paymentMethod, notes, paidBy, amountCents } = req.body;
      const result = accountPayableService.payAccountPayable({
        accountPayableId: req.params.id,
        paymentMethod,
        amountCents: amountCents !== undefined ? Number(amountCents) : undefined,
        notes,
        paidBy: paidBy || 'Operador',
      });
      res.json(result);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/payables/:id/payments', (req, res) => {
    try {
      const payments = db.accountPayablePayments.filter(p => p.accountPayableId === req.params.id).sort((a,b)=> new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
      // enrich each with cash info
      const enriched = payments.map(pay => {
        const cashSession = pay.cashSessionId ? db.sessoesCaixa.find(s=>s.id===pay.cashSessionId) || null : null;
        const cashMovement = pay.cashMovementId ? db.movimentacoesCaixa.find(m=>m.id===pay.cashMovementId) || null : null;
        return { ...pay, cashSession, cashMovement };
      });
      res.json(enriched);
    } catch (e:any){ res.status(400).json({error:e.message});}
  });

  app.get('/api/payables/:id/payment', (req, res) => {
    try {
      const payment = accountPayableService.getPaymentByPayableId(req.params.id);
      if (!payment) return res.json(null);
      // enrich with cash session info if CASH
      let cashSession = null;
      let cashMovement = null;
      if (payment.cashSessionId) {
        cashSession = db.sessoesCaixa.find(s => s.id === payment.cashSessionId) || null;
      }
      if (payment.cashMovementId) {
        cashMovement = db.movimentacoesCaixa.find(m => m.id === payment.cashMovementId) || null;
      }
      res.json({ ...payment, cashSession, cashMovement });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/payable-payments/:id', (req, res) => {
    try {
      const payment = db.accountPayablePayments.find(p => p.id === req.params.id);
      if (!payment) throw new Error('Pagamento não encontrado.');
      res.json(payment);
    } catch (e: any) { res.status(404).json({ error: e.message }); }
  });

  // ===== Módulo Contas a Receber - Crediário (ETAPA 15) =====
  app.get('/api/receivables', (req, res) => {
    try {
      const { q, status, dueFrom, dueTo } = req.query as any;
      const list = accountReceivableService.search({ q, statusFilter: status || 'ALL', dueFrom, dueTo });
      const isReversed = (pid:string)=> (db as any).accountReceivablePaymentReversals?.some((r:any)=> r.accountReceivablePaymentId===pid);
      const enriched = list.map(r => {
        const customer = db.clientes.find(c=>c.id===r.customerId);
        const sale = db.vendas.find(v=>v.id===r.saleId);
        const paidCents = (db as any).accountReceivablePayments.filter((p:any)=> p.accountReceivableId===r.id && !isReversed(p.id)).reduce((s:number,p:any)=> s+p.amountCents,0);
        const remainingCents = r.amountCents - paidCents;
        return { ...r, customer, sale, paidCents, remainingCents };
      });
      res.json(enriched);
    } catch (e:any){ res.status(400).json({error:e.message}); }
  });
  app.get('/api/receivables/summary', (req,res)=>{
    try{ res.json(accountReceivableService.getSummary()); } catch(e:any){ res.status(400).json({error:e.message});}
  });
  app.get('/api/receivables/:id', (req,res)=>{
    try{
      const r = accountReceivableService.getById(req.params.id);
      if(!r) throw new Error('Conta não encontrada.');
      const customer = db.clientes.find(c=>c.id===r.customerId);
      const sale = db.vendas.find(v=>v.id===r.saleId);
      const isReversed = (pid:string)=> (db as any).accountReceivablePaymentReversals?.some((rev:any)=> rev.accountReceivablePaymentId===pid);
      const allPayments = (db as any).accountReceivablePayments.filter((p:any)=> p.accountReceivableId===r.id).sort((a:any,b:any)=> new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
      const effectivePayments = allPayments.filter((p:any)=> !isReversed(p.id));
      const paidCents = effectivePayments.reduce((s:number,p:any)=> s+p.amountCents,0);
      const remainingCents = r.amountCents - paidCents;
      const payment = effectivePayments[0] || allPayments[0] || null;
      let cashSession=null, cashMovement=null;
      if(payment?.cashSessionId) cashSession=db.sessoesCaixa.find(s=>s.id===payment.cashSessionId) || null;
      if(payment?.cashMovementId) cashMovement=db.movimentacoesCaixa.find(m=>m.id===payment.cashMovementId) || null;
      const payments = allPayments.map((p:any)=>{
        const rev = (db as any).accountReceivablePaymentReversals?.find((rev:any)=> rev.accountReceivablePaymentId===p.id) || null;
        return { ...p, isReversed: !!rev, reversal: rev };
      });
      res.json({ ...r, customer, sale, payment, payments, paidCents, remainingCents, cashSession, cashMovement });
    } catch(e:any){ res.status(404).json({error:e.message});}
  });
  app.get('/api/sales/:id/receivable', (req,res)=>{
    try{
      const r = accountReceivableService.getBySaleId(req.params.id);
      if(!r) return res.json(null);
      res.json(r);
    } catch(e:any){ res.status(400).json({error:e.message});}
  });
  app.post('/api/receivables/:id/receive', (req,res)=>{
    try{
      const { paymentMethod, notes, receivedBy, amountCents } = req.body;
      const result = accountReceivableService.receiveAccountReceivable({
        accountReceivableId: req.params.id,
        paymentMethod,
        amountCents: amountCents !== undefined ? Number(amountCents) : undefined,
        notes,
        receivedBy: receivedBy || 'Operador',
      });
      res.json(result);
    } catch(e:any){ res.status(400).json({error:e.message});}
  });
  app.get('/api/receivables/:id/payment', (req,res)=>{
    try{
      const payment = (db as any).accountReceivablePayments.find((p:any)=> p.accountReceivableId===req.params.id);
      if(!payment) return res.json(null);
      const cashSession = payment.cashSessionId ? db.sessoesCaixa.find(s=>s.id===payment.cashSessionId) || null : null;
      const cashMovement = payment.cashMovementId ? db.movimentacoesCaixa.find(m=>m.id===payment.cashMovementId) || null : null;
      res.json({ ...payment, cashSession, cashMovement });
    } catch(e:any){ res.status(400).json({error:e.message});}
  });

  // ETAPA 18 - Estornos
  app.post('/api/payable-payments/:id/reverse', (req,res)=>{
    try{
      const { reason, notes, reversedBy } = req.body;
      const result = accountPayableService.reverseAccountPayablePayment({ paymentId: req.params.id, reason, notes, reversedBy: reversedBy || 'Operador' });
      res.json(result);
    } catch(e:any){ res.status(400).json({error:e.message}); }
  });
  app.post('/api/receivable-payments/:id/reverse', (req,res)=>{
    try{
      const { reason, notes, reversedBy } = req.body;
      const result = accountReceivableService.reverseAccountReceivablePayment({ paymentId: req.params.id, reason, notes, reversedBy: reversedBy || 'Operador' });
      res.json(result);
    } catch(e:any){ res.status(400).json({error:e.message}); }
  });
  app.get('/api/payables/:id/payments', (req,res)=>{
    try{
      const payments = (db as any).accountPayablePayments.filter((p:any)=> p.accountPayableId===req.params.id).sort((a:any,b:any)=> new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
      const enriched = payments.map((p:any)=>{
        const isReversed = (db as any).accountPayablePaymentReversals?.some((r:any)=> r.accountPayablePaymentId===p.id);
        const reversal = isReversed ? (db as any).accountPayablePaymentReversals.find((r:any)=> r.accountPayablePaymentId===p.id) : null;
        const cashSession = p.cashSessionId ? db.sessoesCaixa.find(s=>s.id===p.cashSessionId) || null : null;
        const cashMovement = p.cashMovementId ? db.movimentacoesCaixa.find(m=>m.id===p.cashMovementId) || null : null;
        const reversalMovement = reversal?.cashMovementId ? db.movimentacoesCaixa.find(m=>m.id===reversal.cashMovementId) || null : null;
        return { ...p, isReversed, reversal, cashSession, cashMovement, reversalMovement };
      });
      res.json(enriched);
    } catch(e:any){ res.status(400).json({error:e.message});}
  });
  app.get('/api/receivables/:id/payments', (req,res)=>{
    try{
      const payments = (db as any).accountReceivablePayments.filter((p:any)=> p.accountReceivableId===req.params.id).sort((a:any,b:any)=> new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
      const enriched = payments.map((p:any)=>{
        const isReversed = (db as any).accountReceivablePaymentReversals?.some((r:any)=> r.accountReceivablePaymentId===p.id);
        const reversal = isReversed ? (db as any).accountReceivablePaymentReversals.find((r:any)=> r.accountReceivablePaymentId===p.id) : null;
        const cashSession = p.cashSessionId ? db.sessoesCaixa.find(s=>s.id===p.cashSessionId) || null : null;
        const cashMovement = p.cashMovementId ? db.movimentacoesCaixa.find(m=>m.id===p.cashMovementId) || null : null;
        const reversalMovement = reversal?.cashMovementId ? db.movimentacoesCaixa.find(m=>m.id===reversal.cashMovementId) || null : null;
        return { ...p, isReversed, reversal, cashSession, cashMovement, reversalMovement };
      });
      res.json(enriched);
    } catch(e:any){ res.status(400).json({error:e.message});}
  });

  // ===== Módulo Estoque - Ajuste e Inventário (ETAPA 19) =====
  app.get('/api/estoque/config', (req,res)=>{ res.json(db.configuracaoEstoque); });
  app.put('/api/estoque/config', (req,res)=>{
    try{
      const { allowNegativeStock } = req.body;
      if (typeof allowNegativeStock !== 'boolean') return res.status(400).json({error:'allowNegativeStock deve ser boolean'});
      db.configuracaoEstoque.allowNegativeStock = allowNegativeStock;
      res.json(db.configuracaoEstoque);
    } catch(e:any){ res.status(400).json({error:e.message}); }
  });
  app.get('/api/estoque/movimentacoes', (req,res)=>{
    try{
      const { productId } = req.query as any;
      res.json(stockService.listMovements(productId));
    } catch(e:any){ res.status(400).json({error:e.message}); }
  });
  app.get('/api/estoque/low-stock', (_req,res)=> { res.json(lowStockService.list()); });
  app.post('/api/estoque/ajuste', (req,res)=>{
    try{
      const { productId, direction, quantity, reason, notes, operator } = req.body;
      const mov = stockService.adjustStock({ productId, direction, quantity: Number(quantity), reason, notes, operator });
      res.json(mov);
    } catch(e:any){ res.status(400).json({error:e.message}); }
  });
  app.post('/api/estoque/inventario', (req,res)=>{
    try{
      const { productId, countedQuantity, notes, operator } = req.body;
      const result = stockService.reconcileInventory({ productId, countedQuantity: Number(countedQuantity), notes, operator });
      res.json(result);
    } catch(e:any){ res.status(400).json({error:e.message}); }
  });

  // Vite middleware for development (must be last)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
