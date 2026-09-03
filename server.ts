import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type { Produto, Cliente, Venda, VendaItem } from './src/types';
import { db } from './src/db';
import { CaixaService } from './src/services/CaixaService';
import { VendaService } from './src/services/VendaService';

const caixaService = new CaixaService();
const vendaService = new VendaService();
import { FornecedorService } from './src/services/FornecedorService';
const fornecedorService = new FornecedorService();

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  app.get('/api/produtos', (req, res) => {
    res.json(db.produtos);
  });
  app.get('/api/clientes', (req, res) => {
    res.json(db.clientes);
  });
  app.post('/api/clientes', (req, res) => {
    const novo: Cliente = { id: Date.now().toString(), ...req.body };
    db.clientes.push(novo);
    res.json(novo);
  });

  app.get('/api/config/pagamento', (req, res) => {
    res.json(db.configuracaoPagamento);
  });

  app.put('/api/config/pagamento', (req, res) => {
    const { maxCreditInstallments } = req.body;
    if (typeof maxCreditInstallments === 'number' && maxCreditInstallments >= 1 && maxCreditInstallments <= 12) {
      db.configuracaoPagamento.maxCreditInstallments = maxCreditInstallments;
      res.json(db.configuracaoPagamento);
    } else {
      res.status(400).json({ error: 'maxCreditInstallments deve ser um número entre 1 e 12' });
    }
  });

  // Módulo C - Vendas / PDV
  app.post('/api/vendas', (req, res) => {
    try {
      const venda = vendaService.finalizarVenda(req.body);
      res.json(venda);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
  
  app.post('/api/vendas/:id/cancelar', (req, res) => {
    try {
      const { motivo, operador, observacao } = req.body;
      const cancelamento = vendaService.cancelarVenda(req.params.id, motivo, operador, observacao);
      res.json(cancelamento);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
  
  app.get('/api/vendas', (req, res) => {
    // Retorna as 50 vendas mais recentes com os cancelamentos (se houver)
    const vendasCompletas = db.vendas.map(v => {
      const cancelamento = (db as any).cancelamentos?.find((c: any) => c.vendaId === v.id);
      return { ...v, cancelamento };
    }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 50);
    res.json(vendasCompletas);
  });

  // Módulo D - Financeiro / Caixa
  app.get('/api/caixa/atual', (req, res) => {
    try {
      res.json(caixaService.getCaixaAtual());
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/caixa/movimentacao', (req, res) => {
    try {
      const mov = caixaService.registrarMovimentacao(req.body);
      res.json(mov);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/caixa/abrir', (req, res) => {
    try {
      const sessao = caixaService.abrirCaixa(req.body);
      res.json(sessao);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/caixa/fechar', (req, res) => {
    try {
      const sessao = caixaService.fecharCaixa(req.body);
      res.json(sessao);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/caixa/historico', (req, res) => {
    try {
      res.json(caixaService.getHistorico().slice(0, 20));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Vite middleware for development (must be last)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  
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


  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
