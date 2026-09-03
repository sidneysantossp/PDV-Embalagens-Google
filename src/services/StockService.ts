import { db } from '../db.js';
import type { StockMovement, StockAdjustmentReason } from '../types.js';

const ENTRY_REASONS: StockAdjustmentReason[] = ['FOUND_SURPLUS', 'CORRECTION', 'INVENTORY_ADJUSTMENT', 'OTHER'];
const EXIT_REASONS: StockAdjustmentReason[] = ['BREAKAGE', 'DAMAGE', 'LOSS', 'EXTRAVIO', 'INTERNAL_USE', 'CORRECTION', 'INVENTORY_ADJUSTMENT', 'OTHER'];
const ALL_REASONS: StockAdjustmentReason[] = ['BREAKAGE','DAMAGE','LOSS','EXTRAVIO','INTERNAL_USE','INVENTORY_ADJUSTMENT','CORRECTION','FOUND_SURPLUS','OTHER'];

function isValidReason(reason: string): boolean {
  return (ALL_REASONS as string[]).includes(reason);
}

export class StockService {
  getCurrentStock(productId: string): number {
    const p = db.produtos.find(prod => prod.id === productId);
    if (!p) throw new Error('Produto não encontrado.');
    return p.estGeral;
  }

  listMovements(productId?: string): StockMovement[] {
    let list = [...db.stockMovements];
    if (productId) list = list.filter(m => m.productId === productId);
    return list.sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  adjustStock(data: {
    productId: string;
    direction: 'INCREASE' | 'DECREASE';
    quantity: number;
    reason: StockAdjustmentReason;
    notes?: string;
    operator?: string;
  }): StockMovement {
    // Validations
    const product = db.produtos.find(p => p.id === data.productId);
    if (!product) throw new Error('Produto não encontrado.');

    if (!Number.isInteger(data.quantity) || data.quantity <= 0) {
      throw new Error('Quantidade deve ser inteira maior que zero.');
    }
    if (!data.reason || !isValidReason(data.reason)) {
      throw new Error('Motivo é obrigatório.');
    }
    if (data.reason === 'OTHER' && (!data.notes || data.notes.trim().length === 0)) {
      throw new Error('Quando motivo for Outro, é necessário informar descrição complementar.');
    }
    if (data.notes && data.notes.length > 1000) throw new Error('Observação muito longa. Máximo 1000 caracteres.');

    // Validate direction vs reason
    if (data.direction === 'INCREASE' && !ENTRY_REASONS.includes(data.reason)) {
      // For INCREASE, only allow entry reasons, but also allow OTHER and INVENTORY_ADJUSTMENT
      // We'll allow if reason is in ALL but not in EXIT only? Simplify: allow if reason is in ENTRY or OTHER or INVENTORY
      // Already checked isValidReason, so we allow any, but we can warn? For now allow any
    }
    if (data.direction === 'DECREASE' && !EXIT_REASONS.includes(data.reason)) {
      // Similar, allow any valid reason
    }

    const current = product.estGeral;
    const delta = data.direction === 'INCREASE' ? data.quantity : -data.quantity;
    const newBalance = current + delta;

    if (!db.configuracaoEstoque.allowNegativeStock && newBalance < 0) {
      throw new Error('Estoque insuficiente. Saída deixaria saldo negativo e estoque negativo não é permitido.');
    }

    const now = new Date().toISOString();
    const movementId = Date.now().toString() + Math.random().toString(36).slice(2,4);
    const movement: StockMovement = {
      id: movementId,
      productId: product.id,
      type: 'MANUAL_ADJUSTMENT',
      quantity: delta,
      balanceBefore: current,
      balanceAfter: newBalance,
      referenceType: 'MANUAL_ADJUSTMENT',
      referenceId: movementId,
      createdAt: now,
      notes: data.notes?.trim() || undefined,
      reason: data.reason,
      operator: data.operator || 'Operador',
    };

    // Transaction: update stock then push movement
    // Snapshot for rollback (though simple)
    const prevStock = product.estGeral;
    try {
      product.estGeral = newBalance;
      db.stockMovements.push(movement);
      return movement;
    } catch (e) {
      product.estGeral = prevStock;
      // remove if pushed
      const idx = db.stockMovements.findIndex(m=> m.id===movementId);
      if (idx>=0) db.stockMovements.splice(idx,1);
      throw e;
    }
  }

  reconcileInventory(data: {
    productId: string;
    countedQuantity: number;
    notes?: string;
    operator?: string;
  }): { movement: StockMovement | null; previousQuantity: number; countedQuantity: number; difference: number; message?: string } {
    const product = db.produtos.find(p=> p.id===data.productId);
    if (!product) throw new Error('Produto não encontrado.');

    if (!Number.isInteger(data.countedQuantity) || data.countedQuantity < 0) {
      throw new Error('Contagem física deve ser inteira maior ou igual a zero.');
    }
    if (data.notes && data.notes.length > 1000) throw new Error('Observação muito longa.');

    const current = product.estGeral;
    const counted = data.countedQuantity;
    const difference = counted - current;

    if (difference === 0) {
      return { movement: null, previousQuantity: current, countedQuantity: counted, difference: 0, message: 'Estoque já confere com a contagem informada.' };
    }

    // For inventory, the adjustment is based on difference
    const direction: 'INCREASE' | 'DECREASE' = difference > 0 ? 'INCREASE' : 'DECREASE';
    const quantity = Math.abs(difference);
    const reason: StockAdjustmentReason = 'INVENTORY_ADJUSTMENT';

    // Check negative stock: final counted is >=0, so no negative, but we still check if newBalance <0 and not allowed (should not happen since counted >=0)
    if (!db.configuracaoEstoque.allowNegativeStock && counted < 0) {
      throw new Error('Contagem física não pode ser negativa.');
    }

    const now = new Date().toISOString();
    const movementId = Date.now().toString() + Math.random().toString(36).slice(2,4);
    const movement: StockMovement = {
      id: movementId,
      productId: product.id,
      type: 'INVENTORY_ADJUSTMENT',
      quantity: difference, // signed
      balanceBefore: current,
      balanceAfter: counted,
      referenceType: 'INVENTORY_ADJUSTMENT',
      referenceId: movementId,
      createdAt: now,
      notes: data.notes?.trim() || undefined,
      reason,
      operator: data.operator || 'Operador',
    };

    const prevStock = product.estGeral;
    try {
      product.estGeral = counted;
      db.stockMovements.push(movement);
      return { movement, previousQuantity: current, countedQuantity: counted, difference };
    } catch (e) {
      product.estGeral = prevStock;
      const idx = db.stockMovements.findIndex(m=> m.id===movementId);
      if (idx>=0) db.stockMovements.splice(idx,1);
      throw e;
    }
  }
}
