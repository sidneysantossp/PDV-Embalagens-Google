import type { Produto, Cliente, Venda, MovimentacaoCaixa, SessaoCaixa, ConfiguracaoPagamento, Fornecedor, FornecedorProduto } from './types';

export const db = {
  configuracaoPagamento: {
    maxCreditInstallments: 12
  } as ConfiguracaoPagamento,
  produtos: [
    { id: '1', codigo: '001', nome: 'Copo descartável 200 ml', barra: '789123456001', valor: 4.90, custo: 2.00, estGeral: 100, imagem: 'https://images.unsplash.com/photo-1590494489370-b8c8d8b4e47d?w=150&h=118&fit=crop&q=80&mix=blend' },
    { id: '2', codigo: '002', nome: 'Marmita de alumínio', barra: '789123456002', valor: 1.79, custo: 0.80, estGeral: 500, imagem: 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?w=150&h=118&fit=crop&q=80&mix=blend' },
    { id: '3', codigo: '003', nome: 'Garfo descartável branco', barra: '789123456003', valor: 0.07, custo: 0.02, estGeral: 1000, imagem: 'https://images.unsplash.com/photo-1616053351221-5a9143c77d56?w=150&h=118&fit=crop&q=80&mix=blend' },
    { id: '4', codigo: '004', nome: 'Embalagem descartável 500 ml', barra: '789123456004', valor: 0.59, custo: 0.20, estGeral: 300, imagem: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=150&h=118&fit=crop&q=80&mix=blend' },
    { id: '5', codigo: '005', nome: 'Saco para lixo 100 L', barra: '789123456005', valor: 1.29, custo: 0.50, estGeral: 200, imagem: 'https://images.unsplash.com/photo-1584820927498-cafe4c107be5?w=150&h=118&fit=crop&q=80&mix=blend' },
  ] as Produto[],
  clientes: [] as Cliente[],
  fornecedores: [] as Fornecedor[],
  fornecedorProdutos: [] as FornecedorProduto[],
  vendas: [] as Venda[],
  sessoesCaixa: [] as SessaoCaixa[],
  movimentacoesCaixa: [] as MovimentacaoCaixa[],
};
