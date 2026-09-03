const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');

const fornecedorTypes = `
export type TipoPessoa = 'PJ' | 'PF';
export type FornecedorStatus = 'ACTIVE' | 'INACTIVE';

export interface Fornecedor {
  id: string;
  tipoPessoa: TipoPessoa;
  documento: string; // normalizado, apenas numeros
  
  razaoSocial?: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  nome?: string;

  telefone?: string;
  celular?: string;
  email?: string;
  contatoPrincipal?: string;

  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;

  prazoPadraoPagamento?: number; 
  pedidoMinimoCentavos?: number;
  observacoes?: string;

  status: FornecedorStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface FornecedorProduto {
  supplierId: string;
  productId: string;
  supplierProductCode?: string;
  createdAt: string;
}
`;

content = content + '\n' + fornecedorTypes;
fs.writeFileSync('src/types.ts', content);
