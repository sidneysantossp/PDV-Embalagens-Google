import React, { useEffect, useState } from 'react';
import { Search, Eye, Wallet, AlertCircle } from 'lucide-react';

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
function toISODate(d: Date){ return d.toISOString().slice(0,10); }
function getDerivedLabel(r: any){
  if (r.status === 'CANCELLED') return { label: 'Cancelada', cls: 'bg-gray-100 text-gray-700' };
  if (r.status === 'PAID') return { label: 'Recebida', cls: 'bg-blue-100 text-blue-800' };
  const today = toISODate(new Date());
  if (r.dueDate === today) return { label: 'Vence hoje', cls: 'bg-amber-100 text-amber-800' };
  if (r.dueDate < today) return { label: 'Vencida', cls: 'bg-red-100 text-red-800' };
  return { label: 'Em aberto', cls: 'bg-green-100 text-green-800' };
}

export default function ContasAReceber(){
  const [receivables, setReceivables]=useState<any[]>([]);
  const [summary,setSummary]=useState<any>(null);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('ALL');
  const [dueFrom,setDueFrom]=useState('');
  const [dueTo,setDueTo]=useState('');
  const [selected,setSelected]=useState<any|null>(null);
  const [showReceber,setShowReceber]=useState(false);
  const [estornoRecPay,setEstornoRecPay]=useState<any>(null);
  const [estornoRecReason,setEstornoRecReason]=useState('');
  const [estornoRecNotes,setEstornoRecNotes]=useState('');
  const [estornoRecLoading,setEstornoRecLoading]=useState(false);
  const [estornoRecError,setEstornoRecError]=useState('');
  const [loading,setLoading]=useState(true);

  const load=()=>{
    const params=new URLSearchParams();
    if(search) params.set('q',search);
    if(filter) params.set('status',filter);
    if(dueFrom) params.set('dueFrom',dueFrom);
    if(dueTo) params.set('dueTo',dueTo);
    fetch(`/api/receivables?${params.toString()}`).then(r=>r.json()).then(d=>{ setReceivables(Array.isArray(d)?d:[]); setLoading(false);});
    fetch('/api/receivables/summary').then(r=>r.json()).then(setSummary);
  };
  useEffect(()=>{ load(); },[search,filter,dueFrom,dueTo]);

  const openDetail=async(id:string)=>{
    const r=await fetch(`/api/receivables/${id}`);
    const data=await r.json();
    setSelected(data);
  };

  return (
    <div className="flex-1 p-8 bg-white overflow-hidden flex flex-col h-full rounded-tl-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#14171F] flex items-center gap-2"><Wallet className="w-7 h-7 text-[#15543C]" /> Contas a receber</h1>
          <p className="text-[#74747C] mt-1">Acompanhe os valores a receber de clientes.</p>
        </div>
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
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por cliente, documento, venda, conta..." className="w-full pl-11 pr-4 py-3 border border-[#DFE3DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#48905A]" />
        </div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className="border border-[#DFE3DF] rounded-xl px-4 py-3 bg-white">
          <option value="ALL">Todas</option>
          <option value="OPEN">Em aberto</option>
          <option value="PARTIALLY_PAID">Parcialmente recebidas</option>
          <option value="DUE_TODAY">Vence hoje</option>
          <option value="OVERDUE">Vencidas</option>
          <option value="PAID">Recebidas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
        <input type="date" value={dueFrom} onChange={e=>setDueFrom(e.target.value)} className="border border-[#DFE3DF] rounded-xl px-4 py-3 bg-white" />
        <input type="date" value={dueTo} onChange={e=>setDueTo(e.target.value)} className="border border-[#DFE3DF] rounded-xl px-4 py-3 bg-white" />
      </div>

      <div className="flex-1 overflow-auto border border-[#DFE3DF] rounded-2xl">
        {loading ? <div className="p-8 text-center">Carregando...</div> : receivables.length===0 ? (
          <div className="p-16 text-center text-gray-500"><AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />Nenhuma conta encontrada.</div>
        ) : (
          <table className="min-w-full divide-y divide-[#DFE3DF]">
            <thead className="bg-[#F4F5F4] sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Vencimento</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Venda</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Descrição</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-[#74747C] uppercase">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-[#74747C] uppercase">Situação</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-[#74747C] uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE3DF]">
              {receivables.map((r:any)=>{
                const derived=getDerivedLabel(r);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{new Date(r.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4 text-sm font-medium">{r.customer?.nome || r.customerNameSnapshot || '-'}</td>
                    <td className="px-6 py-4 text-sm font-mono">{r.saleId.slice(-6)}</td>
                    <td className="px-6 py-4 text-sm">{r.description} <span className="text-xs text-gray-400">{r.receivableNumber}</span></td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-semibold">{formatCurrency(r.amountCents)}</div>
                      {r.status==='PARTIALLY_PAID' && (
                        <div className="text-xs text-gray-500">Recebido {formatCurrency(r.paidCents || 0)} • Restante {formatCurrency(r.remainingCents ?? r.amountCents)}</div>
                      )}
                      {r.status==='PAID' && <div className="text-xs text-blue-600">Recebido {formatCurrency(r.paidCents || r.amountCents)}</div>}
                    </td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-bold rounded-full ${derived.cls}`}>{derived.label}</span></td>
                    <td className="px-6 py-4 text-right"><button onClick={()=>openDetail(r.id)} className="text-[#48905A] hover:underline"><Eye className="w-4 h-4 inline" /> Ver</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg text-[#15543C]">Conta a receber {selected.receivableNumber}</h3>
              <button onClick={()=>setSelected(null)} className="text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getDerivedLabel(selected).cls}`}>{getDerivedLabel(selected).label}</span>
                <span className="text-sm">Vencimento: <strong>{new Date(selected.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>
              </div>
              <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl text-sm">
                <div><span className="block text-xs font-bold text-[#74747C] uppercase">Valor original</span><span className="font-bold">{formatCurrency(selected.amountCents)}</span></div>
                <div><span className="block text-xs font-bold text-[#74747C] uppercase">Total recebido</span><span className="font-bold text-blue-700">{formatCurrency(selected.paidCents ?? 0)}</span></div>
                <div><span className="block text-xs font-bold text-[#74747C] uppercase">Saldo restante</span><span className="font-bold text-[#15543C]">{formatCurrency(selected.remainingCents ?? selected.amountCents)}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="block text-xs font-bold text-[#74747C] uppercase">Cliente</span><span>{selected.customer?.nome || selected.customerNameSnapshot}</span><div className="text-xs text-gray-500">{selected.customer?.cpf || selected.customer?.cnpj || selected.customerDocumentSnapshot}</div><div className="text-xs text-gray-500">{selected.customer?.telefone || ''}</div></div>
                <div><span className="block text-xs font-bold text-[#74747C] uppercase">Venda</span><span>#{selected.saleId.slice(-6)}</span><div className="text-xs text-gray-500">{selected.sale ? `Total ${formatCurrency(Math.round(selected.sale.total*100))}` : ''}</div></div>
                <div><span className="block text-xs font-bold text-[#74747C] uppercase">Descrição</span><span>{selected.description}</span></div>
                <div><span className="block text-xs font-bold text-[#74747C] uppercase">Criada em</span><span>{new Date(selected.createdAt).toLocaleString('pt-BR')}</span></div>
              </div>
              {selected.sale && (
                <div className="border-t pt-3">
                  <div className="font-semibold text-sm mb-2">Itens da venda</div>
                  <div className="text-sm text-gray-600">Venda #{selected.sale.id.slice(-6)} — {selected.sale.itens?.length || 0} itens — {formatCurrency(Math.round(selected.sale.total*100))}</div>
                </div>
              )}
              {selected.status==='CANCELLED' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="font-bold text-red-800">Cancelada</div>
                  <div className="text-sm">Motivo: {selected.cancellationReason}</div>
                  <div className="text-sm">Cancelado por {selected.cancelledBy} em {selected.cancelledAt ? new Date(selected.cancelledAt).toLocaleString('pt-BR') : ''}</div>
                </div>
              )}
              {selected.status==='PAID' && selected.payment && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="font-bold text-blue-800 mb-2">Recebimento</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="block text-xs font-bold text-blue-700 uppercase">Forma</span><span>{selected.payment.paymentMethod==='CASH'?'Dinheiro':selected.payment.paymentMethod==='PIX'?'PIX':'Transferência bancária'}</span></div>
                    <div><span className="block text-xs font-bold text-blue-700 uppercase">Valor recebido</span><span>{formatCurrency(selected.payment.amountCents)}</span></div>
                    <div><span className="block text-xs font-bold text-blue-700 uppercase">Recebido em</span><span>{new Date(selected.payment.receivedAt).toLocaleString('pt-BR')}</span></div>
                    <div><span className="block text-xs font-bold text-blue-700 uppercase">Recebido por</span><span>{selected.payment.receivedBy}</span></div>
                    {selected.payment.notes && <div className="col-span-2"><span className="block text-xs font-bold text-blue-700 uppercase">Observação</span><span>{selected.payment.notes}</span></div>}
                    {selected.payment.cashSessionId && <div className="col-span-2"><span className="block text-xs font-bold text-blue-700 uppercase">Caixa</span><span>{selected.cashSession?.terminal || selected.payment.cashSessionId}</span></div>}
                  </div>
                </div>
              )}
              {selected.payments && selected.payments.length > 0 && (
                <div className="border border-[#DFE3DF] rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-[#F4F5F4] font-bold text-sm text-[#15543C]">Histórico de recebimentos ({selected.payments.length})</div>
                  <table className="min-w-full divide-y divide-[#DFE3DF] text-sm">
                    <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-xs font-bold text-[#74747C] uppercase">Data</th><th className="px-3 py-2 text-left text-xs font-bold text-[#74747C] uppercase">Forma</th><th className="px-3 py-2 text-right text-xs font-bold text-[#74747C] uppercase">Valor</th><th className="px-3 py-2 text-left text-xs font-bold text-[#74747C] uppercase">Operador</th><th className="px-3 py-2 text-left text-xs font-bold text-[#74747C] uppercase">Caixa</th><th className="px-3 py-2 text-left text-xs font-bold text-[#74747C] uppercase">Status</th><th className="px-3 py-2 text-right text-xs font-bold text-[#74747C] uppercase">Ação</th></tr></thead>
                    <tbody className="divide-y divide-[#DFE3DF]">
                      {selected.payments.map((pay:any)=>(
                        <tr key={pay.id} className={pay.isReversed ? 'bg-gray-50 opacity-60' : ''}>
                          <td className="px-3 py-2">{new Date(pay.receivedAt).toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2">{pay.paymentMethod==='CASH'?'Dinheiro':pay.paymentMethod==='PIX'?'PIX':'Transferência'}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(pay.amountCents)}</td>
                          <td className="px-3 py-2">{pay.receivedBy}</td>
                          <td className="px-3 py-2">{pay.cashSessionId ? (pay.cashSession?.terminal || pay.cashSessionId.slice(0,8)) : '-'}</td>
                          <td className="px-3 py-2">{pay.isReversed ? <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded-full text-xs font-bold">Estornado</span> : <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Efetivo</span>}</td>
                          <td className="px-3 py-2 text-right">
                            {!pay.isReversed ? (
                              <button onClick={()=> setEstornoRecPay(pay)} className="text-red-600 hover:underline text-xs font-semibold">Estornar</button>
                            ) : (
                              <span className="text-xs text-gray-500">{pay.reversal ? `Estornado em ${new Date(pay.reversal.reversedAt).toLocaleDateString('pt-BR')}` : ''}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {estornoRecPay && (
                    <div className="p-4 bg-red-50 border-t border-red-200">
                      <h4 className="font-bold text-red-700 mb-2">Estornar recebimento {formatCurrency(estornoRecPay.amountCents)} — {estornoRecPay.paymentMethod}</h4>
                      <p className="text-xs text-red-600 mb-2">Esta operação não apaga o registro original. Será criado um estorno auditável.</p>
                      {estornoRecPay.paymentMethod !== 'CASH' && <p className="text-xs text-amber-700 mb-2">Este estorno corrige apenas o registro interno. Nenhuma transação bancária será desfeita automaticamente.</p>}
                      <div className="space-y-2">
                        <div><label className="block text-xs font-bold uppercase">Motivo *</label>
                          <select value={estornoRecReason} onChange={e=>setEstornoRecReason(e.target.value)} className="w-full border border-[#DFE3DF] rounded-lg px-3 py-2 text-sm">
                            <option value="">Selecione</option>
                            <option>Lançamento incorreto</option>
                            <option>Forma de pagamento incorreta</option>
                            <option>Valor registrado incorretamente</option>
                            <option>Recebimento não confirmado</option>
                            <option>Duplicidade</option>
                            <option>Outro</option>
                          </select>
                        </div>
                        <div><label className="block text-xs font-bold uppercase">Observação</label><textarea value={estornoRecNotes} onChange={e=>setEstornoRecNotes(e.target.value)} maxLength={1000} className="w-full border border-[#DFE3DF] rounded-lg px-3 py-2 text-sm" rows={2} /></div>
                        {estornoRecError && <div className="p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">{estornoRecError}</div>}
                        <div className="flex gap-2">
                          <button onClick={()=> {setEstornoRecPay(null); setEstornoRecReason(''); setEstornoRecNotes(''); setEstornoRecError('');}} className="flex-1 py-2 border rounded-lg text-sm">Voltar</button>
                          <button onClick={async()=>{
                            if(!estornoRecReason.trim()){ setEstornoRecError('Motivo é obrigatório.'); return; }
                            setEstornoRecLoading(true);
                            setEstornoRecError('');
                            try{
                              const res=await fetch(`/api/receivable-payments/${estornoRecPay.id}/reverse`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason: estornoRecReason, notes: estornoRecNotes})});
                              const data=await res.json();
                              if(!res.ok) throw new Error(data.error);
                              setEstornoRecPay(null);
                              setEstornoRecReason('');
                              setEstornoRecNotes('');
                              // reload detail
                              const r=await fetch(`/api/receivables/${selected.id}`);
                              const newData=await r.json();
                              setSelected(newData);
                              // also reload list
                              const params=new URLSearchParams();
                              fetch(`/api/receivables?${params.toString()}`).then(r=>r.json()).then(d=> setReceivables(Array.isArray(d)?d:[]));
                            }catch(e:any){ setEstornoRecError(e.message);} finally{setEstornoRecLoading(false);}
                          }} disabled={estornoRecLoading} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">Confirmar estorno</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(selected.status==='OPEN' || selected.status==='PARTIALLY_PAID') && (
                <div className="flex justify-end">
                  <button onClick={()=> setShowReceber(true)} className="px-5 py-2 bg-[#48905A] text-white rounded-xl font-bold">Registrar recebimento</button>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t text-right bg-gray-50"><button onClick={()=>setSelected(null)} className="px-5 py-2 border rounded-xl bg-white">Fechar</button></div>
          </div>
        </div>
      )}
      {showReceber && selected && <ReceberModal receivable={selected} onClose={()=>setShowReceber(false)} onSuccess={()=>{ setShowReceber(false); setSelected(null); load(); }} />}
    </div>
  );
}

function ReceberModal({ receivable, onClose, onSuccess }: any){
  const paidCents = receivable.paidCents ?? 0;
  const remainingCents = receivable.remainingCents ?? (receivable.amountCents - paidCents);
  const [method, setMethod]=useState<'CASH'|'PIX'|'BANK_TRANSFER'>('PIX');
  const [notes,setNotes]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [saldo,setSaldo]=useState<number|null>(null);
  const [confirmStep,setConfirmStep]=useState(false);
  const [amount,setAmount]=useState<string>((remainingCents/100).toFixed(2).replace('.',','));
  useEffect(()=>{
    if(method==='CASH'){
      fetch('/api/caixa/atual').then(r=>r.json()).then(d=>{
        if(d && d.expectedAmountCents!==undefined) setSaldo(d.expectedAmountCents);
        else setSaldo(null);
      });
    }
  },[method]);
  const handleReceive=async()=>{
    setError('');
    const amountCents = Math.round((parseFloat(amount.replace(',', '.'))||0)*100);
    if (!Number.isInteger(amountCents) || amountCents <=0) { setError('Valor recebido deve ser inteiro maior que zero.'); return; }
    if (amountCents > remainingCents) { setError('O valor recebido não pode ser maior que o saldo restante.'); return; }
    setLoading(true);
    try{
      const res=await fetch(`/api/receivables/${receivable.id}/receive`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paymentMethod:method, amountCents, notes: notes||undefined})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error);
      onSuccess();
    }catch(e:any){ setError(e.message);} finally{setLoading(false);}
  };
  const amountCentsConfirm = Math.round((parseFloat(amount.replace(',', '.'))||0)*100);
  if(confirmStep){
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
          <div className="px-6 py-4 border-b"><h3 className="font-bold text-lg text-[#15543C]">Confirmar recebimento?</h3></div>
          <div className="p-6 space-y-2 text-sm">
            <div>Cliente: <strong>{receivable.customerNameSnapshot || receivable.customer?.nome}</strong></div>
            <div>Conta: <strong>{receivable.receivableNumber}</strong></div>
            <div>Valor a receber: <strong>{formatCurrency(amountCentsConfirm)}</strong></div>
            <div>Forma: <strong>{method==='CASH'?'Dinheiro':method==='PIX'?'PIX':'Transferência bancária'}</strong></div>
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          </div>
          <div className="px-6 py-4 border-t flex gap-3 bg-gray-50">
            <button onClick={()=>setConfirmStep(false)} className="flex-1 py-2.5 border rounded-xl">Voltar</button>
            <button onClick={handleReceive} disabled={loading} className="flex-1 py-2.5 bg-[#48905A] text-white rounded-xl font-bold disabled:opacity-50">{loading?'Processando...':'Confirmar recebimento'}</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg text-[#15543C]">Receber conta</h3><button onClick={onClose} className="text-2xl">×</button></div>
        <div className="p-6 space-y-4">
          <div className="bg-[#F4F5F4] p-3 rounded-xl text-sm space-y-1">
            <div>Conta: <strong>{receivable.receivableNumber}</strong></div>
            <div>Cliente: <strong>{receivable.customerNameSnapshot || receivable.customer?.nome}</strong></div>
            <div>Venda: <strong>#{receivable.saleId.slice(-6)}</strong></div>
            <div>Vencimento: <strong>{new Date(receivable.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>
            <div>Valor original: <strong>{formatCurrency(receivable.amountCents)}</strong></div>
            <div>Já recebido: <strong className="text-blue-700">{formatCurrency(paidCents)}</strong></div>
            <div>Saldo restante: <strong className="text-[#15543C] text-lg">{formatCurrency(remainingCents)}</strong></div>
          </div>
          <div><label className="block text-sm font-semibold mb-1">Valor recebido (R$) *</label>
            <input value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9,]/g,''))} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" />
            <div className="text-xs text-gray-500 mt-1">Saldo restante: {formatCurrency(remainingCents)}</div>
          </div>
          <div><label className="block text-sm font-semibold mb-1">Forma de recebimento *</label>
            <select value={method} onChange={e=>setMethod(e.target.value as any)} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5">
              <option value="CASH">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="BANK_TRANSFER">Transferência bancária</option>
            </select>
          </div>
          {method==='CASH' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
              {saldo===null ? <div className="text-red-600">Abra o caixa antes de receber uma conta em dinheiro.</div> : (
                <div>Caixa atual: <strong>{formatCurrency(saldo)}</strong> — entrada de {formatCurrency(receivable.amountCents)} aumentará o saldo.</div>
              )}
            </div>
          )}
          <div><label className="block text-sm font-semibold mb-1">Observação</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1000} placeholder="Ex: Pagamento recebido no balcão" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" rows={2} /></div>
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
