import { db } from '../db.js';
import type { Fornecedor, FornecedorProduto } from '../types.js';
import { cleanDocument, isValidCPF, isValidCNPJ } from '../utils.js';

export class FornecedorService {
  criarFornecedor(data: Omit<Fornecedor, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Fornecedor {
    const docLimpo = cleanDocument(data.documento);
    
    if (data.tipoPessoa === 'PJ' && !isValidCNPJ(docLimpo)) {
      throw new Error('CNPJ inválido.');
    }
    if (data.tipoPessoa === 'PF' && !isValidCPF(docLimpo)) {
      throw new Error('CPF inválido.');
    }

    const existe = db.fornecedores.find(f => f.documento === docLimpo);
    if (existe) {
      throw new Error('Já existe um fornecedor cadastrado com este documento.');
    }

    const novo: Fornecedor = {
      ...data,
      id: Date.now().toString(),
      documento: docLimpo,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.fornecedores.push(novo);
    return novo;
  }

  editarFornecedor(id: string, data: Partial<Omit<Fornecedor, 'id' | 'status' | 'createdAt' | 'updatedAt'>>): Fornecedor {
    const fornecedor = db.fornecedores.find(f => f.id === id);
    if (!fornecedor) throw new Error('Fornecedor não encontrado.');

    if (data.documento) {
      const docLimpo = cleanDocument(data.documento);
      const tipoPessoa = data.tipoPessoa || fornecedor.tipoPessoa;

      if (tipoPessoa === 'PJ' && !isValidCNPJ(docLimpo)) {
        throw new Error('CNPJ inválido.');
      }
      if (tipoPessoa === 'PF' && !isValidCPF(docLimpo)) {
        throw new Error('CPF inválido.');
      }

      const existe = db.fornecedores.find(f => f.documento === docLimpo && f.id !== id);
      if (existe) {
        throw new Error('Já existe um fornecedor cadastrado com este documento.');
      }
      data.documento = docLimpo;
    }

    Object.assign(fornecedor, {
      ...data,
      updatedAt: new Date().toISOString()
    });

    return fornecedor;
  }

  setStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Fornecedor {
    const fornecedor = db.fornecedores.find(f => f.id === id);
    if (!fornecedor) throw new Error('Fornecedor não encontrado.');
    
    fornecedor.status = status;
    fornecedor.updatedAt = new Date().toISOString();
    return fornecedor;
  }

  vincularProduto(supplierId: string, productId: string, supplierProductCode?: string): FornecedorProduto {
    const fornecedor = db.fornecedores.find(f => f.id === supplierId);
    if (!fornecedor) throw new Error('Fornecedor não encontrado.');

    const produto = db.produtos.find(p => p.id === productId);
    if (!produto) throw new Error('Produto não encontrado.');

    const existente = db.fornecedorProdutos.find(
      fp => fp.supplierId === supplierId && fp.productId === productId
    );

    if (existente) {
      if (supplierProductCode !== undefined) {
        existente.supplierProductCode = supplierProductCode;
      }
      return existente;
    }

    const vinculo: FornecedorProduto = {
      supplierId,
      productId,
      supplierProductCode,
      createdAt: new Date().toISOString()
    };
    db.fornecedorProdutos.push(vinculo);
    return vinculo;
  }

  desvincularProduto(supplierId: string, productId: string): boolean {
    const index = db.fornecedorProdutos.findIndex(
      fp => fp.supplierId === supplierId && fp.productId === productId
    );
    if (index !== -1) {
      db.fornecedorProdutos.splice(index, 1);
      return true;
    }
    return false;
  }
}
