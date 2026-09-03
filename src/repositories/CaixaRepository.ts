import { db } from '../db';
import type { SessaoCaixa, MovimentacaoCaixa } from '../types';

export class CaixaRepository {
  getSessaoAberta(): SessaoCaixa | undefined {
    return db.sessoesCaixa.find(s => s.status === 'OPEN');
  }

  getHistoricoSessoes(): SessaoCaixa[] {
    return [...db.sessoesCaixa].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
  }

  getMovimentacoesSessao(sessionId: string): MovimentacaoCaixa[] {
    return db.movimentacoesCaixa.filter(m => m.sessionId === sessionId);
  }

  salvarSessao(sessao: SessaoCaixa): void {
    const index = db.sessoesCaixa.findIndex(s => s.id === sessao.id);
    if (index >= 0) {
      db.sessoesCaixa[index] = sessao;
    } else {
      db.sessoesCaixa.push(sessao);
    }
  }

  salvarMovimentacao(movimentacao: MovimentacaoCaixa): void {
    db.movimentacoesCaixa.push(movimentacao);
  }
}
