export interface Produto {
  id: string;
  codigo: string;
  nome: string;
  barra: string;
  valor: number;
  custo: number;
  estGeral: number;
  gradeRow?: string;
  gradeCol?: string;
  imagem?: string;
}

export interface Cliente {
  id: string;
  codigo: string;
  nome: string;
  endereco: string;
  cidade: string;
  estado: string;
  cnpj?: string;
  cpf?: string;
  ie?: string;
  telefone: string;
}

export interface Vendedor {
  id: string;
  codigo: string;
  nome: string;
  comissao: number;
}

export type VendaStatus = 'COMPLETED' | 'CANCELLED';

export interface Venda {
  id: string;
  data: string;
  clienteId?: string;
  vendedorId?: string;
  subtotal: number; // mantendo original em reais por hora, ou migrando pra centavos? O front usa valor em R$. Vou manter o padrão do App.tsx. Mas a regra pede "Valores monetários continuam em inteiro". Wait, App.tsx is using `subtotal`, `desconto`, `total` as float. "ARREDONDAMENTO Todos os valores trabalham em centavos."
  desconto: number;
  total: number;
  itens: VendaItem[];
  pagamentos?: PagamentoVenda[];
  status: VendaStatus;
  sessaoCaixaId?: string;
}

export interface VendaItem {
  produtoId: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
}

export type MetodoPagamento = 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD';

export interface PagamentoVenda {
  id: string;
  vendaId: string;
  metodo: MetodoPagamento;
  valorCentavos: number;
  valorRecebidoCentavos?: number;
  trocoCentavos?: number;
  installments?: number;
}

export interface ConfiguracaoPagamento {
  maxCreditInstallments: number;
}


export interface CancelamentoVenda {
  id: string;
  vendaId: string;
  motivo: string;
  observacao?: string;
  canceladoPor: string;
  canceladoEm: string;
}

export type StatusCaixa = 'OPEN' | 'CLOSED';

export interface SessaoCaixa {
  id: string;
  terminal: string;
  openedBy: string;
  openedAt: string;
  openingAmountCents: number;
  openingNote?: string;
  status: StatusCaixa;
  closedBy?: string;
  closedAt?: string;
  expectedAmountCents?: number;
  countedAmountCents?: number;
  differenceAmountCents?: number;
  closingNote?: string;
  entradas?: number;
  saidas?: number;
  movimentacoes?: MovimentacaoCaixa[];
}

export type TipoMovimentacaoCaixa = 'SUPPLY' | 'WITHDRAWAL';

export interface MovimentacaoCaixa {
  id: string;
  sessionId: string;
  type: TipoMovimentacaoCaixa;
  amountCents: number;
  reason: string;
  note?: string;
  operator: string;
  createdAt: string;
}


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
