import { db } from '../db';
import type { Venda, VendaItem, PagamentoVenda, CancelamentoVenda, SessaoCaixa } from '../types';

function nextReceivableNumber(): string {
  (db as any)._receivableCounter = ((db as any)._receivableCounter || 0) + 1;
  return `CR${String((db as any)._receivableCounter).padStart(6, '0')}`;
}
function isValidISODate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + 'T12:00:00');
  return !isNaN(d.getTime()) && d.toISOString().slice(0,10) === str;
}

export class VendaService {
  finalizarVenda(data: {
    subtotal: number;
    desconto: number;
    total: number;
    itens: VendaItem[];
    pagamentos: Omit<PagamentoVenda, 'id' | 'vendaId'>[];
    sessaoCaixaId: string;
    clienteId?: string;
    dueDate?: string;
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
    const hasStoreCredit = data.pagamentos.some(p => p.metodo === 'STORE_CREDIT');

    // STORE_CREDIT validações específicas
    if (hasStoreCredit) {
      if (!config.allowStoreCredit) {
        throw new Error('Venda a prazo desabilitada nas configurações.');
      }
      if (data.pagamentos.length !== 1) {
        throw new Error('Venda a prazo deve ser 100% a prazo, sem outros pagamentos.');
      }
      const storePayment = data.pagamentos[0];
      if (storePayment.metodo !== 'STORE_CREDIT') {
        throw new Error('Venda a prazo deve ser 100% a prazo, sem outros pagamentos.');
      }
      if (!data.clienteId) {
        throw new Error('Selecione um cliente para realizar uma venda a prazo.');
      }
      const cliente = db.clientes.find(c => c.id === data.clienteId);
      if (!cliente) throw new Error('Cliente não encontrado.');
      if ((cliente as any).status === 'INACTIVE') throw new Error('Cliente inativo não pode realizar venda a prazo.');
      if (!data.dueDate) throw new Error('Data de vencimento é obrigatória para venda a prazo.');
      if (!isValidISODate(data.dueDate)) throw new Error('Data de vencimento inválida.');
      const saleDateStr = new Date().toISOString().slice(0,10);
      if (data.dueDate < saleDateStr) throw new Error('Data de vencimento não pode ser anterior à data da venda.');
      // valor deve ser integral
      const totalCents = Math.round(data.total * 100);
      if (storePayment.valorCentavos !== totalCents) {
        throw new Error('Venda a prazo deve ser 100% a prazo com valor integral.');
      }
      if (storePayment.valorCentavos <= 0) {
        throw new Error('O valor de cada pagamento deve ser maior que zero.');
      }
    } else {
      // Validações normais (sem STORE_CREDIT)
      const metodosVistos = new Set<string>();
      let totalPago = 0;

      for (const p of data.pagamentos) {
        if (p.metodo === 'STORE_CREDIT') {
          throw new Error('Venda a prazo deve ser 100% a prazo, sem outros pagamentos.');
        }
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
        p.installments = installments;
        totalPago += p.valorCentavos;
      }

      const totalCents = Math.round(data.total * 100);
      if (totalPago !== totalCents) {
        throw new Error(`A soma dos pagamentos (${totalPago / 100}) diverge do total da venda (${data.total}).`);
      }
    }

    // Snapshot para transação
    const snapshot = {
      vendas: JSON.parse(JSON.stringify(db.vendas)),
      produtos: db.produtos.map(p => ({ id: p.id, estGeral: p.estGeral })),
      receivables: JSON.parse(JSON.stringify((db as any).accountReceivables || [])),
      receivableCounter: (db as any)._receivableCounter,
    };

    try {
      const totalCents = Math.round(data.total * 100);
      // Criar a Venda
      const novaVenda: Venda = {
        id: Date.now().toString() + Math.random().toString(36).slice(2,4),
        data: new Date().toISOString(),
        clienteId: data.clienteId,
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
            vendaId: '',
            metodo: p.metodo,
            valorCentavos: p.valorCentavos,
            valorRecebidoCentavos,
            trocoCentavos,
            installments: p.installments ?? 1
          };
        })
      };

      novaVenda.pagamentos!.forEach(p => p.vendaId = novaVenda.id);

