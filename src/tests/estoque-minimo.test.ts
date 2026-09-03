import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { LowStockService } from '../services/LowStockService';

describe('LowStockService', () => {
  const service = new LowStockService();
  beforeEach(() => { db.produtos[0]!.estGeral = 10; db.produtos[0]!.minimumStockQuantity = 0; db.stockMovements.length = 0; db.purchaseOrders.length = 0; });
  it('derives alerts and the 2x target suggestion without moving stock', () => {
    const before = db.produtos[0]!.estGeral;
    service.setMinimum('1', 10);
    expect(db.produtos[0]!.estGeral).toBe(before); expect(db.stockMovements).toHaveLength(0);
    expect(service.list()[0]?.suggestedQuantity).toBe(10);
    db.produtos[0]!.estGeral = 8; expect(service.list()[0]?.suggestedQuantity).toBe(12);
    db.produtos[0]!.estGeral = -2; expect(service.list()[0]?.suggestedQuantity).toBe(22);
  });
  it('does not alert when minimum is zero and rejects negatives', () => {
    db.produtos[0]!.estGeral = 0; expect(service.list()).toHaveLength(0);
    expect(() => service.setMinimum('1', -1)).toThrow();
  });
});
