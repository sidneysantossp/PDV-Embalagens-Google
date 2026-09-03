import { CaixaRepository } from '../repositories/CaixaRepository';
import { db } from '../db';
import type { SessaoCaixa, MovimentacaoCaixa } from '../types';

export class CaixaService {
  private repo = new CaixaRepository();

  private calcularEntradasVendas(sessaoId: string): number {
    return db.vendas
      .filter(v => v.sessaoCaixaId === sessaoId && v.status === 'COMPLETED')
      .flatMap(v => v.pagamentos || [])
      .filter(p => p.metodo === 'CASH')
      .reduce((acc, p) => acc + p.valorCentavos, 0);
  }

  getCaixaAtual() {
    const sessaoAberta = this.repo.getSessaoAberta();
    if (!sessaoAberta) return null;

    const movs = this.repo.getMovimentacoesSessao(sessaoAberta.id);
    const entradas = movs.filter(m => m.type === 'SUPPLY').reduce((acc, m) => acc + m.amountCents, 0);
    const saidas = movs.filter(m => m.type === 'WITHDRAWAL').reduce((acc, m) => acc + m.amountCents, 0);
    const entradasVendasCash = this.calcularEntradasVendas(sessaoAberta.id);
    
    const expectedAmountCents = sessaoAberta.openingAmountCents + entradas + entradasVendasCash - saidas;

    return {
      ...sessaoAberta,
      entradas,
      saidas,
      expectedAmountCents,
      entradasVendasCash, // opcional mostrar isso
      movimentacoes: movs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    };
  }

  getHistorico() {
    return this.repo.getHistoricoSessoes();
  }

  abrirCaixa(data: { terminal: string; openedBy: string; openingAmountCents: number; openingNote?: string }) {
    if (this.repo.getSessaoAberta()) {
      throw new Error('Já existe um caixa aberto.');
    }

    const novaSessao: SessaoCaixa = {
      id: Date.now().toString(),
      terminal: data.terminal || 'Caixa 01',
      openedBy: data.openedBy || 'Operador padrão',
      openedAt: new Date().toISOString(),
      openingAmountCents: data.openingAmountCents,
      openingNote: data.openingNote,
      status: 'OPEN'
    };
    
    this.repo.salvarSessao(novaSessao);
    return novaSessao;
  }

  fecharCaixa(data: { countedAmountCents: number; closingNote?: string }) {
    const sessao = this.repo.getSessaoAberta();
    if (!sessao) {
      throw new Error('Nenhum caixa aberto.');
    }

    const movs = this.repo.getMovimentacoesSessao(sessao.id);
    const entradas = movs.filter(m => m.type === 'SUPPLY').reduce((acc, m) => acc + m.amountCents, 0);
    const saidas = movs.filter(m => m.type === 'WITHDRAWAL').reduce((acc, m) => acc + m.amountCents, 0);
    const entradasVendasCash = this.calcularEntradasVendas(sessao.id);
    const expectedAmountCents = sessao.openingAmountCents + entradas + entradasVendasCash - saidas;

    const differenceAmountCents = data.countedAmountCents - expectedAmountCents;

    sessao.status = 'CLOSED';
    sessao.closedAt = new Date().toISOString();
    sessao.closedBy = sessao.openedBy;
    sessao.expectedAmountCents = expectedAmountCents;
    sessao.countedAmountCents = data.countedAmountCents;
    sessao.differenceAmountCents = differenceAmountCents;
    sessao.closingNote = data.closingNote;
    sessao.entradas = entradas;
    sessao.saidas = saidas;

    this.repo.salvarSessao(sessao);
    return sessao;
  }

  registrarMovimentacao(data: { type: 'SUPPLY' | 'WITHDRAWAL'; amountCents: number; reason: string; note?: string }) {
    const sessaoAberta = this.repo.getSessaoAberta();
    if (!sessaoAberta) {
      throw new Error('Nenhum caixa aberto.');
    }
    
    if (data.amountCents <= 0) {
      throw new Error('Valor deve ser maior que zero.');
    }
    
    if (!['SUPPLY', 'WITHDRAWAL'].includes(data.type)) {
      throw new Error('Tipo de movimentação inválido.');
    }

    const movs = this.repo.getMovimentacoesSessao(sessaoAberta.id);
    const entradas = movs.filter(m => m.type === 'SUPPLY').reduce((acc, m) => acc + m.amountCents, 0);
    const saidas = movs.filter(m => m.type === 'WITHDRAWAL').reduce((acc, m) => acc + m.amountCents, 0);
    const entradasVendasCash = this.calcularEntradasVendas(sessaoAberta.id);
    const saldoDisponivel = sessaoAberta.openingAmountCents + entradas + entradasVendasCash - saidas;

    if (data.type === 'WITHDRAWAL' && data.amountCents > saldoDisponivel) {
      throw new Error('Saldo insuficiente para realizar a sangria.');
    }

    const novaMovimentacao: MovimentacaoCaixa = {
      id: Date.now().toString(),
      sessionId: sessaoAberta.id,
      type: data.type,
      amountCents: data.amountCents,
      reason: data.reason,
      note: data.note,
      operator: sessaoAberta.openedBy,
      createdAt: new Date().toISOString()
    };
    
    this.repo.salvarMovimentacao(novaMovimentacao);
    return novaMovimentacao;
  }
}
