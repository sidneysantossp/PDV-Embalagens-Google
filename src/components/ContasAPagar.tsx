import React, { useEffect, useState } from 'react';
import { Search, Plus, Eye, Wallet, Calendar, AlertCircle } from 'lucide-react';

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
function toISODate(d: Date) {
  return d.toISOString().slice(0,10);
}
function getDerivedLabel(p: any) {
  if (p.status === 'CANCELLED') return { label: 'Cancelada', cls: 'bg-gray-100 text-gray-700' };
  if (p.status === 'PAID') return { label: 'Paga', cls: 'bg-blue-100 text-blue-800' };
  if (p.status === 'PARTIALLY_PAID') {
    // também pode estar vencida - mostrar parcialmente paga com indicação vencida separada via tooltip
    const today = toISODate(new Date());
    if (p.dueDate < today) return { label: 'Parcialmente paga • Vencida', cls: 'bg-amber-100 text-amber-800' };
    if (p.dueDate === today) return { label: 'Parcialmente paga • Vence hoje', cls: 'bg-amber-100 text-amber-800' };
    return { label: 'Parcialmente paga', cls: 'bg-cyan-100 text-cyan-800' };
  }
  const today = toISODate(new Date());
  if (p.dueDate === today) return { label: 'Vence hoje', cls: 'bg-amber-100 text-amber-800' };
  if (p.dueDate < today) return { label: 'Vencida', cls: 'bg-red-100 text-red-800' };
  return { label: 'Em aberto', cls: 'bg-green-100 text-green-800' };
}

