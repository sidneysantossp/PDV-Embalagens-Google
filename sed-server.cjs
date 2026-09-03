const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const importFornecedor = `import { FornecedorService } from './src/services/FornecedorService';
const fornecedorService = new FornecedorService();`;

content = content.replace(
  `const vendaService = new VendaService();`,
  `const vendaService = new VendaService();\n${importFornecedor}`
);

const routes = `
  // Módulo E - Fornecedores
  app.get('/api/fornecedores', (req, res) => {
    res.json(db.fornecedores);
  });

  app.post('/api/fornecedores', (req, res) => {
    try {
      const result = fornecedorService.criarFornecedor(req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put('/api/fornecedores/:id', (req, res) => {
    try {
      const result = fornecedorService.editarFornecedor(req.params.id, req.body);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch('/api/fornecedores/:id/status', (req, res) => {
    try {
      const result = fornecedorService.setStatus(req.params.id, req.body.status);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/fornecedores/:id/produtos', (req, res) => {
    const vinculados = db.fornecedorProdutos.filter(fp => fp.supplierId === req.params.id);
    const result = vinculados.map(fp => {
      const produto = db.produtos.find(p => p.id === fp.productId);
      return { ...fp, produto };
    }).filter(fp => fp.produto);
    res.json(result);
  });

  app.post('/api/fornecedores/:id/produtos', (req, res) => {
    try {
      const result = fornecedorService.vincularProduto(req.params.id, req.body.productId, req.body.supplierProductCode);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/fornecedores/:id/produtos/:productId', (req, res) => {
    try {
      fornecedorService.desvincularProduto(req.params.id, req.params.productId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
`;

content = content.replace(
  `app.listen(PORT,`,
  `${routes}\n\n  app.listen(PORT,`
);

fs.writeFileSync('server.ts', content);
