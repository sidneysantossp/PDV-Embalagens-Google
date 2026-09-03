import { db } from '../db.js';
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../types.js';

function nextOrderNumber(): string {
  db._purchaseOrderCounter = (db._purchaseOrderCounter || 0) + 1;
  return `PC${String(db._purchaseOrderCounter).padStart(6, '0')}`;
}

export class PurchaseOrderService {
  // Helpers to compute received quantities via receipts
  getReceivedMap(purchaseOrderId: string): Map<string, number> {
    const map = new Map<string, number>();
    for (const receipt of db.purchaseReceipts.filter(r => r.purchaseOrderId === purchaseOrderId)) {
      for (const item of receipt.items) {
        map.set(item.purchaseOrderItemId, (map.get(item.purchaseOrderItemId) || 0) + item.quantityReceived);
      }
    }
    return map;
  }

  getPurchaseOrderById(id: string): PurchaseOrder | undefined {
    return db.purchaseOrders.find(p => p.id === id);
  }

  listPurchaseOrders(): PurchaseOrder[] {
    return [...db.purchaseOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Enriched view with computed received/pending and progress
  getEnrichedOrder(id: string) {
    const order = this.getPurchaseOrderById(id);
    if (!order) throw new Error('Pedido não encontrado.');
    const receivedMap = this.getReceivedMap(id);
    const enrichedItems = order.items.map(item => {
      const received = receivedMap.get(item.id) || 0;
      const pending = item.quantityOrdered - received;
      return { ...item, received, pending };
    });
    const totalOrdered = order.items.reduce((s, i) => s + i.quantityOrdered, 0);
    const totalReceived = enrichedItems.reduce((s, i) => s + i.received, 0);
    const totalPending = totalOrdered - totalReceived;
    const receipts = db.purchaseReceipts.filter(r => r.purchaseOrderId === id).sort((a,b)=> new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    return {
      ...order,
      enrichedItems,
      totalOrdered,
      totalReceived,
      totalPending,
      receipts,
    };
  }

  createPurchaseOrder(data: {
    supplierId: string;
    expectedDelivery?: string;
    notes?: string;
    createdBy?: string;
    items: { productId: string; quantityOrdered: number; unitCostCents: number }[];
  }): PurchaseOrder {
    const supplier = db.fornecedores.find(f => f.id === data.supplierId);
    if (!supplier) throw new Error('Fornecedor não encontrado.');
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Pedido deve conter pelo menos um item.');
    }

    const orderId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    const orderNumber = nextOrderNumber();
    const now = new Date().toISOString();

    const items: PurchaseOrderItem[] = data.items.map((it, idx) => {
      if (!Number.isInteger(it.quantityOrdered) || it.quantityOrdered <= 0) {
        throw new Error('Quantidade deve ser inteira maior que zero.');
      }
      if (!Number.isInteger(it.unitCostCents) || it.unitCostCents < 0) {
        throw new Error('Custo deve ser inteiro não negativo (centavos).');
      }
      const product = db.produtos.find(p => p.id === it.productId);
      if (!product) throw new Error(`Produto não encontrado: ${it.productId}`);
      const subtotal = it.quantityOrdered * it.unitCostCents;
      return {
        id: `${orderId}-item-${idx}-${Date.now()}`,
        purchaseOrderId: orderId,
        productId: it.productId,
        productName: product.nome,
        quantityOrdered: it.quantityOrdered,
        unitCostCents: it.unitCostCents,
        subtotalCents: subtotal,
      };
    });

    const totalCents = items.reduce((s, i) => s + i.subtotalCents, 0);

    const order: PurchaseOrder = {
      id: orderId,
      orderNumber,
      supplierId: data.supplierId,
      status: 'DRAFT',
      expectedDelivery: data.expectedDelivery,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
      createdBy: data.createdBy,
      totalCents,
      items,
    };

    db.purchaseOrders.push(order);
    return order;
  }

  orderPurchaseOrder(id: string): PurchaseOrder {
    const order = this.getPurchaseOrderById(id);
    if (!order) throw new Error('Pedido não encontrado.');
    if (order.status !== 'DRAFT') {
      throw new Error('Somente pedidos em rascunho podem ser confirmados.');
    }
    // Validate supplier still active etc. optional
    order.status = 'ORDERED';
    order.updatedAt = new Date().toISOString();
    return order;
  }

  cancelPurchaseOrder(id: string): PurchaseOrder {
    const order = this.getPurchaseOrderById(id);
    if (!order) throw new Error('Pedido não encontrado.');
    if (order.status === 'RECEIVED' || order.status === 'PARTIALLY_RECEIVED') {
      throw new Error('Não é possível cancelar um pedido que já possui mercadorias recebidas.');
    }
    // also if already has any receipt (even if status still ORDERED but receipts exist? but status would be PARTIALLY_RECEIVED; we already block)
    const hasReceipt = db.purchaseReceipts.some(r => r.purchaseOrderId === id);
    if (hasReceipt) {
      throw new Error('Não é possível cancelar um pedido que já possui mercadorias recebidas.');
    }
    if (order.status === 'CANCELLED') throw new Error('Pedido já está cancelado.');
    // Only allow DRAFT or ORDERED to cancel
    if (order.status !== 'DRAFT' && order.status !== 'ORDERED') {
      throw new Error('Status não permite cancelamento.');
    }
    order.status = 'CANCELLED';
    order.updatedAt = new Date().toISOString();
    return order;
  }

  // For status recalculation after receipts (called by receipt service)
  recalculateStatus(order: PurchaseOrder): PurchaseOrderStatus {
    const receivedMap = this.getReceivedMap(order.id);
    let allReceived = true;
    let anyReceived = false;
    for (const item of order.items) {
      const rec = receivedMap.get(item.id) || 0;
      if (rec > 0) anyReceived = true;
      if (rec < item.quantityOrdered) allReceived = false;
      if (rec === 0 && item.quantityOrdered > 0) {
        // not all received
      }
    }
    if (allReceived && order.items.length > 0) return 'RECEIVED';
    if (anyReceived) return 'PARTIALLY_RECEIVED';
    return 'ORDERED';
  }
}