      // Baixa no estoque - validar estoque suficiente
      for (const item of data.itens) {
        const prod = db.produtos.find(prod => prod.id === item.produtoId);
        if (!prod) throw new Error(`Produto não encontrado: ${item.produtoId}`);
        if (!db.configuracaoEstoque.allowNegativeStock && prod.estGeral < item.quantidade) throw new Error(`Estoque insuficiente para ${prod.nome}`);
      }
      // Criar StockMovements para venda? Para ledger, mas por enquanto apenas atualiza saldo
      // Futuramente criar StockMovement do tipo SALE
      data.itens.forEach((item) => {
        const p = db.produtos.find(prod => prod.id === item.produtoId);
        if (p) {
          const before = p.estGeral;
          p.estGeral -= item.quantidade;
          // Opcional: criar movimento SALE para auditoria (não obrigatório para ETAPA 19, mas útil)
          // Não criamos aqui para manter compatibilidade, o ledger já tem PURCHASE_RECEIPT e MANUAL
        }
      });

      db.vendas.push(novaVenda);

      // Se for venda a prazo, criar AccountReceivable
      if (hasStoreCredit) {
        const cliente = db.clientes.find(c => c.id === data.clienteId)!;
        // Verificar duplicidade sale_id
        if ((db as any).accountReceivables.some((r: any) => r.saleId === novaVenda.id)) {
          throw new Error('Já existe uma conta a receber para esta venda.');
        }
        const receivableNumber = nextReceivableNumber();
        const description = `Venda #${novaVenda.id.slice(-6)} — ${cliente.nome}`;
        const receivable: any = {
          id: Date.now().toString() + Math.random().toString(36).slice(2,4),
          receivableNumber,
          saleId: novaVenda.id,
          customerId: cliente.id,
          customerNameSnapshot: cliente.nome,
          customerDocumentSnapshot: cliente.cpf || cliente.cnpj || '',
          description,
          amountCents: totalCents,
          dueDate: data.dueDate!,
          status: 'OPEN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          saleNumberSnapshot: novaVenda.id,
        };
        (db as any).accountReceivables.push(receivable);
      }

      return novaVenda;
    } catch (e) {
      // ROLLBACK
      db.vendas = snapshot.vendas;
      for (const snap of snapshot.produtos) {
        const prod = db.produtos.find(p => p.id === snap.id);
        if (prod) prod.estGeral = snap.estGeral;
      }
      (db as any).accountReceivables = snapshot.receivables;
      (db as any)._receivableCounter = snapshot.receivableCounter;
      throw e;
    }
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

    const snapshot = {
      vendaStatus: venda.status,
      produtos: db.produtos.map(p => ({ id: p.id, estGeral: p.estGeral })),
      receivables: JSON.parse(JSON.stringify((db as any).accountReceivables || [])),
    };

    try {
      // Restaura estoque
      venda.itens.forEach((item) => {
        const p = db.produtos.find(prod => prod.id === item.produtoId);
        if (p) p.estGeral += item.quantidade;
      });

      venda.status = 'CANCELLED';

      // Se for venda a prazo, cancelar receivable
      const receivable = (db as any).accountReceivables?.find((r: any) => r.saleId === venda.id);
      if (receivable) {
        if (receivable.status === 'PAID') {
          throw new Error('Não é possível cancelar uma venda cujo valor a prazo já foi recebido. Estorne o recebimento antes de cancelar a venda.');
        }
        const isReversed = (pid:string)=> (db as any).accountReceivablePaymentReversals?.some((r:any)=> r.accountReceivablePaymentId===pid);
        const paid = (db as any).accountReceivablePayments?.filter((p:any)=> p.accountReceivableId===receivable.id && !isReversed(p.id)).reduce((s:number,p:any)=> s+p.amountCents,0) || 0;
        if (paid > 0 || receivable.status === 'PARTIALLY_PAID') {
          throw new Error('Não é possível cancelar uma venda que já possui recebimentos registrados.');
        }
        if (receivable.status === 'CANCELLED') throw new Error('Conta a receber já está cancelada.');
        receivable.status = 'CANCELLED';
        receivable.cancelledAt = new Date().toISOString();
        receivable.cancelledBy = operador;
        receivable.cancellationReason = motivo;
        receivable.updatedAt = new Date().toISOString();
      }

      const cancelamento: CancelamentoVenda = {
        id: Date.now().toString(),
        vendaId: venda.id,
        motivo,
        observacao,
        canceladoPor: operador,
        canceladoEm: new Date().toISOString()
      };

      (db as any).cancelamentos = (db as any).cancelamentos || [];
      (db as any).cancelamentos.push(cancelamento);

      return cancelamento;
    } catch (e) {
      // ROLLBACK
      venda.status = snapshot.vendaStatus as any;
      for (const snap of snapshot.produtos) {
        const prod = db.produtos.find(p => p.id === snap.id);
        if (prod) prod.estGeral = snap.estGeral;
      }
      (db as any).accountReceivables = snapshot.receivables;
      throw e;
    }
  }
}
