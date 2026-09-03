import { db } from '../db';
import type { Venda, VendaItem, PagamentoVenda, CancelamentoVenda, SessaoCaixa } from '../types';

export class VendaService {
  finalizarVenda(data: {
    subtotal: number;
    desconto: number;
    total: number;
    itens: VendaItem[];
    pagamentos: Omit<PagamentoVenda, 'id' | 'vendaId'>[];
    sessaoCaixaId: string;
  }): Venda {
    // Validações
    const caixaAberta = db.sessoesCaixa.find(s => s.id === data.sessaoCaixaId && s.status === 'OPEN');
    if (!caixaAberta) {
      throw new Error('Nenhum caixa aberto para registrar a venda.');
    }

    if (!data.pagamentos || data.pagamentos.length === 0) {
      throw new Error('É necessário informar pelo menos uma forma de pagamento.');
    }

    if (data.pagamentos.length > 4) {
      throw new Error('Máximo de 4 formas de pagamento por venda.');
    }

    const config = db.configuracaoPagamento;

    // Verificar duplicação de métodos
    const metodosVistos = new Set<string>();
    let totalPago = 0;

    for (const p of data.pagamentos) {
      if (metodosVistos.has(p.metodo)) {
        throw new Error(`Método de pagamento duplicado: ${p.metodo}.`);
      }
      metodosVistos.add(p.metodo);

      if (p.valorCentavos <= 0) {
        throw new Error('O valor de cada pagamento deve ser maior que zero.');
      }

      if (p.metodo === 'CASH') {
        if (!p.valorRecebidoCentavos || p.valorRecebidoCentavos < p.valorCentavos) {
          throw new Error('O valor recebido em dinheiro não pode ser menor que o valor aplicado.');
        }
      }

      let installments = p.installments ?? 1;
      if (p.metodo === 'CREDIT_CARD') {
        if (installments < 1 || installments > config.maxCreditInstallments) {
          throw new Error(`Número de parcelas no crédito deve ser entre 1 e ${config.maxCreditInstallments}.`);
        }
      } else {
        if (installments > 1) {
          throw new Error(`Parcelamento não permitido para o método ${p.metodo}.`);
        }
        installments = 1;
      }
      // Mutating to ensure default 1 is set
      p.installments = installments;

      totalPago += p.valorCentavos;
    }

    // A soma dos pagamentos aplicados deve ser exatamente o total (assumindo que `data.total` está em reais)
    // Precisamos de tudo em centavos internamente
    const totalCents = Math.round(data.total * 100);
    
    if (totalPago !== totalCents) {
      throw new Error(`A soma dos pagamentos (${totalPago / 100}) diverge do total da venda (${data.total}).`);
    }

    // Criar a Venda
    const novaVenda: Venda = {
      id: Date.now().toString(),
      data: new Date().toISOString(),
      subtotal: data.subtotal,
      desconto: data.desconto,
      total: data.total,
      itens: data.itens,
      status: 'COMPLETED',
      sessaoCaixaId: caixaAberta.id,
      pagamentos: data.pagamentos.map((p, index) => {
        let trocoCentavos = 0;
        let valorRecebidoCentavos = p.valorRecebidoCentavos;
        
        if (p.metodo === 'CASH') {
          trocoCentavos = (valorRecebidoCentavos || p.valorCentavos) - p.valorCentavos;
        } else {
          valorRecebidoCentavos = undefined;
          trocoCentavos = undefined as any;
        }

        return {
          id: `${Date.now()}-${index}`,
          vendaId: '', // Será preenchido depois
          metodo: p.metodo,
          valorCentavos: p.valorCentavos,
          valorRecebidoCentavos,
          trocoCentavos,
          installments: p.installments
        };
      })
    };

    novaVenda.pagamentos!.forEach(p => p.vendaId = novaVenda.id);

    // Baixa no estoque
    data.itens.forEach((item) => {
      const p = db.produtos.find(prod => prod.id === item.produtoId);
      if (p) p.estGeral -= item.quantidade;
    });

    db.vendas.push(novaVenda);
    return novaVenda;
  }

  cancelarVenda(vendaId: string, motivo: string, operador: string, observacao?: string): CancelamentoVenda {
    const venda = db.vendas.find(v => v.id === vendaId);
    
    if (!venda) {
      throw new Error('Venda não encontrada.');
    }
    
    if (venda.status === 'CANCELLED') {
      throw new Error('A venda já foi cancelada.');
    }

    if (!motivo) {
      throw new Error('Motivo do cancelamento é obrigatório.');
    }

    const sessao = db.sessoesCaixa.find(s => s.id === venda.sessaoCaixaId);
    if (!sessao || sessao.status === 'CLOSED') {
      throw new Error('Não é possível cancelar uma venda de um caixa já fechado.');
    }

    // Restaura estoque
    venda.itens.forEach((item) => {
      const p = db.produtos.find(prod => prod.id === item.produtoId);
      if (p) p.estGeral += item.quantidade;
    });

    venda.status = 'CANCELLED';

    const cancelamento: CancelamentoVenda = {
      id: Date.now().toString(),
      vendaId: venda.id,
      motivo,
      observacao,
      canceladoPor: operador,
      canceladoEm: new Date().toISOString()
    };

    // Note: mock db does not have cancelamentos array directly if we didn't add it.
    // Let's attach it to `db` object dynamically or store inside sale. For now we just return it.
    (db as any).cancelamentos = (db as any).cancelamentos || [];
    (db as any).cancelamentos.push(cancelamento);

    return cancelamento;
  }
}