export default function ContasAPagar() {
  const [payables, setPayables] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (filter) params.set('status', filter);
    if (dueFrom) params.set('dueFrom', dueFrom);
    if (dueTo) params.set('dueTo', dueTo);
    fetch(`/api/payables?${params.toString()}`).then(r=>r.json()).then(data=>{ setPayables(Array.isArray(data)?data:[]); setLoading(false); });
    fetch('/api/payables/summary').then(r=>r.json()).then(setSummary);
  };

  useEffect(()=>{ load(); }, [search, filter, dueFrom, dueTo]);

  const openDetail = async (id: string) => {
    const r = await fetch(`/api/payables/${id}`);
    const data = await r.json();
    setSelected(data);
  };

  return (
    <div className="flex-1 p-8 bg-white overflow-hidden flex flex-col h-full rounded-tl-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#14171F] flex items-center gap-2"><Wallet className="w-7 h-7 text-[#15543C]" /> Contas a pagar</h1>
          <p className="text-[#74747C] mt-1">Acompanhe os compromissos financeiros com fornecedores.</p>
        </div>
        <button onClick={()=>setShowCreate(true)} className="bg-[#48905A] hover:bg-[#3D7A4D] text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2"><Plus className="w-5 h-5" /> Nova conta</button>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-[#DFE3DF] rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-bold text-[#74747C] uppercase">Em aberto</div>
            <div className="text-2xl font-bold text-[#15543C] mt-1">{formatCurrency(summary.totalOpenCents)}</div>
            <div className="text-xs text-[#74747C] mt-1">{summary.countOpen} conta(s)</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-bold text-amber-700 uppercase">Vencendo hoje</div>
            <div className="text-2xl font-bold text-amber-800 mt-1">{formatCurrency(summary.dueTodayCents)}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-bold text-red-700 uppercase">Vencidas</div>
            <div className="text-2xl font-bold text-red-800 mt-1">{formatCurrency(summary.overdueCents)}</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por descrição, fornecedor, documento, REC, PC..." className="w-full pl-11 pr-4 py-3 border border-[#DFE3DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#48905A]" />
        </div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className="border border-[#DFE3DF] rounded-xl px-4 py-3 bg-white">
          <option value="ALL">Todas</option>
          <option value="OPEN">Em aberto</option>
          <option value="PARTIALLY_PAID">Parcialmente pagas</option>
          <option value="DUE_TODAY">Vencendo hoje</option>
          <option value="OVERDUE">Vencidas</option>
          <option value="PAID">Pagas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
        <input type="date" value={dueFrom} onChange={e=>setDueFrom(e.target.value)} className="border border-[#DFE3DF] rounded-xl px-4 py-3 bg-white" placeholder="De" />
        <input type="date" value={dueTo} onChange={e=>setDueTo(e.target.value)} className="border border-[#DFE3DF] rounded-xl px-4 py-3 bg-white" placeholder="Até" />
      </div>

      <div className="flex-1 overflow-auto border border-[#DFE3DF] rounded-2xl">
        {loading ? <div className="p-8 text-center">Carregando...</div> : payables.length===0 ? (
          <div className="p-16 text-center text-gray-500"><AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />Nenhuma conta encontrada.</div>
        ) : (
          <table className="min-w-full divide-y divide-[#DFE3DF]">
            <thead className="bg-[#F4F5F4] sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Vencimento</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Fornecedor</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Origem</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-[#74747C] uppercase">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Situação</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-[#74747C] uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE3DF]">
              {payables.map((p:any)=>{
                const derived = getDerivedLabel(p);
                const origem = p.sourceType==='PURCHASE_RECEIPT' ? `REC ${p.receiptNumberSnapshot || ''}` : 'Manual';
                const paid = p.paidCents || 0;
                const remaining = p.remainingCents !== undefined ? p.remainingCents : (p.amountCents - paid);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{new Date(p.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4 text-sm font-medium">{p.description} <span className="text-xs text-gray-400">{p.payableNumber}</span></td>
                    <td className="px-6 py-4 text-sm">{p.supplier?.nomeFantasia || p.supplierNameSnapshot || '-'} </td>
                    <td className="px-6 py-4 text-sm">{origem}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-semibold">{formatCurrency(p.amountCents)}</div>
                      {p.status==='PARTIALLY_PAID' && (
                        <div className="text-xs text-gray-500">Pago {formatCurrency(paid)} • Restante {formatCurrency(remaining)}</div>
                      )}
                      {p.status==='PAID' && <div className="text-xs text-blue-600">Pago {formatCurrency(paid)}</div>}
                    </td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-bold rounded-full ${derived.cls}`}>{derived.label}</span></td>
                    <td className="px-6 py-4 text-right"><button onClick={()=>openDetail(p.id)} className="text-[#48905A] hover:underline"><Eye className="w-4 h-4 inline" /> Ver</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <NovaContaModal onClose={()=>setShowCreate(false)} onCreated={()=>{setShowCreate(false); load();}} />}
      {selected && <DetalheConta payable={selected} onClose={()=>setSelected(null)} onUpdated={()=>{ setSelected(null); load(); }} />}
    </div>
  );
}

function NovaContaModal({ onClose, onCreated }: any) {
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [form, setForm] = useState({ supplierId:'', description:'', amount:'', dueDate:'', notes:'' });
  const [error, setError] = useState('');
  const [loading,setLoading]=useState(false);
  useEffect(()=>{ fetch('/api/fornecedores').then(r=>r.json()).then(setFornecedores); },[]);
  const handleSubmit = async (e: React.FormEvent)=>{
    e.preventDefault();
    setError('');
    const amountCents = Math.round(parseFloat(form.amount.replace(',', '.'))*100);
    if (!form.supplierId) { setError('Selecione fornecedor.'); return; }
    if (!form.description.trim()) { setError('Descrição obrigatória.'); return; }
    if (!Number.isInteger(amountCents) || amountCents<=0) { setError('Valor deve ser maior que zero.'); return; }
    if (!form.dueDate) { setError('Vencimento obrigatório.'); return; }
    setLoading(true);
    try{
      const res = await fetch('/api/payables', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ supplierId: form.supplierId, description: form.description, amountCents, dueDate: form.dueDate, notes: form.notes || undefined })});
      const data = await res.json();
      if(!res.ok) throw new Error(data.error);
      onCreated();
    } catch(e:any){ setError(e.message);} finally{setLoading(false);}
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg text-[#15543C]">Nova conta</h3><button type="button" onClick={onClose} className="text-2xl">×</button></div>
        <div className="p-6 space-y-4">
          <div><label className="block text-sm font-semibold mb-1">Fornecedor *</label><select value={form.supplierId} onChange={e=>setForm({...form, supplierId:e.target.value})} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" required><option value="">Selecione</option>{fornecedores.filter(f=>f.status==='ACTIVE').map(f=><option key={f.id} value={f.id}>{f.nomeFantasia||f.razaoSocial||f.nome}</option> )}</select></div>
          <div><label className="block text-sm font-semibold mb-1">Descrição *</label><input value={form.description} onChange={e=>setForm({...form, description:e.target.value})} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" maxLength={500} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-semibold mb-1">Valor (R$) *</label><input value={form.amount} onChange={e=>setForm({...form, amount:e.target.value.replace(/[^0-9,]/g,'')})} placeholder="0,00" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" required /></div>
            <div><label className="block text-sm font-semibold mb-1">Vencimento *</label><input type="date" value={form.dueDate} onChange={e=>setForm({...form, dueDate:e.target.value})} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" required /></div>
          </div>
          <div><label className="block text-sm font-semibold mb-1">Observação</label><textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} maxLength={1000} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" rows={3} /></div>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3 bg-gray-50"><button type="button" onClick={onClose} className="px-5 py-2.5 border rounded-xl">Cancelar</button><button type="submit" disabled={loading} className="px-6 py-2.5 bg-[#48905A] text-white rounded-xl font-bold disabled:opacity-50">{loading?'Salvando...':'Criar conta'}</button></div>
      </form>
    </div>
  );
}

function DetalheConta({ payable, onClose, onUpdated }: any) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ description: payable.description, amount: (payable.amountCents/100).toFixed(2).replace('.',','), dueDate: payable.dueDate, notes: payable.notes || '', supplierId: payable.supplierId });
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelForm, setCancelForm] = useState({ reason:'', notes:'' });
  const [pagarMode, setPagarMode] = useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const derived = getDerivedLabel(payable);
  const isOpen = payable.status==='OPEN' || payable.status==='PARTIALLY_PAID';
  const paidCents = payable.paidCents ?? payable.payments?.reduce((s:number,p:any)=>s+p.amountCents,0) ?? 0;
  const remainingCents = payable.remainingCents ?? (payable.amountCents - paidCents);
  const hasPayments = paidCents > 0;

  const handleSave = async ()=>{
    setError('');
    const amountCents = Math.round(parseFloat(form.amount.replace(',', '.'))*100);
    setLoading(true);
    try{
      const body: any = { description: form.description, amountCents, dueDate: form.dueDate, notes: form.notes };
      if (payable.sourceType==='MANUAL') body.supplierId = form.supplierId;
      const res = await fetch(`/api/payables/${payable.id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      const data = await res.json();
      if(!res.ok) throw new Error(data.error);
      setEditMode(false);
      onUpdated();
    } catch(e:any){ setError(e.message);} finally{setLoading(false);}
  };

  const handleCancel = async ()=>{
    setError('');
    if (!cancelForm.reason) { setError('Motivo obrigatório.'); return; }
    setLoading(true);
    try{
      const res = await fetch(`/api/payables/${payable.id}/cancel`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reason: cancelForm.reason, notes: cancelForm.notes })});
      const data = await res.json();
      if(!res.ok) throw new Error(data.error);
      setCancelMode(false);
      onUpdated();
    } catch(e:any){ setError(e.message);} finally{setLoading(false);}
  };

  const [suppliers,setSuppliers]=useState<any[]>([]);
  const [estornoPay,setEstornoPay]=useState<any>(null);
  const [estornoReason,setEstornoReason]=useState('');
  const [estornoNotes,setEstornoNotes]=useState('');
  useEffect(()=>{ if(editMode && payable.sourceType==='MANUAL'){ fetch('/api/fornecedores').then(r=>r.json()).then(setSuppliers); }},[editMode]);

  const handleEstorno = async ()=>{
    if(!estornoPay) return;
    if(!estornoReason.trim()){ setError('Motivo é obrigatório.'); return; }
    setLoading(true);
    setError('');
    try{
      const res=await fetch(`/api/payable-payments/${estornoPay.id}/reverse`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason: estornoReason, notes: estornoNotes})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error);
      setEstornoPay(null);
      setEstornoReason('');
      setEstornoNotes('');
      onUpdated();
    } catch(e:any){ setError(e.message);} finally{setLoading(false);}
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg text-[#15543C]">Conta a pagar {payable.payableNumber}</h3>
          <button onClick={onClose} className="text-2xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${derived.cls}`}>{derived.label}</span>
            <span>Vencimento: <strong>{new Date(payable.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>
          </div>
          <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl text-sm">
            <div><span className="block text-xs font-bold text-[#74747C] uppercase">Valor original</span><span className="font-bold">{formatCurrency(payable.amountCents)}</span></div>
            <div><span className="block text-xs font-bold text-[#74747C] uppercase">Total pago</span><span className="font-bold text-blue-700">{formatCurrency(paidCents)}</span></div>
            <div><span className="block text-xs font-bold text-[#74747C] uppercase">Saldo restante</span><span className="font-bold text-[#15543C]">{formatCurrency(remainingCents)}</span></div>
          </div>

          {!editMode ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="block text-xs font-bold text-[#74747C] uppercase">Descrição</span><span>{payable.description}</span></div>
                <div><span className="block text-xs font-bold text-[#74747C] uppercase">Fornecedor</span><span>{payable.supplier?.nomeFantasia || payable.supplierNameSnapshot}</span><div className="text-xs text-gray-500">{payable.supplier?.documento || payable.supplierDocumentSnapshot}</div></div>
                <div><span className="block text-xs font-bold text-[#74747C] uppercase">Origem</span><span>{payable.sourceType==='PURCHASE_RECEIPT' ? `Recebimento ${payable.receiptNumberSnapshot} — Pedido ${payable.orderNumberSnapshot}` : 'Lançamento manual'}</span></div>
                <div><span className="block text-xs font-bold text-[#74747C] uppercase">Criada em</span><span>{new Date(payable.createdAt).toLocaleString('pt-BR')} por {payable.createdBy}</span></div>
              </div>
              {payable.notes && <div><span className="block text-xs font-bold text-[#74747C] uppercase">Observação</span><p className="bg-gray-50 p-3 rounded-xl whitespace-pre-wrap text-sm">{payable.notes}</p></div>}
              {payable.status==='CANCELLED' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="font-bold text-red-800">Cancelamento</div>
                  <div className="text-sm">Motivo: {payable.cancellationReason}</div>
                  <div className="text-sm">Cancelado por {payable.cancelledBy} em {new Date(payable.cancelledAt).toLocaleString('pt-BR')}</div>
                </div>
              )}
              {hasPayments && (
                <div className="border border-[#DFE3DF] rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-[#F4F5F4] font-bold text-sm text-[#15543C]">Pagamentos ({payable.payments?.length || 0})</div>
                  <table className="min-w-full divide-y divide-[#DFE3DF] text-sm">
                    <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-xs font-bold text-[#74747C] uppercase">Data</th><th className="px-3 py-2 text-left text-xs font-bold text-[#74747C] uppercase">Forma</th><th className="px-3 py-2 text-right text-xs font-bold text-[#74747C] uppercase">Valor</th><th className="px-3 py-2 text-left text-xs font-bold text-[#74747C] uppercase">Operador</th><th className="px-3 py-2 text-left text-xs font-bold text-[#74747C] uppercase">Caixa</th><th className="px-3 py-2 text-left text-xs font-bold text-[#74747C] uppercase">Status</th><th className="px-3 py-2 text-right text-xs font-bold text-[#74747C] uppercase">Ação</th></tr></thead>
                    <tbody className="divide-y divide-[#DFE3DF]">
                      {(payable.payments || []).map((pay:any)=>(
                        <tr key={pay.id} className={pay.isReversed ? 'bg-gray-50 opacity-60' : ''}>
                          <td className="px-3 py-2">{new Date(pay.paidAt).toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2">{pay.paymentMethod==='CASH'?'Dinheiro':pay.paymentMethod==='PIX'?'PIX':'Transferência'}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(pay.amountCents)}</td>
                          <td className="px-3 py-2">{pay.paidBy}</td>
                          <td className="px-3 py-2">{pay.cashSessionId ? (pay.cashSession?.terminal || pay.cashSessionId.slice(0,8)) : '-'}</td>
                          <td className="px-3 py-2">{pay.isReversed ? <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded-full text-xs font-bold">Estornado</span> : <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Efetivo</span>}</td>
                          <td className="px-3 py-2 text-right">
                            {!pay.isReversed ? (
                              <button onClick={()=> setEstornoPay(pay)} className="text-red-600 hover:underline text-xs font-semibold">Estornar</button>
                            ) : (
                              <span className="text-xs text-gray-500">{pay.reversal ? `Estornado em ${new Date(pay.reversal.reversedAt).toLocaleDateString('pt-BR')}` : ''}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {estornoPay && (
                    <div className="p-4 bg-red-50 border-t border-red-200">
                      <h4 className="font-bold text-red-700 mb-2">Estornar pagamento {formatCurrency(estornoPay.amountCents)} — {estornoPay.paymentMethod}</h4>
                      <p className="text-xs text-red-600 mb-2">Esta operação não apaga o registro original. Será criado um estorno auditável.</p>
                      {estornoPay.paymentMethod !== 'CASH' && <p className="text-xs text-amber-700 mb-2">Este estorno corrige apenas o registro interno. Nenhuma transação bancária será desfeita automaticamente.</p>}
                      <div className="space-y-2">
                        <div><label className="block text-xs font-bold uppercase">Motivo *</label>
                          <select value={estornoReason} onChange={e=>setEstornoReason(e.target.value)} className="w-full border border-[#DFE3DF] rounded-lg px-3 py-2 text-sm">
                            <option value="">Selecione</option>
                            <option>Lançamento incorreto</option>
                            <option>Forma de pagamento incorreta</option>
                            <option>Valor registrado incorretamente</option>
                            <option>Pagamento não confirmado</option>
                            <option>Duplicidade</option>
                            <option>Outro</option>
                          </select>
                        </div>
                        <div><label className="block text-xs font-bold uppercase">Observação</label><textarea value={estornoNotes} onChange={e=>setEstornoNotes(e.target.value)} maxLength={1000} className="w-full border border-[#DFE3DF] rounded-lg px-3 py-2 text-sm" rows={2} /></div>
                        {error && <div className="p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">{error}</div>}
                        <div className="flex gap-2">
                          <button onClick={()=> {setEstornoPay(null); setEstornoReason(''); setEstornoNotes(''); setError('');}} className="flex-1 py-2 border rounded-lg text-sm">Voltar</button>
                          <button onClick={handleEstorno} disabled={loading} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">Confirmar estorno</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {payable.status==='PAID' && !hasPayments && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="font-bold text-blue-800 mb-2">Pagamento</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="block text-xs font-bold text-blue-700 uppercase">Forma</span><span>{payable.paymentMethod==='CASH'?'Dinheiro':payable.paymentMethod==='PIX'?'PIX':'Transferência bancária'}</span></div>
                    <div><span className="block text-xs font-bold text-blue-700 uppercase">Valor pago</span><span>{formatCurrency(payable.amountCents)}</span></div>
                    <div><span className="block text-xs font-bold text-blue-700 uppercase">Pago em</span><span>{payable.paidAt ? new Date(payable.paidAt).toLocaleString('pt-BR') : '-'}</span></div>
                    <div><span className="block text-xs font-bold text-blue-700 uppercase">Pago por</span><span>{payable.paidBy || '-'}</span></div>
                    {payable.payment?.notes && <div className="col-span-2"><span className="block text-xs font-bold text-blue-700 uppercase">Observação</span><span>{payable.payment.notes}</span></div>}
                    {payable.payment?.cashSessionId && <div className="col-span-2"><span className="block text-xs font-bold text-blue-700 uppercase">Caixa</span><span>{payable.cashSession?.terminal || payable.payment.cashSessionId} {payable.cashSession?.id ? `— Sessão ${payable.cashSession.id.slice(0,8)}` : ''}</span></div>}
                  </div>
                </div>
              )}
              {isOpen && (
                <div className="flex gap-2 pt-2">
                  <button onClick={()=>setPagarMode(true)} className="px-4 py-2 bg-[#48905A] text-white rounded-xl font-bold">Registrar pagamento</button>
                  <button onClick={()=>setEditMode(true)} disabled={hasPayments} className={`px-4 py-2 border border-[#DFE3DF] rounded-xl font-semibold ${hasPayments ? 'opacity-50 cursor-not-allowed' : ''}`} title={hasPayments ? 'Não é possível editar valor após pagamentos' : ''}>Editar</button>
                  <button onClick={()=>setCancelMode(true)} disabled={hasPayments} className={`px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold ${hasPayments ? 'opacity-50 cursor-not-allowed' : ''}`} title={hasPayments ? 'Não é possível cancelar com pagamentos' : ''}>Cancelar conta</button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {hasPayments && <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">Conta com pagamentos: valor, fornecedor e vencimento não podem ser alterados.</div>}
              {payable.sourceType==='MANUAL' && (
                <div><label className="block text-sm font-semibold mb-1">Fornecedor</label><select value={form.supplierId} onChange={e=>setForm({...form, supplierId:e.target.value})} disabled={hasPayments} className={`w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5 ${hasPayments ? 'bg-gray-100 cursor-not-allowed' : ''}`}>{suppliers.filter(f=>f.status==='ACTIVE').map(f=><option key={f.id} value={f.id}>{f.nomeFantasia||f.razaoSocial||f.nome}</option>)}</select></div>
              )}
              <div><label className="block text-sm font-semibold mb-1">Descrição</label><input value={form.description} onChange={e=>setForm({...form, description:e.target.value})} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold mb-1">Valor (R$)</label><input value={form.amount} onChange={e=>setForm({...form, amount:e.target.value.replace(/[^0-9,]/g,'')})} disabled={hasPayments} className={`w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5 ${hasPayments ? 'bg-gray-100 cursor-not-allowed' : ''}`} /></div>
                <div><label className="block text-sm font-semibold mb-1">Vencimento</label><input type="date" value={form.dueDate} onChange={e=>setForm({...form, dueDate:e.target.value})} disabled={hasPayments} className={`w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5 ${hasPayments ? 'bg-gray-100 cursor-not-allowed' : ''}`} /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">Observação</label><textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" rows={3} /></div>
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              <div className="flex gap-2">
                <button onClick={()=>setEditMode(false)} className="flex-1 py-2.5 border rounded-xl">Cancelar</button>
                <button onClick={handleSave} disabled={loading} className="flex-1 py-2.5 bg-[#48905A] text-white rounded-xl font-bold disabled:opacity-50">{loading?'Salvando...':'Salvar'}</button>
              </div>
            </div>
          )}

          {cancelMode && (
            <div className="border-t pt-4 mt-2 space-y-3">
              <h4 className="font-bold text-red-700">Cancelar conta a pagar</h4>
              <div><label className="block text-sm font-semibold mb-1">Motivo *</label>
                <select value={cancelForm.reason} onChange={e=>setCancelForm({...cancelForm, reason:e.target.value})} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5">
                  <option value="">Selecione</option>
                  <option>Lançamento incorreto</option>
                  <option>Duplicidade</option>
                  <option>Compra cancelada</option>
                  <option>Acordo com fornecedor</option>
                  <option>Outro</option>
                </select>
              </div>
              <div><label className="block text-sm font-semibold mb-1">Observação</label><textarea value={cancelForm.notes} onChange={e=>setCancelForm({...cancelForm, notes:e.target.value})} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" rows={2} /></div>
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              <div className="flex gap-2">
                <button onClick={()=>setCancelMode(false)} className="flex-1 py-2.5 border rounded-xl">Voltar</button>
                <button onClick={handleCancel} disabled={loading} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold disabled:opacity-50">Confirmar cancelamento</button>
              </div>
            </div>
          )}
          {pagarMode && <PagarContaModal payable={payable} onClose={()=>setPagarMode(false)} onSuccess={()=>{ setPagarMode(false); onUpdated(); }} />}
          {error && !editMode && !cancelMode && !pagarMode && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t text-right bg-gray-50"><button onClick={onClose} className="px-5 py-2 border rounded-xl bg-white">Fechar</button></div>
      </div>
    </div>
  );
}

function PagarContaModal({ payable, onClose, onSuccess }: any) {
  const [method, setMethod] = useState<'CASH' | 'PIX' | 'BANK_TRANSFER'>('PIX');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const paidCents = payable.paidCents ?? 0;
  const remainingCents = payable.remainingCents ?? (payable.amountCents - paidCents);
  const [amount, setAmount] = useState<string>( (remainingCents/100).toFixed(2).replace('.',',') );

  useEffect(()=>{
    if(method==='CASH'){
      fetch('/api/caixa/atual').then(r=>r.json()).then(data=>{
        if(data && data.expectedAmountCents !== undefined) setSaldo(data.expectedAmountCents);
        else setSaldo(null);
      });
    }
  }, [method]);

  const handlePay = async ()=>{
    setError('');
    const amountCents = Math.round(parseFloat(amount.replace(',', '.'))*100);
    if (!Number.isInteger(amountCents) || amountCents <=0) { setError('Valor deve ser maior que zero.'); return; }
    if (amountCents > remainingCents) { setError('O valor do pagamento não pode ser maior que o saldo restante.'); return; }
    if (method==='CASH' && saldo !== null && amountCents > saldo) { setError('Saldo insuficiente no caixa para realizar este pagamento.'); return; }
    setLoading(true);
    try{
      const res = await fetch(`/api/payables/${payable.id}/pay`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ paymentMethod: method, amountCents, notes: notes||undefined })});
      const data = await res.json();
      if(!res.ok) throw new Error(data.error);
      onSuccess();
    } catch(e:any){ setError(e.message);} finally{setLoading(false);}
  };

  const amountCentsPreview = Math.round((parseFloat(amount.replace(',', '.'))||0)*100);
  if(confirmStep){
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
          <div className="px-6 py-4 border-b"><h3 className="font-bold text-lg text-[#15543C]">Confirmar pagamento?</h3></div>
          <div className="p-6 space-y-2 text-sm">
            <div>Conta: <strong>{payable.payableNumber}</strong></div>
            <div>Fornecedor: <strong>{payable.supplierNameSnapshot || payable.supplier?.nomeFantasia}</strong></div>
            <div>Valor a pagar: <strong>{formatCurrency(amountCentsPreview)}</strong></div>
            <div>Forma: <strong>{method==='CASH'?'Dinheiro':method==='PIX'?'PIX':'Transferência bancária'}</strong></div>
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          </div>
          <div className="px-6 py-4 border-t flex gap-3 bg-gray-50">
            <button onClick={()=>setConfirmStep(false)} className="flex-1 py-2.5 border rounded-xl">Voltar</button>
            <button onClick={handlePay} disabled={loading} className="flex-1 py-2.5 bg-[#48905A] text-white rounded-xl font-bold disabled:opacity-50">{loading?'Processando...':'Confirmar pagamento'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg text-[#15543C]">Registrar pagamento</h3><button onClick={onClose} className="text-2xl">×</button></div>
        <div className="p-6 space-y-4">
          <div className="bg-[#F4F5F4] p-3 rounded-xl text-sm space-y-1">
            <div>Conta: <strong>{payable.payableNumber}</strong></div>
            <div>Fornecedor: <strong>{payable.supplierNameSnapshot || payable.supplier?.nomeFantasia}</strong></div>
            <div>Descrição: <strong>{payable.description}</strong></div>
            <div>Vencimento: <strong>{new Date(payable.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>
            <div>Valor original: <strong>{formatCurrency(payable.amountCents)}</strong></div>
            <div>Já pago: <strong className="text-blue-700">{formatCurrency(paidCents)}</strong></div>
            <div>Saldo restante: <strong className="text-[#15543C] text-lg">{formatCurrency(remainingCents)}</strong></div>
          </div>

          <div><label className="block text-sm font-semibold mb-1">Valor do pagamento (R$) *</label>
            <input value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9,]/g,''))} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" />
            <div className="text-xs text-gray-500 mt-1">Saldo restante: {formatCurrency(remainingCents)}</div>
          </div>

          <div><label className="block text-sm font-semibold mb-1">Forma de pagamento *</label>
            <select value={method} onChange={e=>setMethod(e.target.value as any)} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5">
              <option value="CASH">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="BANK_TRANSFER">Transferência bancária</option>
            </select>
          </div>

          {method==='CASH' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
              {saldo===null ? <div className="text-red-600">Nenhum caixa aberto. Abra o caixa antes de realizar um pagamento em dinheiro.</div> : (
                <>
                  <div>Saldo disponível no caixa: <strong>{formatCurrency(saldo)}</strong></div>
                  <div>Valor do pagamento: <strong>{formatCurrency(amountCentsPreview)}</strong></div>
                  {saldo < amountCentsPreview && <div className="text-red-600 font-bold mt-1">Saldo insuficiente no caixa para realizar este pagamento.</div>}
                </>
              )}
            </div>
          )}

          <div><label className="block text-sm font-semibold mb-1">Observação</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1000} placeholder="Ex: PIX enviado para conta informada" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" rows={2} /></div>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t flex gap-3 bg-gray-50">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl bg-white">Voltar</button>
          <button onClick={()=>setConfirmStep(true)} className="flex-1 py-2.5 bg-[#48905A] text-white rounded-xl font-bold">Continuar</button>
        </div>
      </div>
    </div>
  );
}
