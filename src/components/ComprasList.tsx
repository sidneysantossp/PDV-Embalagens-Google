import React, { useEffect, useState } from 'react';
import { Search, Plus, Eye, Truck, Package, ClipboardList } from 'lucide-react';
import RecebimentoModal from './RecebimentoModal';
import GerarContaModal from './GerarContaModal';

type StatusFilter = 'ALL' | 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

const statusLabels: Record<string, string> = {
  DRAFT: 'Rascunho',
  ORDERED: 'Pedido',
  PARTIALLY_RECEIVED: 'Parcialmente recebido',
  RECEIVED: 'Recebido',
  CANCELLED: 'Cancelado',
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ORDERED: 'bg-blue-100 text-blue-800',
  PARTIALLY_RECEIVED: 'bg-amber-100 text-amber-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function ComprasList() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showReceber, setShowReceber] = useState(false);
  const [receiptDetail, setReceiptDetail] = useState<any | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/purchase-orders')
      .then(r => r.json())
      .then(data => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (id: string) => {
    const res = await fetch(`/api/purchase-orders/${id}`);
    const data = await res.json();
    setSelected(data);
    setReceiptDetail(null);
  };

  const filtered = orders.filter(o => {
    if (filter !== 'ALL' && o.status !== filter) return false;
    if (search) {
      const term = search.toLowerCase();
      return o.orderNumber.toLowerCase().includes(term) || (o.supplier?.nomeFantasia || '').toLowerCase().includes(term);
    }
    return true;
  });

  if (selected) {
    return (
      <PedidoDetail
        order={selected}
        onBack={() => { setSelected(null); load(); }}
        onRefresh={async () => {
          const res = await fetch(`/api/purchase-orders/${selected.id}`);
          const data = await res.json();
          setSelected(data);
          load();
        }}
        onReceber={() => setShowReceber(true)}
        onViewReceipt={async (receiptId: string) => {
          const res = await fetch(`/api/purchase-receipts/${receiptId}`);
          const data = await res.json();
          setReceiptDetail(data);
        }}
        receiptDetail={receiptDetail}
        onCloseReceipt={() => setReceiptDetail(null)}
      />
    );
  }

  return (
    <div className="flex-1 p-8 bg-white overflow-hidden flex flex-col h-full rounded-tl-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#14171F] tracking-tight flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-[#15543C]" /> Compras
          </h1>
          <p className="text-[#74747C] mt-1">Pedidos de compra e recebimento de mercadorias.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-[#48905A] hover:bg-[#3D7A4D] text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2">
          <Plus className="w-5 h-5" /> Novo pedido
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pedido..." className="w-full pl-11 pr-4 py-3 border border-[#DFE3DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#48905A]" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value as any)} className="border border-[#DFE3DF] rounded-xl px-4 py-3 bg-white">
          <option value="ALL">Todos status</option>
          <option value="DRAFT">Rascunho</option>
          <option value="ORDERED">Pedido</option>
          <option value="PARTIALLY_RECEIVED">Parcialmente recebido</option>
          <option value="RECEIVED">Recebido</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto border border-[#DFE3DF] rounded-2xl">
        {loading ? <div className="p-8 text-center">Carregando...</div> : filtered.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            Nenhum pedido encontrado.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-[#DFE3DF]">
            <thead className="bg-[#F4F5F4] sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Pedido</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Fornecedor</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Recebimento</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-[#74747C] uppercase">Total</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-[#74747C] uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE3DF]">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-[#15543C]">{o.orderNumber}</td>
                  <td className="px-6 py-4 text-sm">{o.supplier?.nomeFantasia || o.supplier?.razaoSocial || o.supplierId?.slice(0,8)}</td>
                  <td className="px-6 py-4 text-sm">{new Date(o.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${statusColors[o.status]}`}>{statusLabels[o.status] || o.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">{o.totalReceived !== undefined ? `${o.totalReceived} / ${o.totalOrdered}` : '-'}</td>
                  <td className="px-6 py-4 text-right font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((o.totalCents || 0)/100)}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openDetail(o.id)} className="text-[#48905A] hover:underline inline-flex items-center gap-1"><Eye className="w-4 h-4" /> Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreatePedidoModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function PedidoDetail({ order, onBack, onRefresh, onReceber, onViewReceipt, receiptDetail, onCloseReceipt }: any) {
  const [actionError, setActionError] = useState('');
  const [receberOpen, setReceberOpen] = useState(false);
  const [gerarContaReceipt, setGerarContaReceipt] = useState<any | null>(null);
  const [receiptPayable, setReceiptPayable] = useState<any | null>(null);

  const canReceive = order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED';
  const confirmOrder = async () => {
    setActionError('');
    const res = await fetch(`/api/purchase-orders/${order.id}/order`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) setActionError(data.error);
    else onRefresh();
  };
  const cancelOrder = async () => {
    if (!confirm('Deseja cancelar este pedido?')) return;
    setActionError('');
    const res = await fetch(`/api/purchase-orders/${order.id}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) setActionError(data.error);
    else onRefresh();
  };

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-auto h-full rounded-tl-[32px]">
      <button onClick={onBack} className="mb-4 text-[#48905A] font-semibold">← Voltar</button>

      <div className="bg-white border border-[#DFE3DF] rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-[#14171F]">Pedido {order.orderNumber}</h2>
            <div className="mt-2 flex gap-3 text-sm">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[order.status]}`}>{statusLabels[order.status]}</span>
              <span>Fornecedor: <strong>{order.supplier?.nomeFantasia || order.supplier?.razaoSocial || order.supplierId}</strong></span>
              <span>Criado: {new Date(order.createdAt).toLocaleString('pt-BR')}</span>
            </div>
            {order.expectedDelivery && <div className="text-sm mt-1">Previsão de entrega: {new Date(order.expectedDelivery).toLocaleDateString('pt-BR')}</div>}
            {order.notes && <div className="text-sm mt-1">Obs: {order.notes}</div>}
          </div>
          <div className="flex gap-2">
            {order.status === 'DRAFT' && <button onClick={confirmOrder} className="px-4 py-2 bg-[#48905A] text-white rounded-xl font-bold">Confirmar pedido</button>}
            {canReceive && <button onClick={() => setReceberOpen(true)} className="px-4 py-2 bg-[#15543C] text-white rounded-xl font-bold">Receber mercadoria</button>}
            {(order.status === 'DRAFT' || order.status === 'ORDERED') && <button onClick={cancelOrder} className="px-4 py-2 border border-red-200 text-red-600 rounded-xl font-semibold">Cancelar</button>}
          </div>
        </div>
        {actionError && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{actionError}</div>}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-[#DFE3DF] rounded-2xl p-4 text-center">
          <div className="text-xs font-bold text-[#74747C] uppercase">Quantidade pedida</div>
          <div className="text-2xl font-bold text-[#14171F] mt-1">{order.totalOrdered}</div>
        </div>
        <div className="bg-white border border-[#DFE3DF] rounded-2xl p-4 text-center">
          <div className="text-xs font-bold text-[#74747C] uppercase">Quantidade recebida</div>
          <div className="text-2xl font-bold text-[#48905A] mt-1">{order.totalReceived}</div>
        </div>
        <div className="bg-white border border-[#DFE3DF] rounded-2xl p-4 text-center">
          <div className="text-xs font-bold text-[#74747C] uppercase">Quantidade pendente</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{order.totalPending}</div>
        </div>
      </div>

      <div className="bg-white border border-[#DFE3DF] rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b font-bold text-[#15543C]">Itens do pedido</div>
        <table className="min-w-full divide-y divide-[#DFE3DF]">
          <thead className="bg-[#F4F5F4]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Produto</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-[#74747C] uppercase">Pedido</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-[#74747C] uppercase">Recebido</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-[#74747C] uppercase">Pendente</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-[#74747C] uppercase">Custo</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-[#74747C] uppercase">Subtotal pedido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DFE3DF]">
            {order.enrichedItems?.map((it: any) => (
              <tr key={it.id}>
                <td className="px-6 py-4 font-medium">{it.productName}</td>
                <td className="px-6 py-4 text-center">{it.quantityOrdered}</td>
                <td className="px-6 py-4 text-center font-bold text-[#48905A]">{it.received}</td>
                <td className="px-6 py-4 text-center font-bold">{it.pending}</td>
                <td className="px-6 py-4 text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.unitCostCents/100)}</td>
                <td className="px-6 py-4 text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.subtotalCents/100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-3 bg-gray-50 text-right font-bold">Total pedido: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((order.totalCents||0)/100)}</div>
      </div>

      <div className="bg-white border border-[#DFE3DF] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b font-bold text-[#15543C]">Recebimentos</div>
        {order.receipts?.length === 0 ? <div className="p-8 text-center text-gray-500">Nenhum recebimento ainda.</div> : (
          <table className="min-w-full divide-y divide-[#DFE3DF]">
            <thead className="bg-[#F4F5F4]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Número</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Operador</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-[#74747C] uppercase">Itens</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-[#74747C] uppercase">Qtd total</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-[#74747C] uppercase">Valor recebido</th>
                <th className="px-6 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE3DF]">
              {order.receipts.map((r: any) => {
                const qtd = r.items.reduce((s: number, i: any) => s + i.quantityReceived, 0);
                return (
                  <tr key={r.id}>
                    <td className="px-6 py-4 font-mono font-bold text-[#15543C]">{r.receiptNumber}</td>
                    <td className="px-6 py-4 text-sm">{new Date(r.receivedAt).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 text-sm">{r.receivedBy}</td>
                    <td className="px-6 py-4 text-center">{r.items.length}</td>
                    <td className="px-6 py-4 text-center">{qtd}</td>
                    <td className="px-6 py-4 text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.totalReceivedCents/100)}</td>
                    <td className="px-6 py-4 text-right"><button onClick={() => onViewReceipt(r.id)} className="text-[#48905A] hover:underline">Ver</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {receberOpen && <RecebimentoModal order={order} onClose={() => setReceberOpen(false)} onSuccess={onRefresh} />}

      {receiptDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto" ref={(el:any)=>{
            if(el && receiptDetail && !receiptPayable){
              fetch(`/api/purchase-receipts/${receiptDetail.id}/payable`).then(r=>r.json()).then(data=> setReceiptPayable(data));
            }
          }}>
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg text-[#15543C]">Recebimento {receiptDetail.receiptNumber}</h3>
              <button onClick={()=>{ setReceiptPayable(null); onCloseReceipt(); }} className="text-2xl">×</button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div>Pedido: <strong>{receiptDetail.purchaseOrder?.orderNumber}</strong></div>
              <div>Fornecedor: <strong>{receiptDetail.supplier?.nomeFantasia || receiptDetail.supplier?.razaoSocial || receiptDetail.supplierId}</strong></div>
              <div>Data/hora: {new Date(receiptDetail.receivedAt).toLocaleString('pt-BR')}</div>
              <div>Operador: {receiptDetail.receivedBy}</div>
              {receiptDetail.notes && <div>Observação: {receiptDetail.notes}</div>}
              <div className="border-t pt-3 mt-3">
                <table className="min-w-full divide-y divide-[#DFE3DF]">
                  <thead><tr><th className="text-left py-2">Produto</th><th className="text-center py-2">Qtd</th><th className="text-right py-2">Custo</th><th className="text-right py-2">Subtotal</th></tr></thead>
                  <tbody>{receiptDetail.items.map((it: any) => (
                    <tr key={it.id} className="border-b"><td className="py-2">{it.productName}</td><td className="py-2 text-center">{it.quantityReceived}</td><td className="py-2 text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.unitCostCents/100)}</td><td className="py-2 text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.subtotalCents/100)}</td></tr>
                  ))}</tbody>
                </table>
                <div className="text-right font-bold mt-3">Total recebido: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receiptDetail.totalReceivedCents/100)}</div>
              </div>
              {receiptPayable ? (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm">Conta a pagar já gerada: <strong>{receiptPayable.payableNumber}</strong> — {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receiptPayable.amountCents/100)} venc. {new Date(receiptPayable.dueDate+'T12:00:00').toLocaleDateString('pt-BR')} — {receiptPayable.status}</div>
              ) : (
                <div className="mt-4"><button onClick={()=> setGerarContaReceipt(receiptDetail)} className="w-full py-2.5 bg-[#48905A] text-white rounded-xl font-bold">Gerar conta a pagar</button></div>
              )}
            </div>
            <div className="px-6 py-4 border-t text-right"><button onClick={()=>{ setReceiptPayable(null); onCloseReceipt(); }} className="px-5 py-2 border rounded-xl">Fechar</button></div>
          </div>
        </div>
      )}
      {gerarContaReceipt && <GerarContaModal receipt={gerarContaReceipt} onClose={()=> setGerarContaReceipt(null)} onSuccess={()=>{ setGerarContaReceipt(null); setReceiptPayable(null); fetch(`/api/purchase-receipts/${gerarContaReceipt.id}/payable`).then(r=>r.json()).then(data=> setReceiptPayable(data)); }} />}
    </div>
  );
}

function CreatePedidoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ productId: string; quantity: string; unitCost: string }[]>([{ productId: '', quantity: '', unitCost: '' }]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/fornecedores').then(r=>r.json()).then(setFornecedores);
    fetch('/api/produtos').then(r=>r.json()).then(setProdutos);
  }, []);

  const addItem = () => setItems([...items, { productId: '', quantity: '', unitCost: '' }]);
  const updateItem = (idx: number, field: string, value: string) => {
    const next = [...items];
    (next[idx] as any)[field] = value;
    // auto fill cost when selecting product
    if (field === 'productId') {
      const prod = produtos.find(p => p.id === value);
      if (prod) next[idx].unitCost = (prod.custo * 100).toFixed(0); // custo in reais -> centavos? prod.custo is float reais
      // but product custo is float; convert to centavos integer string
      // We'll store as reais display? Simpler to store centavos string but UX expects reais.
      // Let's set unitCost as reais string derived from custo
      if (prod) next[idx].unitCost = prod.custo.toFixed(2).replace('.', ',');
    }
    setItems(next);
  };
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!supplierId) { setError('Selecione o fornecedor.'); return; }
    const filtered = items.filter(it => it.productId && it.quantity);
    if (filtered.length === 0) { setError('Adicione pelo menos um item.'); return; }
    const payloadItems = [];
    for (const it of filtered) {
      const qty = parseInt(it.quantity, 10);
      if (!Number.isInteger(qty) || qty <= 0) { setError('Quantidade deve ser inteira maior que zero.'); return; }
      const costStr = it.unitCost.replace(',', '.');
      const costFloat = parseFloat(costStr);
      if (isNaN(costFloat) || costFloat < 0) { setError('Custo inválido.'); return; }
      const costCents = Math.round(costFloat * 100);
      payloadItems.push({ productId: it.productId, quantityOrdered: qty, unitCostCents: costCents });
    }
    setLoading(true);
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId, expectedDelivery: expectedDelivery || undefined, notes: notes || undefined, items: payloadItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated();
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg text-[#15543C]">Novo pedido de compra</h3>
          <button type="button" onClick={onClose} className="text-2xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Fornecedor *</label>
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5 outline-none focus:border-[#48905A]" required>
              <option value="">Selecione...</option>
              {fornecedores.filter(f => f.status === 'ACTIVE').map(f => (
                <option key={f.id} value={f.id}>{f.nomeFantasia || f.razaoSocial || f.nome} - {f.documento}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Previsão de entrega</label>
              <input type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5 outline-none focus:border-[#48905A]" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Observações</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5 outline-none focus:border-[#48905A]" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold">Itens *</label>
              <button type="button" onClick={addItem} className="text-sm text-[#48905A] font-bold">+ Adicionar item</button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end border border-[#DFE3DF] rounded-xl p-3">
                  <div className="col-span-5">
                    <label className="block text-xs font-bold text-[#74747C] uppercase">Produto</label>
                    <select value={it.productId} onChange={e => updateItem(idx, 'productId', e.target.value)} className="w-full border border-[#DFE3DF] rounded-lg px-2 py-2 text-sm">
                      <option value="">Selecione</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.codigo} - {p.nome}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-bold text-[#74747C] uppercase">Qtd</label>
                    <input value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value.replace(/[^0-9]/g,''))} placeholder="0" className="w-full border border-[#DFE3DF] rounded-lg px-2 py-2 text-sm" />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-bold text-[#74747C] uppercase">Custo (R$)</label>
                    <input value={it.unitCost} onChange={e => updateItem(idx, 'unitCost', e.target.value.replace(/[^0-9,]/g,''))} placeholder="0,00" className="w-full border border-[#DFE3DF] rounded-lg px-2 py-2 text-sm" />
                  </div>
                  <div className="col-span-1 text-right">
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-500 text-sm">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3 bg-gray-50">
          <button type="button" onClick={onClose} className="px-5 py-2.5 border border-[#DFE3DF] rounded-xl font-semibold">Cancelar</button>
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-[#48905A] text-white rounded-xl font-bold disabled:opacity-50">{loading ? 'Salvando...' : 'Criar pedido'}</button>
        </div>
      </form>
    </div>
  );
}
