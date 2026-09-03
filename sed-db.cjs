const fs = require('fs');
let content = fs.readFileSync('src/db.ts', 'utf8');

content = content.replace(
  `import type { Produto, Cliente, Venda, MovimentacaoCaixa, SessaoCaixa, ConfiguracaoPagamento } from './types';`,
  `import type { Produto, Cliente, Venda, MovimentacaoCaixa, SessaoCaixa, ConfiguracaoPagamento, Fornecedor, FornecedorProduto } from './types';`
);

content = content.replace(
  `fornecedores: [],`,
  `fornecedores: [] as Fornecedor[],\n  fornecedorProdutos: [] as FornecedorProduto[],`
);

fs.writeFileSync('src/db.ts', content);
