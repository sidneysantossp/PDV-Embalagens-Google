import { db } from '../db.js';

export type LowStockAlert = { productId: string; productName: string; code: string; currentStock: number; minimumStock: number; targetStock: number; suggestedQuantity: number; suppliersSummary: string };

export class LowStockService {
  setMinimum(productId: string, minimumStockQuantity: number) {
    if (!Number.isInteger(minimumStockQuantity) || minimumStockQuantity < 0) throw new Error('Estoque mínimo deve ser um inteiro maior ou igual a zero.');
    const product = db.produtos.find(p => p.id === productId);
    if (!product) throw new Error('Produto não encontrado.');
    product.minimumStockQuantity = minimumStockQuantity;
    return product;
  }
  list(): LowStockAlert[] {
    return db.produtos.filter(p => (p.status ?? 'ACTIVE') === 'ACTIVE' && (p.minimumStockQuantity ?? 0) > 0 && p.estGeral <= (p.minimumStockQuantity ?? 0)).map(p => {
      const minimumStock = p.minimumStockQuantity!;
      const suppliers = db.fornecedorProdutos.filter(link => link.productId === p.id).map(link => db.fornecedores.find(f => f.id === link.supplierId)?.nome).filter((name): name is string => Boolean(name));
      return { productId: p.id, productName: p.nome, code: p.codigo, currentStock: p.estGeral, minimumStock, targetStock: minimumStock * 2, suggestedQuantity: Math.max(minimumStock * 2 - p.estGeral, 1), suppliersSummary: suppliers.length ? (suppliers.length === 1 ? suppliers[0]! : `${suppliers[0]} +${suppliers.length - 1}`) : 'Sem fornecedor vinculado' };
    }).sort((a,b) => (a.currentStock - a.minimumStock) - (b.currentStock - b.minimumStock));
  }
}
