import { db } from '../db.js';
import type { PurchaseReceipt, PurchaseReceiptItem, StockMovement } from '../types.js';
import { PurchaseOrderService } from './PurchaseOrderService.js';

function nextReceiptNumber(): string {
  db._purchaseReceiptCounter = (db._purchaseReceiptCounter || 0) + 1;
  return `REC-${String(db._purchaseReceiptCounter).padStart(6, '0')}`;
}

export class PurchaseReceiptService {
  private orderService = new PurchaseOrderService();

  getReceivedQuantityByOrderItem(purchaseOrderItemId: string): number {
    let total = 0;
    for (const receipt of db.purchaseReceipts) {
      for (const it of receipt.items) {
        if (it.purchaseOrderItemId === purchaseOrderItemId) total += it.quantityReceived;
      }
    }
    return total;
  }

  getReceiptsByOrder(purchaseOrderId: string): PurchaseReceipt[] {
    return db.purchaseReceipts
      .filter(r => r.purchaseOrderId === purchaseOrderId)
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  }

  getReceiptById(id: string): PurchaseReceipt | undefined {
    return db.purchaseReceipts.find(r => r.id === id);
  }

  // Core transactional receive
  receivePurchaseOrder(data: {
    purchaseOrderId: string;
    items: { purchaseOrderItemId: string; quantityReceived: number }[];
    notes?: string;
    receivedBy: string;
  }): PurchaseReceipt {
    // BEGIN validations (inside transaction conceptually)
    const order = this.orderService.getPurchaseOrderById(data.purchaseOrderId);
    if (!order) throw new Error('Pedido não encontrado.');

    // Validate status allows receiving
    if (order.status === 'DRAFT') {
      throw new Error('Confirme o pedido antes de receber mercadorias.');
    }
    if (order.status === 'CANCELLED') {
      throw new Error('Não é possível receber um pedido cancelado.');
    }
    if (order.status === 'RECEIVED') {
      throw new Error('Este pedido já foi recebido integralmente.');
    }
    if (order.status !== 'ORDERED' && order.status !== 'PARTIALLY_RECEIVED') {
      throw new Error('Status do pedido não permite recebimento.');
    }

    const supplier = db.fornecedores.find(f => f.id === order.supplierId);
    if (!supplier) throw new Error('Fornecedor do pedido não encontrado.');

    if (!data.items || data.items.length === 0) {
      throw new Error('Informe pelo menos uma quantidade para receber.');
    }

    // Validate operador
    const operador = (data.receivedBy || '').trim();
    if (!operador) throw new Error('Operador é obrigatório.');

    // Prepare pending map before mutation
    const receivedMap = this.orderService.getReceivedMap(order.id);

    // Filter and validate each item input
    const toProcess: { orderItem: any; quantityReceived: number }[] = [];
    let totalQuantityReceived = 0;

    for (const input of data.items) {
      const qty = input.quantityReceived;
      // Must be integer >=0
      if (!Number.isInteger(qty)) {
        throw new Error('Quantidade deve ser inteira.');
      }
      if (qty < 0) {
        throw new Error('Quantidade não pode ser negativa.');
      }
      if (qty === 0) continue; // skip zeros but track if all zero later
      const orderItem = order.items.find(i => i.id === input.purchaseOrderItemId);
      if (!orderItem) {
        throw new Error('Item não pertence ao pedido.');
      }
      const alreadyReceived = receivedMap.get(orderItem.id) || 0;
      const pending = orderItem.quantityOrdered - alreadyReceived;
      if (qty > pending) {
        throw new Error(`Quantidade recebida (${qty}) excede pendente (${pending}) para o produto ${orderItem.productName}.`);
      }
      toProcess.push({ orderItem, quantityReceived: qty });
      totalQuantityReceived += qty;
    }

    if (toProcess.length === 0 || totalQuantityReceived === 0) {
      throw new Error('Informe pelo menos uma quantidade para receber.');
    }

    // Validate products exist and would not cause stock inconsistency?
    // All validated, now proceed to mutation atomically
    // Snapshot for rollback in case of error during mutation (simulate transaction)
    const snapshot = {
      produtos: db.produtos.map(p => ({ id: p.id, estGeral: p.estGeral, custo: p.custo })),
      purchaseOrders: JSON.parse(JSON.stringify(db.purchaseOrders)),
      purchaseReceipts: JSON.parse(JSON.stringify(db.purchaseReceipts)),
      stockMovements: JSON.parse(JSON.stringify(db.stockMovements)),
      _counter: db._purchaseReceiptCounter,
    };

    try {
      const now = new Date().toISOString();
      const receiptId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
      const receiptNumber = nextReceiptNumber();

      let totalReceivedCents = 0;
      const receiptItems: PurchaseReceiptItem[] = [];

      for (const proc of toProcess) {
        const unitCost = proc.orderItem.unitCostCents;
        const subtotal = proc.quantityReceived * unitCost;
        totalReceivedCents += subtotal;

        const receiptItem: PurchaseReceiptItem = {
          id: `${receiptId}-item-${proc.orderItem.id}`,
          purchaseReceiptId: receiptId,
          purchaseOrderItemId: proc.orderItem.id,
          productId: proc.orderItem.productId,
          productName: proc.orderItem.productName,
          quantityReceived: proc.quantityReceived,
          unitCostCents: unitCost,
          subtotalCents: subtotal,
        };
        receiptItems.push(receiptItem);
      }

      // Create StockMovements and update stock + last cost
      const movements: StockMovement[] = [];
      for (const rItem of receiptItems) {
        const product = db.produtos.find(p => p.id === rItem.productId);
        if (!product) throw new Error(`Produto não encontrado: ${rItem.productId}`);
        // Update stock
        const newBalance = product.estGeral + rItem.quantityReceived;
        product.estGeral = newBalance;
        // Update last cost (custo) to unitCostCents /100
        product.custo = rItem.unitCostCents / 100;

        const mov: StockMovement = {
          id: `${receiptId}-mov-${rItem.productId}-${Date.now()}`,
          productId: rItem.productId,
          type: 'PURCHASE_RECEIPT',
          quantity: rItem.quantityReceived,
          balanceAfter: newBalance,
          referenceType: 'PURCHASE_RECEIPT',
          referenceId: receiptId,
          createdAt: now,
          notes: `Recebimento ${receiptNumber} Pedido ${order.orderNumber}`,
        };
        movements.push(mov);
        db.stockMovements.push(mov);
      }

      const receipt: PurchaseReceipt = {
        id: receiptId,
        receiptNumber,
        purchaseOrderId: order.id,
        supplierId: order.supplierId,
        receivedBy: operador,
        receivedAt: now,
        notes: data.notes,
        createdAt: now,
        totalReceivedCents,
        items: receiptItems,
      };

      db.purchaseReceipts.push(receipt);

      // Recalculate order status
      const newStatus = this.orderService.recalculateStatus(order);
      order.status = newStatus;
      order.updatedAt = now;

      return receipt;
    } catch (e) {
      // ROLLBACK
      for (const snap of snapshot.produtos) {
        const p = db.produtos.find(prod => prod.id === snap.id);
        if (p) { p.estGeral = snap.estGeral; p.custo = snap.custo; }
      }
      db.purchaseOrders = snapshot.purchaseOrders;
      db.purchaseReceipts = snapshot.purchaseReceipts;
      db.stockMovements = snapshot.stockMovements;
      db._purchaseReceiptCounter = snapshot._counter;
      throw e;
    }
  }

  // For testing concurrency simulation: service holds no lock but validation is inside transaction.
}
