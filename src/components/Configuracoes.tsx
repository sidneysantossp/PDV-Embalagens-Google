import React, { useState, useEffect } from 'react';
import type { ConfiguracaoPagamento } from '../types';

export default function Configuracoes() {
  const [config, setConfig] = useState<ConfiguracaoPagamento>({ maxCreditInstallments: 12 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetch('/api/config/pagamento')
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg('');
    try {
      const res = await fetch('/api/config/pagamento', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSuccessMsg('Configurações salvas com sucesso!');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Carregando configurações...</div>;

  return (
    <div className="flex-1 p-8 bg-white overflow-hidden flex flex-col h-full rounded-tl-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#14171F] tracking-tight">Configurações</h1>
          <p className="text-[#74747C] mt-1">Gerencie as opções do sistema</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-2xl">
        <div className="bg-[#F4F5F4] p-6 rounded-2xl">
          <h2 className="text-xl font-bold text-[#15543C] mb-4">Formas de pagamento</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-[#14171F] mb-2">Máximo de parcelas no cartão de crédito</label>
              <select 
                value={config.maxCreditInstallments}
                onChange={(e) => setConfig({ ...config, maxCreditInstallments: Number(e.target.value) })}
                className="w-full md:w-1/2 border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A] bg-white font-medium"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
              <p className="text-xs text-[#74747C] mt-2">Define o limite de parcelas disponíveis no checkout ao selecionar Cartão de Crédito.</p>
            </div>

            <div className="border-t border-[#DFE3DF] pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={!!config.allowStoreCredit} onChange={(e)=> setConfig({...config, allowStoreCredit: e.target.checked})} className="w-5 h-5 accent-[#48905A]" />
                <div>
                  <div className="text-sm font-semibold text-[#14171F]">Permitir venda a prazo / crediário</div>
                  <div className="text-xs text-[#74747C]">Registrar valor para recebimento futuro. Requer cliente e vencimento.</div>
                </div>
              </label>
            </div>

            <div className="pt-4 border-t border-[#DFE3DF]">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="py-3 px-6 bg-[#48905A] hover:bg-[#3D7A4D] text-white rounded-xl font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar configurações'}
              </button>
              {successMsg && <span className="ml-4 text-[#48905A] font-medium">{successMsg}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
