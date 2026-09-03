import React, { useState, useEffect } from 'react';
import { ShoppingCart, Ban, Info, X } from 'lucide-react';
import type { Venda } from '../types';

export default function VendasList() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenda, setSelectedVenda] = useState<Venda | null>(null);
  const [filtro, setFiltro] = useState<'TODAS' | 'COMPLETED' | 'CANCELLED'>('TODAS');
  
  const [cancelarModalOpen, setCancelarModalOpen] = useState(false);
  const [motivo, setMotivo] = useState('Erro no lançamento');
  const [observacao, setObservacao] = useState('');

  const loadVendas = async () => {
    try {
      const res = await fetch('/api/vendas');
      const data = await res.json();
      setVendas(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendas();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatCents = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const [receivable, setReceivable] = useState<any>(null);
  useEffect(()=>{
    if(selectedVenda){
      fetch(`/api/sales/${selectedVenda.id}/receivable`).then(r=>r.json()).then(data=> setReceivable(data)).catch(()=> setReceivable(null));
    } else setReceivable(null);
  },[selectedVenda]);

  const getPagamentoLabel = (venda: Venda) => {
    if (!venda.pagamentos || venda.pagamentos.length === 0) return 'N/A';
    if (venda.pagamentos.length === 1) {
      const p = venda.pagamentos[0];
      const methodLabel = p.metodo === 'CASH' ? 'Dinheiro' : 
                          p.metodo === 'DEBIT_CARD' ? 'Débito' : 
                          p.metodo === 'CREDIT_CARD' ? 'Crédito' : 
                          p.metodo === 'STORE_CREDIT' ? 'A prazo' : 'PIX';
      if (p.metodo === 'CREDIT_CARD' && p.installments && p.installments > 1) {
        return `${methodLabel} (${p.installments}x)`;
      }
      return methodLabel;
    }
    return `Misto (${venda.pagamentos.length} formas)`;
  };

  const handleCancelarVenda = async () => {
    if (!selectedVenda) return;
    try {
      const res = await fetch(`/api/vendas/${selectedVenda.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo, operador: 'Operador Padrão', observacao })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao cancelar venda');
      }
      alert('Venda cancelada com sucesso!');
      setCancelarModalOpen(false);
      setSelectedVenda(null);
      loadVendas();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const vendasFiltradas = vendas.filter(v => filtro === 'TODAS' || v.status === filtro);

  return (
    <div className="flex-1 p-8 bg-white overflow-hidden flex flex-col h-full rounded-tl-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#14171F] tracking-tight">Histórico de Vendas</h1>
          <p className="text-[#74747C] mt-1">Acompanhe e gerencie as vendas realizadas</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as any)}
            className="border border-[#DFE3DF] rounded-xl px-4 py-2 font-medium outline-none focus:border-[#48905A]"
          >
            <option value="TODAS">Todas</option>
            <option value="COMPLETED">Concluídas</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center text-[#74747C]">Carregando...</div>
        ) : vendasFiltradas.length === 0 ? (
          <div className="text-center text-[#74747C] py-12">Nenhuma venda encontrada.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#DFE3DF] text-sm text-[#74747C]">
                <th className="py-3 font-medium">Data</th>
                <th className="py-3 font-medium">Itens</th>
                <th className="py-3 font-medium">Total</th>
                <th className="py-3 font-medium">Pagamento</th>
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendasFiltradas.map((venda) => (
                <tr key={venda.id} className="border-b border-[#DFE3DF] hover:bg-gray-50">
                  <td className="py-4 text-[#14171F]">
                    {new Date(venda.data).toLocaleString()}
                  </td>
                  <td className="py-4 text-[#14171F]">
                    {venda.itens.reduce((acc, i) => acc + i.quantidade, 0)} un
                  </td>
                  <td className="py-4 font-bold text-[#15543C]">
                    {formatCurrency(venda.total)}
                  </td>
                  <td className="py-4 text-[#14171F]">
                    {getPagamentoLabel(venda)}
                  </td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${venda.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {venda.status === 'COMPLETED' ? 'Concluída' : 'Cancelada'}
                    </span>
                  </td>
                  <td className="py-4">
                    <button 
                      onClick={() => setSelectedVenda(venda)}
                      className="p-2 text-[#48905A] hover:bg-[#DDEBDD] rounded-full transition-colors"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedVenda && !cancelarModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-[#DFE3DF]">
              <h2 className="text-xl font-bold text-[#15543C]">Detalhe da Venda #{selectedVenda.id.slice(-6)}</h2>
              <button onClick={() => setSelectedVenda(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${selectedVenda.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {selectedVenda.status === 'COMPLETED' ? 'Concluída' : 'Cancelada'}
                </span>
                <p className="mt-2 text-sm text-[#74747C]">Data: {new Date(selectedVenda.data).toLocaleString()}</p>
              </div>

              <h3 className="font-semibold text-[#14171F] mb-3 border-b pb-2">Itens</h3>
              <div className="space-y-2 mb-6">
                {selectedVenda.itens.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.quantidade}x Produto {item.produtoId}</span>
                    <span className="font-medium">{formatCurrency(item.total)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 font-bold text-[#15543C]">
                  <span>Total da Venda</span>
                  <span>{formatCurrency(selectedVenda.total)}</span>
                </div>
              </div>

              {(selectedVenda as any).clienteId && receivable && (
                <div className="mb-4 bg-blue-50 border border-blue-100 p-3 rounded-lg text-sm">
                  <div className="font-semibold text-[#15543C]">Venda a prazo</div>
                  <div>Cliente: {receivable.customerNameSnapshot || (selectedVenda as any).clienteId}</div>
                  <div>Vencimento: {new Date(receivable.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}</div>
                  <div>Conta: {receivable.receivableNumber} — {receivable.status}</div>
                </div>
              )}

              <h3 className="font-semibold text-[#14171F] mb-3 border-b pb-2">Pagamentos</h3>
              <div className="space-y-3 mb-6">
                {selectedVenda.pagamentos?.map((p, i) => (
                  <div key={i} className="bg-gray-50 p-3 rounded-lg text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-[#14171F]">
                        {p.metodo === 'CASH' ? 'Dinheiro' : p.metodo === 'PIX' ? 'PIX' : p.metodo === 'DEBIT_CARD' ? 'Débito' : p.metodo === 'STORE_CREDIT' ? 'A prazo' : 'Crédito'}
                        {p.metodo === 'CREDIT_CARD' && (p.installments || 1) > 1 && ` (${p.installments} parcelas)`}
                      </span>
                      <span className="font-bold">{p.metodo === 'STORE_CREDIT' ? `Valor a receber ${formatCents(p.valorCentavos)}` : formatCents(p.valorCentavos)}</span>
                    </div>
                    {p.metodo === 'STORE_CREDIT' && receivable && (
                      <div className="text-xs text-[#74747C] mt-1">
                        <div>Vencimento: {new Date(receivable.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}</div>
                        <div>Conta: {receivable.receivableNumber} — {receivable.status === 'OPEN' ? 'Em aberto' : receivable.status === 'CANCELLED' ? 'Cancelada' : receivable.status}</div>
                      </div>
                    )}
                    {p.metodo === 'CREDIT_CARD' && (p.installments || 1) > 1 && (
                      <div className="text-xs text-[#74747C]">
                        {p.installments}x de {formatCents(Math.floor(p.valorCentavos / p.installments!))}
                      </div>
                    )}
                    {p.metodo === 'CASH' && p.valorRecebidoCentavos !== undefined && (
                      <div className="text-xs text-[#74747C]">
                        Recebido: {formatCents(p.valorRecebidoCentavos)} | Troco: {formatCents(p.valorRecebidoCentavos - p.valorCentavos)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedVenda.status === 'CANCELLED' && (selectedVenda as any).cancelamento && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 mt-4">
                  <h3 className="font-bold text-red-700 mb-2">Detalhes do Cancelamento</h3>
                  <p className="text-sm text-red-900"><strong>Motivo:</strong> {(selectedVenda as any).cancelamento.motivo}</p>
                  {(selectedVenda as any).cancelamento.observacao && (
                    <p className="text-sm text-red-900 mt-1"><strong>Observação:</strong> {(selectedVenda as any).cancelamento.observacao}</p>
                  )}
                  <p className="text-sm text-red-900 mt-2"><strong>Cancelado por:</strong> {(selectedVenda as any).cancelamento.canceladoPor}</p>
                  <p className="text-sm text-red-900"><strong>Em:</strong> {new Date((selectedVenda as any).cancelamento.canceladoEm).toLocaleString()}</p>
                </div>
              )}
            </div>

            {selectedVenda.status === 'COMPLETED' && (
              <div className="p-6 border-t border-[#DFE3DF]">
                <button 
                  onClick={() => setCancelarModalOpen(true)}
                  className="w-full py-3 font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Ban className="w-5 h-5" /> Cancelar venda
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {cancelarModalOpen && selectedVenda && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-[500px] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-[#DFE3DF]">
              <h2 className="text-xl font-bold text-red-600">Cancelar Venda</h2>
              <p className="text-sm text-[#74747C] mt-2">
                O cancelamento restaurará o estoque dos produtos e a venda deixará de compor os totais ativos do caixa.
              </p>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[#14171F] mb-1">Motivo do cancelamento *</label>
                <select 
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full border border-[#DFE3DF] rounded-lg px-3 py-2 outline-none focus:border-red-500"
                >
                  <option value="Erro no lançamento">Erro no lançamento</option>
                  <option value="Cliente desistiu">Cliente desistiu</option>
                  <option value="Forma de pagamento incorreta">Forma de pagamento incorreta</option>
                  <option value="Produto incorreto">Produto incorreto</option>
                  <option value="Quantidade incorreta">Quantidade incorreta</option>
                  <option value="Duplicidade">Duplicidade</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#14171F] mb-1">Observação (opcional)</label>
                <textarea 
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  maxLength={500}
                  className="w-full border border-[#DFE3DF] rounded-lg px-3 py-2 outline-none focus:border-red-500 resize-none h-24"
                />
              </div>
            </div>
            <div className="p-6 border-t border-[#DFE3DF] flex gap-3">
              <button 
                onClick={() => setCancelarModalOpen(false)}
                className="flex-1 py-3 font-semibold text-[#74747C] hover:bg-gray-100 rounded-xl"
              >
                Voltar
              </button>
              <button 
                onClick={handleCancelarVenda}
                className="flex-1 py-3 font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl"
              >
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
