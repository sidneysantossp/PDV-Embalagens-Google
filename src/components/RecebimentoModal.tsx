import React, { useState } from 'react';

interface EnrichedItem {
  id: string;
  productId: string;
  productName: string;
  quantityOrdered: number;
  unitCostCents: number;
  received: number;
  pending: number;
}

interface RecebimentoModalProps {
  order: any; // enriched order
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecebimentoModal({ order, onClose, onSuccess }: RecebimentoModalProps) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [operador, setOperador] = useState('Operador');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (itemId: string, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setQuantities(prev => ({ ...prev, [itemId]: cleaned }));
  };

  const handleReceberTudo = () => {
    const next: Record<string, string> = {};
    order.enrichedItems.forEach((it: EnrichedItem) => {
      next[it.id] = String(it.pending);
    });
    setQuantities(next);
  };

  const getQty = (itemId: string) => parseInt(quantities[itemId] || '0', 10) || 0;

  const totalItens = order.enrichedItems.reduce((s: number, it: EnrichedItem) => s + getQty(it.id), 0);
  const totalValorCents = order.enrichedItems.reduce((s: number, it: EnrichedItem) => s + getQty(it.id) * it.unitCostCents, 0);

  const handleConfirm = async () => {
    setError('');
    const items = order.enrichedItems
      .map((it: EnrichedItem) => ({
        purchaseOrderItemId: it.id,
        quantityReceived: getQty(it.id),
      }))
      .filter((i: any) => i.quantityReceived > 0);

    if (items.length === 0) {
      setError('Informe pelo menos uma quantidade para receber.');
      return;
    }

    // front validation
    for (const it of order.enrichedItems as EnrichedItem[]) {
      const q = getQty(it.id);
      if (q > it.pending) {
        setError(`Quantidade para ${it.productName} excede pendente (${it.pending}).`);
        return;
      }
      if (q < 0) {
        setError('Quantidade não pode ser negativa.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/purchase-orders/${order.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          notes: notes || undefined,
          receivedBy: operador,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao receber');
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#15543C]">Receber pedido {order.orderNumber}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-3 bg-[#F4F5F4] text-sm flex flex-wrap gap-4">
          <span><strong>Fornecedor:</strong> {order.supplier?.nomeFantasia || order.supplier?.razaoSocial || order.supplier?.nome || order.supplierId}</span>
          <span><strong>Data pedido:</strong> {new Date(order.createdAt).toLocaleDateString('pt-BR')}</span>
          {order.expectedDelivery && <span><strong>Previsão:</strong> {new Date(order.expectedDelivery).toLocaleDateString('pt-BR')}</span>}
          <span><strong>Status:</strong> {order.status}</span>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-[#14171F]">Itens para recebimento</h3>
            <button onClick={handleReceberTudo} className="px-3 py-1.5 bg-[#48905A]/10 text-[#48905A] rounded-lg text-sm font-semibold hover:bg-[#48905A]/20">Receber tudo</button>
          </div>

          <div className="border border-[#DFE3DF] rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-[#DFE3DF]">
              <thead className="bg-[#F4F5F4]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Produto</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-[#74747C] uppercase">Pedido</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-[#74747C] uppercase">Já recebido</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-[#74747C] uppercase">Pendente</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-[#74747C] uppercase">Receber agora</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-[#74747C] uppercase">Custo unit.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE3DF]">
                {order.enrichedItems.map((it: EnrichedItem) => (
                  <tr key={it.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-[#14171F]">{it.productName}</td>
                    <td className="px-4 py-3 text-center">{it.quantityOrdered}</td>
                    <td className="px-4 py-3 text-center text-[#48905A] font-semibold">{it.received}</td>
                    <td className="px-4 py-3 text-center font-bold">{it.pending}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="text"
                        value={quantities[it.id] ?? ''}
                        onChange={e => handleChange(it.id, e.target.value)}
                        placeholder="0"
                        className="w-20 border border-[#DFE3DF] rounded-lg px-2 py-1 text-center outline-none focus:border-[#48905A]"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.unitCostCents / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#14171F] mb-1">Operador</label>
              <input value={operador} onChange={e => setOperador(e.target.value)} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5 outline-none focus:border-[#48905A]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#14171F] mb-1">Observações do recebimento</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: 5 caixas com embalagem danificada" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5 outline-none focus:border-[#48905A]" maxLength={500} />
            </div>
          </div>

          <div className="mt-4 p-4 bg-[#F4F5F4] rounded-xl flex justify-between">
            <div>
              <div className="text-sm text-[#74747C]">Itens desta entrada: <strong className="text-[#14171F]">{totalItens}</strong></div>
              <div className="text-sm text-[#74747C]">Total das mercadorias recebidas: <strong className="text-[#15543C]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValorCents / 100)}</strong></div>
            </div>
          </div>

          {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3 bg-gray-50">
          <button onClick={onClose} disabled={loading} className="px-5 py-2.5 border border-[#DFE3DF] rounded-xl font-semibold hover:bg-white">Voltar</button>
          <button onClick={handleConfirm} disabled={loading} className="px-6 py-2.5 bg-[#48905A] hover:bg-[#3D7A4D] text-white rounded-xl font-bold disabled:opacity-50">
            {loading ? 'Processando...' : 'Confirmar recebimento'}
          </button>
        </div>
      </div>
    </div>
  );
}
