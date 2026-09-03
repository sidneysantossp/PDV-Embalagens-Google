export interface Produto {
  id: string;
  codigo: string;
  nome: string;
  barra: string;
  valor: number;
  custo: number;
  estGeral: number;
  minimumStockQuantity?: number;
  status?: 'ACTIVE' | 'INACTIVE';
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
  status?: 'ACTIVE' | 'INACTIVE';
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

export type MetodoPagamento = 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'STORE_CREDIT';

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
  allowStoreCredit?: boolean;
}

export interface ConfiguracaoEstoque {
  allowNegativeStock: boolean;
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

export type TipoMovimentacaoCaixa = 'SUPPLY' | 'WITHDRAWAL' | 'PAYABLE_PAYMENT' | 'RECEIVABLE_RECEIPT' | 'PAYABLE_PAYMENT_REVERSAL' | 'RECEIVABLE_PAYMENT_REVERSAL';

export interface MovimentacaoCaixa {
  id: string;
  sessionId: string;
  type: TipoMovimentacaoCaixa;
  amountCents: number;
  reason: string;
  note?: string;
  operator: string;
  createdAt: string;
  // reference for payable payment
  referenceType?: 'ACCOUNT_PAYABLE';
  referenceId?: string;
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

// ===== Módulo Compras - Pedido de Compra (ETAPA 11) =====
export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrder {
  id: string;
  orderNumber: string; // PC000001
  supplierId: string;
  status: PurchaseOrderStatus;
  expectedDelivery?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  totalCents: number;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  productName: string; // snapshot
  quantityOrdered: number;
  unitCostCents: number;
  subtotalCents: number;
}

// PURCHASE RECEIPT - Entrada real de estoque
export interface PurchaseReceipt {
  id: string;
  receiptNumber: string; // REC-000001
  purchaseOrderId: string;
  supplierId: string;
  receivedBy: string;
  receivedAt: string;
  notes?: string;
  createdAt: string;
  totalReceivedCents: number;
  items: PurchaseReceiptItem[];
}

export interface PurchaseReceiptItem {
  id: string;
  purchaseReceiptId: string;
  purchaseOrderItemId: string;
  productId: string;
  productName: string;
  quantityReceived: number;
  unitCostCents: number;
  subtotalCents: number;
}

// Stock ledger
export type StockMovementType = 'PURCHASE_RECEIPT' | 'SALE' | 'ADJUSTMENT' | 'CANCEL_SALE' | 'MANUAL_ADJUSTMENT' | 'INVENTORY_ADJUSTMENT';
export type StockAdjustmentReason =
  | 'BREAKAGE'
  | 'DAMAGE'
  | 'LOSS'
  | 'EXTRAVIO'
  | 'INTERNAL_USE'
  | 'INVENTORY_ADJUSTMENT'
  | 'CORRECTION'
  | 'FOUND_SURPLUS'
  | 'OTHER';

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: number; // positivo = entrada, negativo = saída
  balanceAfter: number;
  balanceBefore?: number;
  referenceType: 'PURCHASE_RECEIPT' | 'SALE' | 'OTHER' | 'MANUAL_ADJUSTMENT' | 'INVENTORY_ADJUSTMENT';
  referenceId: string;
  createdAt: string;
  notes?: string;
  reason?: StockAdjustmentReason;
  operator?: string;
}

// ===== Módulo Financeiro - Contas a Pagar (ETAPA 12/13/14) =====
export type PayableStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type PayableSourceType = 'PURCHASE_RECEIPT' | 'MANUAL';
export type PayablePaymentMethod = 'CASH' | 'PIX' | 'BANK_TRANSFER';

export interface AccountPayable {
  id: string;
  payableNumber: string; // CP000001
  supplierId: string;
  supplierNameSnapshot?: string;
  supplierDocumentSnapshot?: string;
  sourceType: PayableSourceType;
  sourceId?: string | null; // purchaseReceiptId quando PURCHASE_RECEIPT
  purchaseReceiptId?: string | null; // FK específica nullable
  description: string;
  amountCents: number;
  dueDate: string; // YYYY-MM-DD
  status: PayableStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  // snapshots para busca
  receiptNumberSnapshot?: string;
  orderNumberSnapshot?: string;
  orderIdSnapshot?: string;
  // PAID info (ETAPA 13)
  paidAt?: string;
  paidBy?: string;
  paymentMethod?: PayablePaymentMethod;
  paymentId?: string;
}

export interface AccountPayablePayment {
  id: string;
  accountPayableId: string;
  payableNumberSnapshot?: string;
  paymentMethod: PayablePaymentMethod;
  amountCents: number;
  cashSessionId?: string | null;
  cashMovementId?: string | null;
  paidBy: string;
  paidAt: string;
  notes?: string;
  createdAt: string;
}

// ===== Contas a Receber - Crediário (ETAPA 15/16/17) =====
export type ReceivableStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export interface AccountReceivable {
  id: string;
  receivableNumber: string; // CR000001
  saleId: string;
  customerId: string;
  customerNameSnapshot?: string;
  customerDocumentSnapshot?: string;
  description: string;
  amountCents: number;
  dueDate: string; // YYYY-MM-DD
  status: ReceivableStatus;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  saleNumberSnapshot?: string;
  // PAID info (ETAPA 16)
  paidAt?: string;
  paidBy?: string;
  paymentMethod?: 'CASH' | 'PIX' | 'BANK_TRANSFER';
  paymentId?: string;
}

export interface AccountReceivablePayment {
  id: string;
  accountReceivableId: string;
  receivableNumberSnapshot?: string;
  paymentMethod: 'CASH' | 'PIX' | 'BANK_TRANSFER';
  amountCents: number;
  cashSessionId?: string | null;
  cashMovementId?: string | null;
  receivedBy: string;
  receivedAt: string;
  notes?: string;
  createdAt: string;
}

// ===== Estornos (ETAPA 18) =====
export interface AccountPayablePaymentReversal {
  id: string;
  accountPayablePaymentId: string;
  reason: string;
  notes?: string;
  reversedBy: string;
  reversedAt: string;
  cashMovementId?: string | null;
  createdAt: string;
}

export interface AccountReceivablePaymentReversal {
  id: string;
  accountReceivablePaymentId: string;
  reason: string;
  notes?: string;
  reversedBy: string;
  reversedAt: string;
  cashMovementId?: string | null;
  createdAt: string;
}
