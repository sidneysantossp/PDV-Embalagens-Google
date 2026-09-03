import React, { useEffect, useState } from 'react';

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents/100);
}
function toISODate(d: Date){ return d.toISOString().slice(0,10); }

export default function GerarContaModal({ receipt, onClose, onSuccess }: { receipt: any; onClose: ()=>void; onSuccess: ()=>void }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [receiptDetail, setReceiptDetail] = useState<any>(null);

  useEffect(()=>{
    // fetch receipt detail to get defaults
    fetch(`/api/purchase-receipts/${receipt.id}`).then(r=>r.json()).then(data=>{
      setReceiptDetail(data);
      const orderNum = data.purchaseOrder?.orderNumber || '';
      const supplierName = data.supplier?.nomeFantasia || data.supplier?.razaoSocial || data.supplier?.nome || '';
      const defaultDesc = `Compra — Pedido ${orderNum} — Recebimento ${data.receiptNumber} — ${supplierName}`;
      setDescription(defaultDesc);
      setAmount((data.totalReceivedCents/100).toFixed(2).replace('.',','));
      // suggest due date using supplier prazo
      const prazo = data.supplier?.prazoPadraoPagamento;
      if (prazo !== undefined && prazo !== null) {
        const base = data.receivedAt.slice(0,10);
        const d = new Date(base + 'T12:00:00');
        d.setDate(d.getDate() + prazo);
        setDueDate(toISODate(d));
      }
    });
  }, [receipt.id]);

  const handleSubmit = async ()=>{
    setError('');
    const amountCents = Math.round(parseFloat(amount.replace(',', '.'))*100);
    if (!description.trim()) { setError('Descrição obrigatória.'); return; }
    if (!Number.isInteger(amountCents) || amountCents<=0) { setError('Valor deve ser maior que zero.'); return; }
    if (!dueDate) { setError('Vencimento obrigatório.'); return; }
    setLoading(true);
    try{
      const res = await fetch('/api/payables/from-receipt', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ purchaseReceiptId: receipt.id, description, amountCents, dueDate, notes: notes||undefined })});
      const data = await res.json();
      if(!res.ok) throw new Error(data.error);
      onSuccess();
      onClose();
    } catch(e:any){ setError(e.message);} finally{setLoading(false);}
  };

  if (!receiptDetail) return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-8 rounded-xl">Carregando...</div></div>;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg text-[#15543C]">Gerar conta a pagar</h3><button onClick={onClose} className="text-2xl">×</button></div>
        <div className="p-6 space-y-4">
          <div className="bg-[#F4F5F4] p-3 rounded-xl text-sm space-y-1">
            <div>Fornecedor: <strong>{receiptDetail.supplier?.nomeFantasia || receiptDetail.supplier?.razaoSocial || receiptDetail.supplier?.nome}</strong></div>
            <div>Pedido: <strong>{receiptDetail.purchaseOrder?.orderNumber}</strong> • Recebimento: <strong>{receiptDetail.receiptNumber}</strong></div>
            <div>Valor do recebimento: <strong>{formatCurrency(receiptDetail.totalReceivedCents)}</strong></div>
            {receiptDetail.supplier?.prazoPadraoPagamento !== undefined && <div>Prazo padrão: <strong>{receiptDetail.supplier.prazoPadraoPagamento} dias</strong></div>}
          </div>

          <div><label className="block text-sm font-semibold mb-1">Descrição *</label><input value={description} onChange={e=>setDescription(e.target.value)} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" maxLength={500} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-semibold mb-1">Valor da conta (R$) *</label><input value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9,]/g,''))} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" /></div>
            <div><label className="block text-sm font-semibold mb-1">Vencimento *</label><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" /></div>
          </div>
          <div><label className="block text-sm font-semibold mb-1">Observação</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1000} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" rows={2} /></div>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3 bg-gray-50">
          <button onClick={onClose} className="px-5 py-2.5 border rounded-xl bg-white">Cancelar</button>
          <button onClick={handleSubmit} disabled={loading} className="px-6 py-2.5 bg-[#48905A] text-white rounded-xl font-bold disabled:opacity-50">{loading?'Gerando...':'Gerar conta'}</button>
        </div>
      </div>
    </div>
  );
}
