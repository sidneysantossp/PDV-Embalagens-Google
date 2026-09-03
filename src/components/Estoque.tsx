import React, { useEffect, useState } from 'react';
import { Package, Plus, ClipboardList, Search, TrendingUp, TrendingDown } from 'lucide-react';

function formatDate(iso: string){ return new Date(iso).toLocaleString('pt-BR'); }

const MOTIVOS_ENTRADA = [
  { value: 'FOUND_SURPLUS', label: 'Sobra encontrada' },
  { value: 'CORRECTION', label: 'Correção de lançamento' },
  { value: 'INVENTORY_ADJUSTMENT', label: 'Ajuste de inventário' },
  { value: 'OTHER', label: 'Outro' },
];
const MOTIVOS_SAIDA = [
  { value: 'BREAKAGE', label: 'Quebra' },
  { value: 'DAMAGE', label: 'Avaria' },
  { value: 'LOSS', label: 'Perda' },
  { value: 'EXTRAVIO', label: 'Extravio' },
  { value: 'INTERNAL_USE', label: 'Uso interno' },
  { value: 'CORRECTION', label: 'Correção de lançamento' },
  { value: 'INVENTORY_ADJUSTMENT', label: 'Ajuste de inventário' },
  { value: 'OTHER', label: 'Outro' },
];

