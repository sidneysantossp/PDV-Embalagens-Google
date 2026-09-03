import React, { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, Smartphone, Trash2 } from 'lucide-react';
import type { PagamentoVenda, MetodoPagamento, ConfiguracaoPagamento, Cliente } from '../types';
import { splitIntoInstallments } from '../utils';

interface PagamentoModalProps {
  total: number;
  onClose: () => void;
  onConfirm: (pagamentos: Omit<PagamentoVenda, 'id' | 'vendaId'>[], extra?: { clienteId?: string; dueDate?: string }) => void;
}

const METHODS = [
  { id: 'CASH', label: 'Dinheiro', icon: DollarSign },
  { id: 'PIX', label: 'PIX', icon: Smartphone },
  { id: 'DEBIT_CARD', label: 'Débito', icon: CreditCard },
  { id: 'CREDIT_CARD', label: 'Crédito', icon: CreditCard },
  { id: 'STORE_CREDIT', label: 'A prazo', icon: CreditCard },
];

export default function PagamentoModal({ total, onClose, onConfirm }: PagamentoModalProps) {
  const [pagamentos, setPagamentos] = useState<Omit<PagamentoVenda, 'id' | 'vendaId'>[]>([]);
  
  const [selectedMethod, setSelectedMethod] = useState<MetodoPagamento | null>(null);
  const [valorInput, setValorInput] = useState('');
  const [valorRecebidoInput, setValorRecebidoInput] = useState('');
  const [installmentsInput, setInstallmentsInput] = useState(1);
  const [config, setConfig] = useState<ConfiguracaoPagamento | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    fetch('/api/config/pagamento')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(console.error);
    fetch('/api/clientes').then(r=>r.json()).then(setClientes).catch(()=>{});
  }, []);

  const totalCents = Math.round(total * 100);
  const pagoCents = pagamentos.reduce((acc, p) => acc + p.valorCentavos, 0);
  const restanteCents = totalCents - pagoCents;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const handleSelectMethod = (method: string) => {
    if (method === 'STORE_CREDIT' && !config?.allowStoreCredit) {
      alert('Venda a prazo desabilitada nas configurações.');
      return;
    }
    if (method === 'STORE_CREDIT' && pagamentos.length > 0) {
      alert('Venda a prazo deve ser 100% a prazo, sem outros pagamentos.');
      return;
    }
    if (pagamentos.some(p=> p.metodo === 'STORE_CREDIT')) {
      alert('Venda a prazo deve ser 100% a prazo, sem outros pagamentos.');
      return;
    }
    const existing = pagamentos.find(p => p.metodo === method);
    if (existing) {
      alert('Método já adicionado.');
      return;
    }
    setSelectedMethod(method as MetodoPagamento);
    setValorInput((restanteCents / 100).toFixed(2).replace('.', ','));
    if (method === 'CASH') {
      setValorRecebidoInput((restanteCents / 100).toFixed(2).replace('.', ','));
    }
    if (method === 'STORE_CREDIT') {
      // Força valor integral
      setValorInput((restanteCents / 100).toFixed(2).replace('.', ','));
      if (!dueDate) {
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+30);
        setDueDate(tomorrow.toISOString().slice(0,10));
      }
    }
    setInstallmentsInput(1);
  };

  const handleAddPayment = () => {
    if (!selectedMethod) return;

    if (selectedMethod === 'STORE_CREDIT') {
      if (!selectedClienteId) {
        alert('Selecione um cliente para realizar uma venda a prazo.');
        return;
      }
      if (!dueDate) {
        alert('Data de vencimento é obrigatória para venda a prazo.');
        return;
      }
      const todayStr = new Date().toISOString().slice(0,10);
      if (dueDate < todayStr) {
        alert('Data de vencimento não pode ser anterior à data da venda.');
        return;
      }
    }

    const valNum = parseFloat(valorInput.replace(',', '.')) || 0;
    const valCents = Math.round(valNum * 100);

    if (valCents <= 0) {
      alert('Valor inválido.');
      return;
    }

    if (valCents > restanteCents) {
      alert('O valor não pode ser maior que o restante.');
      return;
    }

    if (selectedMethod === 'STORE_CREDIT' && valCents !== restanteCents) {
      alert('Venda a prazo deve ser 100% a prazo com valor integral.');
      return;
    }

    let recebidoCents = undefined;
    let finalInstallments = 1;

    if (selectedMethod === 'CASH') {
      const recNum = parseFloat(valorRecebidoInput.replace(',', '.')) || 0;
      recebidoCents = Math.round(recNum * 100);
      if (recebidoCents < valCents) {
        alert('Valor recebido não pode ser menor que o valor aplicado.');
        return;
      }
    }

    if (selectedMethod === 'CREDIT_CARD') {
      finalInstallments = installmentsInput;
    }

    setPagamentos([...pagamentos, {
      metodo: selectedMethod,
      valorCentavos: valCents,
      valorRecebidoCentavos: recebidoCents,
      installments: finalInstallments
    }]);

    setSelectedMethod(null);
    setValorInput('');
    setValorRecebidoInput('');
    setInstallmentsInput(1);
  };

  const handleRemovePayment = (index: number) => {
    setPagamentos(pagamentos.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (restanteCents > 0) {
      alert('Ainda há valor restante a pagar.');
      return;
    }
    const hasStoreCredit = pagamentos.some(p=> p.metodo === 'STORE_CREDIT');
    if (hasStoreCredit) {
      if (!selectedClienteId) {
        alert('Selecione um cliente para realizar uma venda a prazo.');
        return;
      }
      if (!dueDate) {
        alert('Data de vencimento é obrigatória para venda a prazo.');
        return;
      }
      onConfirm(pagamentos, { clienteId: selectedClienteId, dueDate });
    } else {
      onConfirm(pagamentos);
    }
  };

  const currentValCents = Math.round((parseFloat(valorInput.replace(',', '.')) || 0) * 100);
  const currentRecCents = Math.round((parseFloat(valorRecebidoInput.replace(',', '.')) || 0) * 100);
  const currentTrocoCents = selectedMethod === 'CASH' ? currentRecCents - currentValCents : 0;
  
  const previewInstallments = selectedMethod === 'CREDIT_CARD' ? splitIntoInstallments(currentValCents, installmentsInput) : [];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-[500px] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-[#DFE3DF]">
          <h2 className="text-xl font-bold text-[#15543C]">Finalizar Venda</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6 bg-[#F4F5F4] p-4 rounded-xl">
            <div>
              <div className="text-sm text-[#74747C]">Total</div>
              <div className="text-lg font-bold text-[#14171F]">{formatCurrency(totalCents)}</div>
            </div>
            <div>
              <div className="text-sm text-[#74747C]">Pago</div>
              <div className="text-lg font-bold text-[#48905A]">{formatCurrency(pagoCents)}</div>
            </div>
            <div>
              <div className="text-sm text-[#74747C]">Restante</div>
              <div className="text-lg font-bold text-[#E53E3E]">{formatCurrency(restanteCents)}</div>
            </div>
          </div>

          {/* List Added */}
          {pagamentos.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#14171F] mb-3">Pagamentos adicionados</h3>
              <div className="flex flex-col gap-2">
                {pagamentos.map((p, i) => (
                  <div key={i} className="flex justify-between items-center p-3 border border-[#DFE3DF] rounded-lg">
                    <div>
                      <div className="font-medium text-[#14171F]">{METHODS.find(m => m.id === p.metodo)?.label}</div>
                      {p.metodo === 'CASH' && (
                        <div className="text-xs text-[#74747C]">
                          Rec: {formatCurrency(p.valorRecebidoCentavos || 0)} | Troco: {formatCurrency((p.valorRecebidoCentavos || 0) - p.valorCentavos)}
                        </div>
                      )}
                      {p.metodo === 'CREDIT_CARD' && (p.installments || 1) > 1 && (
                        <div className="text-xs text-[#74747C]">
                          {p.installments}x de {formatCurrency(Math.floor(p.valorCentavos / p.installments!))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#15543C]">{formatCurrency(p.valorCentavos)}</span>
                      <button onClick={() => handleRemovePayment(i)} className="text-red-500 p-1 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Form */}
          {restanteCents > 0 && !selectedMethod && (
            <div>
              <h3 className="text-sm font-semibold text-[#14171F] mb-3">Adicionar pagamento</h3>
              <div className="grid grid-cols-2 gap-3">
                {METHODS.filter(m=> m.id !== 'STORE_CREDIT' || config?.allowStoreCredit).map(m => {
                  const Icon = m.icon;
                  const isAdded = pagamentos.some(p => p.metodo === m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSelectMethod(m.id)}
                      disabled={isAdded}
                      className={`flex items-center gap-2 p-3 border rounded-xl font-medium transition-colors ${
                        isAdded 
                          ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' 
                          : 'border-[#DFE3DF] hover:border-[#48905A] hover:bg-[#F3FAF4] text-[#14171F]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedMethod && (
            <div className="bg-[#F4F5F4] p-4 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-[#14171F]">{METHODS.find(m => m.id === selectedMethod)?.label}</h3>
                <button onClick={() => setSelectedMethod(null)} className="text-sm text-[#74747C] hover:text-[#14171F]">
                  Cancelar
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#74747C] mb-1">Valor aplicado</label>
                  <input
                    type="text"
                    value={valorInput}
                    onChange={(e) => { if(selectedMethod !== 'STORE_CREDIT') setValorInput(e.target.value.replace(/[^0-9,]/g, ''))}}
                    readOnly={selectedMethod === 'STORE_CREDIT'}
                    className={`w-full border border-[#DFE3DF] rounded-lg px-3 py-2 outline-none focus:border-[#48905A] ${selectedMethod === 'STORE_CREDIT' ? 'bg-gray-100' : ''}`}
                  />
                  {selectedMethod === 'STORE_CREDIT' && <div className="text-xs text-[#74747C] mt-1">Venda a prazo deve ser 100% do total.</div>}
                </div>

                {selectedMethod === 'STORE_CREDIT' && (
                  <>
                    <div>
                      <label className="block text-sm text-[#74747C] mb-1">Cliente *</label>
                      <select value={selectedClienteId} onChange={e=>setSelectedClienteId(e.target.value)} className="w-full border border-[#DFE3DF] rounded-lg px-3 py-2 outline-none focus:border-[#48905A]">
                        <option value="">Selecione cliente</option>
                        {clientes.filter(c=> (c as any).status !== 'INACTIVE').map(c=> (
                          <option key={c.id} value={c.id}>{c.nome} - {c.codigo}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-[#74747C] mb-1">Vencimento *</label>
                      <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="w-full border border-[#DFE3DF] rounded-lg px-3 py-2 outline-none focus:border-[#48905A]" />
                      <div className="text-xs text-[#74747C] mt-1">Registrar valor para recebimento futuro.</div>
                    </div>
                  </>
                )}

                {selectedMethod === 'CREDIT_CARD' && (
                  <div>
                    <label className="block text-sm text-[#74747C] mb-1">Parcelas</label>
                    <select
                      value={installmentsInput}
                      onChange={(e) => setInstallmentsInput(Number(e.target.value))}
                      className="w-full border border-[#DFE3DF] rounded-lg px-3 py-2 outline-none focus:border-[#48905A]"
                    >
                      {Array.from({ length: config?.maxCreditInstallments || 12 }).map((_, i) => {
                        const parcela = i + 1;
                        return (
                          <option key={parcela} value={parcela}>
                            {parcela}x
                          </option>
                        );
                      })}
                    </select>
                    
                    {installmentsInput > 1 && previewInstallments.length > 0 && (
                      <div className="mt-2 text-xs text-[#74747C] space-y-1">
                        <div className="font-medium text-[#14171F] mb-1">Resumo das parcelas:</div>
                        {previewInstallments.map((valorParcela, index) => (
                          <div key={index} className="flex justify-between">
                            <span>{index + 1}ª parcela</span>
                            <span>{formatCurrency(valorParcela)}</span>
                          </div>
                        ))}
                        {previewInstallments[0] !== previewInstallments[previewInstallments.length - 1] && (
                           <div className="text-xs text-[#74747C] italic pt-1">* Ajuste de centavos na primeira parcela</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectedMethod === 'CASH' && (
                  <>
                    <div>
                      <label className="block text-sm text-[#74747C] mb-1">Valor recebido</label>
                      <input
                        type="text"
                        value={valorRecebidoInput}
                        onChange={(e) => setValorRecebidoInput(e.target.value.replace(/[^0-9,]/g, ''))}
                        className="w-full border border-[#DFE3DF] rounded-lg px-3 py-2 outline-none focus:border-[#48905A]"
                      />
                    </div>
                    {currentTrocoCents > 0 && (
                      <div className="text-[#48905A] font-medium text-sm">
                        Troco: {formatCurrency(currentTrocoCents)}
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={handleAddPayment}
                  className="w-full py-3 bg-[#15543C] text-white rounded-lg font-medium hover:bg-[#0F3C2B]"
                >
                  Adicionar {formatCurrency(currentValCents)}
                </button>
              </div>
            </div>
          )}

        </div>

        <div className="p-6 border-t border-[#DFE3DF] flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 font-semibold text-[#74747C] hover:bg-gray-100 rounded-xl"
          >
            Voltar
          </button>
          <button 
            onClick={handleConfirm}
            disabled={restanteCents > 0}
            className="flex-1 py-3 font-semibold text-white bg-[#48905A] hover:bg-[#3D7A4D] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar venda
          </button>
        </div>
      </div>
    </div>
  );
}