export default function Estoque(){
  const [produtos,setProdutos]=useState<any[]>([]);
  const [movs,setMovs]=useState<any[]>([]);
  const [search,setSearch]=useState('');
  const [showAjuste,setShowAjuste]=useState(false);
  const [showInventario,setShowInventario]=useState(false);
  const [allowNegative,setAllowNegative]=useState(false);
  const [lowStock,setLowStock]=useState<any[]>([]);
  const [onlyLow,setOnlyLow]=useState(false);

  const load=()=>{
    fetch('/api/produtos').then(r=>r.json()).then(setProdutos);
    fetch('/api/estoque/movimentacoes').then(r=>r.json()).then(setMovs);
    fetch('/api/estoque/config').then(r=>r.json()).then(c=> setAllowNegative(c.allowNegativeStock));
    fetch('/api/estoque/low-stock').then(r=>r.json()).then(setLowStock);
  };
  useEffect(()=>{ load(); },[]);

  const filtered=produtos.filter(p=> (!onlyLow || lowStock.some(alert=>alert.productId===p.id)) && (!search || p.nome.toLowerCase().includes(search.toLowerCase()) || p.codigo.includes(search)));
  const saveMinimum=async(productId:string, value:string)=>{
    const minimumStockQuantity=Number(value);
    const res=await fetch(`/api/produtos/${productId}/minimum-stock`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({minimumStockQuantity})});
    if(!res.ok){ alert((await res.json()).error); return; } load();
  };

  return (
    <div className="flex-1 p-8 bg-white overflow-hidden flex flex-col h-full rounded-tl-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#14171F] flex items-center gap-2"><Package className="w-7 h-7 text-[#15543C]" /> Estoque</h1>
          <p className="text-[#74747C] mt-1">Controle de estoque e inventário.</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm border border-[#DFE3DF] rounded-xl px-4 py-2 bg-white">
            <input type="checkbox" checked={allowNegative} onChange={async e=>{
              const res=await fetch('/api/estoque/config',{method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({allowNegativeStock: e.target.checked})});
              if(res.ok){ setAllowNegative(e.target.checked); }
            }} />
            Permitir estoque negativo
          </label>
          <button onClick={()=>setShowAjuste(true)} className="bg-[#48905A] hover:bg-[#3D7A4D] text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2"><Plus className="w-5 h-5" /> Ajustar estoque</button>
          <button onClick={()=>setShowInventario(true)} className="bg-[#15543C] hover:bg-[#0F3C2B] text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2"><ClipboardList className="w-5 h-5" /> Inventário</button>
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar produto..." className="w-full pl-11 pr-4 py-3 border border-[#DFE3DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#48905A]" />
        </div>
        <button onClick={()=>setOnlyLow(!onlyLow)} className={`px-4 rounded-xl border font-semibold ${onlyLow ? 'bg-amber-100 border-amber-300 text-amber-800' : 'border-[#DFE3DF]'}`}>Estoque baixo ({lowStock.length})</button>
      </div>

      {lowStock.length>0 && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><strong>{lowStock.length} produto(s) precisam de reposição.</strong><button className="ml-3 underline font-semibold" onClick={()=>setOnlyLow(true)}>Ver produtos</button></div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
        <div className="border border-[#DFE3DF] rounded-2xl overflow-auto bg-white">
          <div className="px-4 py-3 bg-[#F4F5F4] font-bold text-sm text-[#15543C] sticky top-0">Produtos</div>
          <table className="min-w-full divide-y divide-[#DFE3DF]">
            <thead className="bg-gray-50 sticky top-10">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold text-[#74747C] uppercase">Produto</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-[#74747C] uppercase">Estoque</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-[#74747C] uppercase">Mínimo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE3DF]">
              {filtered.map(p=>(
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{p.codigo} — {p.nome}</td>
                  <td className="px-4 py-3 text-right font-bold text-[#15543C]">{p.estGeral}{lowStock.some(alert=>alert.productId===p.id) && <span className="ml-2 text-xs rounded bg-amber-100 px-2 py-1 text-amber-800">Reposição</span>}</td>
                  <td className="px-4 py-3 text-right"><input aria-label={`Estoque mínimo ${p.nome}`} type="number" min="0" step="1" defaultValue={p.minimumStockQuantity ?? 0} onBlur={e=>void saveMinimum(p.id,e.target.value)} className="w-16 rounded border border-[#DFE3DF] p-1 text-right" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-[#DFE3DF] rounded-2xl overflow-auto bg-white">
          <div className="px-4 py-3 bg-[#F4F5F4] font-bold text-sm text-[#15543C] sticky top-0">Reposição sugerida</div>
          {lowStock.length===0 ? <div className="p-6 text-gray-500">Nenhum produto abaixo do estoque mínimo.</div> : lowStock.map(alert=><div key={alert.productId} className="p-4 border-b text-sm"><strong>{alert.code} — {alert.productName}</strong><div className="mt-1 text-gray-600">Saldo {alert.currentStock} / mín. {alert.minimumStock} · Sugerido: <b>{alert.suggestedQuantity}</b></div><div className="text-gray-500">{alert.suppliersSummary}</div></div>)}
        </div>

        <div className="border border-[#DFE3DF] rounded-2xl overflow-auto bg-white">
          <div className="px-4 py-3 bg-[#F4F5F4] font-bold text-sm text-[#15543C] sticky top-0">Histórico de movimentações</div>
          <div className="divide-y divide-[#DFE3DF]">
            {movs.length===0 ? <div className="p-8 text-center text-gray-500">Nenhuma movimentação.</div> : movs.slice(0,50).map((m:any)=>(
              <div key={m.id} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    {m.quantity >0 ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                    {m.productId} — {m.type === 'MANUAL_ADJUSTMENT' ? `Ajuste manual — ${m.reason}` : m.type === 'INVENTORY_ADJUSTMENT' ? `Inventário — Divergência` : m.type}
                  </div>
                  <div className="text-xs text-gray-500">{formatDate(m.createdAt)} • {m.operator} {m.reason ? `• ${m.reason}` : ''} {m.notes ? `• ${m.notes}` : ''}</div>
                </div>
                <div className={`font-bold ${m.quantity>0 ? 'text-green-600' : 'text-red-600'}`}>{m.quantity>0 ? '+'+m.quantity : m.quantity} <span className="text-xs text-gray-400">({m.balanceBefore ?? '?'}→{m.balanceAfter})</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAjuste && <AjusteModal onClose={()=>setShowAjuste(false)} onSuccess={()=>{ setShowAjuste(false); load(); }} produtos={produtos} />}
      {showInventario && <InventarioModal onClose={()=>setShowInventario(false)} onSuccess={()=>{ setShowInventario(false); load(); }} produtos={produtos} />}
    </div>
  );
}

function AjusteModal({ onClose, onSuccess, produtos }: any){
  const [productId,setProductId]=useState('');
  const [direction,setDirection]=useState<'INCREASE'|'DECREASE'>('DECREASE');
  const [quantity,setQuantity]=useState('');
  const [reason,setReason]=useState('');
  const [notes,setNotes]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const selected=produtos.find((p:any)=>p.id===productId);
  const motivos = direction==='INCREASE' ? MOTIVOS_ENTRADA : MOTIVOS_SAIDA;
  const preview = selected ? (direction==='INCREASE' ? selected.estGeral + (parseInt(quantity)||0) : selected.estGeral - (parseInt(quantity)||0)) : 0;

  const handleConfirm=async()=>{
    setError('');
    const qty=parseInt(quantity);
    if(!productId){ setError('Selecione o produto.'); return; }
    if(!Number.isInteger(qty) || qty<=0){ setError('Quantidade deve ser inteira maior que zero.'); return; }
    if(!reason){ setError('Motivo é obrigatório.'); return; }
    if(reason==='OTHER' && !notes.trim()){ setError('Quando motivo for Outro, é necessário informar descrição complementar.'); return; }
    setLoading(true);
    try{
      const res=await fetch('/api/estoque/ajuste',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId, direction, quantity: qty, reason, notes: notes||undefined})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error);
      onSuccess();
    }catch(e:any){ setError(e.message);} finally{setLoading(false);}
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg text-[#15543C]">Ajustar estoque</h3><button onClick={onClose} className="text-2xl">×</button></div>
        <div className="p-6 space-y-4">
          <div><label className="block text-sm font-semibold mb-1">Produto *</label>
            <select value={productId} onChange={e=>setProductId(e.target.value)} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5">
              <option value="">Selecione</option>
              {produtos.map((p:any)=><option key={p.id} value={p.id}>{p.codigo} — {p.nome} (Estoque: {p.estGeral})</option>)}
            </select>
          </div>
          {selected && <div className="bg-[#F4F5F4] p-3 rounded-xl text-sm">Saldo atual: <strong>{selected.estGeral} unidades</strong></div>}
          <div className="flex gap-2">
            <button onClick={()=>setDirection('INCREASE')} className={`flex-1 py-2.5 rounded-xl font-bold border ${direction==='INCREASE' ? 'bg-green-100 border-green-300 text-green-800' : 'bg-white border-[#DFE3DF]'}`}>Entrada</button>
            <button onClick={()=>setDirection('DECREASE')} className={`flex-1 py-2.5 rounded-xl font-bold border ${direction==='DECREASE' ? 'bg-red-100 border-red-300 text-red-800' : 'bg-white border-[#DFE3DF]'}`}>Saída</button>
          </div>
          <div><label className="block text-sm font-semibold mb-1">Quantidade *</label><input value={quantity} onChange={e=>setQuantity(e.target.value.replace(/[^0-9]/g,''))} placeholder="0" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" /></div>
          <div><label className="block text-sm font-semibold mb-1">Motivo *</label>
            <select value={reason} onChange={e=>setReason(e.target.value)} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5">
              <option value="">Selecione</option>
              {motivos.map(m=> <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-semibold mb-1">Observação {reason==='OTHER' ? '*' : ''}</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1000} placeholder={reason==='OTHER' ? 'Descrição complementar obrigatória' : 'Opcional'} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" rows={2} /></div>
          {selected && quantity && (
            <div className="bg-gray-50 p-3 rounded-xl text-sm">
              <div>Resumo: {selected.estGeral} → <strong>{preview}</strong> ({direction==='INCREASE' ? '+' : '-'}{quantity ||0})</div>
            </div>
          )}
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t flex gap-3 bg-gray-50">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl">Voltar</button>
          <button onClick={handleConfirm} disabled={loading} className="flex-1 py-2.5 bg-[#48905A] text-white rounded-xl font-bold disabled:opacity-50">{loading?'Processando...':'Confirmar ajuste'}</button>
        </div>
      </div>
    </div>
  );
}

function InventarioModal({ onClose, onSuccess, produtos }: any){
  const [productId,setProductId]=useState('');
  const [counted,setCounted]=useState('');
  const [notes,setNotes]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const selected=produtos.find((p:any)=>p.id===productId);
  const countedNum=parseInt(counted);
  const current=selected?.estGeral ?? 0;
  const difference = Number.isInteger(countedNum) ? countedNum - current : 0;

  const handleConfirm=async()=>{
    setError('');
    if(!productId){ setError('Selecione o produto.'); return; }
    const countedInt=parseInt(counted);
    if(!Number.isInteger(countedInt) || countedInt <0){ setError('Contagem física deve ser inteira maior ou igual a zero.'); return; }
    setLoading(true);
    try{
      const res=await fetch('/api/estoque/inventario',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId, countedQuantity: countedInt, notes: notes||undefined})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error);
      if(data.difference===0){
        alert(data.message || 'Estoque já confere com a contagem informada.');
        onSuccess();
        return;
      }
      // Se backend retornou movimento, mostrar sucesso
      onSuccess();
    }catch(e:any){ setError(e.message);} finally{setLoading(false);}
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg text-[#15543C]">Inventário</h3><button onClick={onClose} className="text-2xl">×</button></div>
        <div className="p-6 space-y-4">
          <div><label className="block text-sm font-semibold mb-1">Produto *</label>
            <select value={productId} onChange={e=>setProductId(e.target.value)} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5">
              <option value="">Selecione</option>
              {produtos.map((p:any)=><option key={p.id} value={p.id}>{p.codigo} — {p.nome} (Estoque: {p.estGeral})</option>)}
            </select>
          </div>
          {selected && <div className="bg-[#F4F5F4] p-3 rounded-xl text-sm">Saldo no sistema: <strong>{current} unidades</strong></div>}
          <div><label className="block text-sm font-semibold mb-1">Contagem física *</label><input value={counted} onChange={e=>setCounted(e.target.value.replace(/[^0-9]/g,''))} placeholder="0" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" /></div>
          {selected && counted && !isNaN(countedNum) && (
            <div className="bg-gray-50 p-3 rounded-xl text-sm">
              <div>Diferença: <strong className={difference>0 ? 'text-green-600' : difference<0 ? 'text-red-600' : 'text-gray-600'}>{difference>0 ? '+'+difference : difference}</strong></div>
              {difference===0 ? <div className="text-green-700">Estoque já confere com a contagem informada.</div> : <div>Ajustar estoque para a contagem física? {current} → {countedNum} ({difference>0 ? '+'+difference : difference})</div>}
            </div>
          )}
          <div><label className="block text-sm font-semibold mb-1">Observação</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1000} placeholder="Ex: Contagem realizada no fechamento do dia" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-2.5" rows={2} /></div>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t flex gap-3 bg-gray-50">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl">Voltar</button>
          <button onClick={handleConfirm} disabled={loading} className="flex-1 py-2.5 bg-[#15543C] text-white rounded-xl font-bold disabled:opacity-50">{loading?'Processando...':'Confirmar contagem'}</button>
        </div>
      </div>
    </div>
  );
}
