import React, { useState, useEffect } from 'react';
import { Wallet, X, Lock, Unlock, ArrowDown, ArrowUp } from 'lucide-react';
import type { SessaoCaixa } from '../types';

export default function Caixa() {
  const [sessaoAberta, setSessaoAberta] = useState<SessaoCaixa | null>(null);
  const [historico, setHistorico] = useState<SessaoCaixa[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'abrir' | 'fechar' | 'suprimento' | 'sangria' | null>(null);
  
  // States for modal inputs (raw string inputs to handle currency)
  const [saldoInicialRaw, setSaldoInicialRaw] = useState('0,00');
  const [valorContadoRaw, setValorContadoRaw] = useState('0,00');
  const [valorMovimentacaoRaw, setValorMovimentacaoRaw] = useState('0,00');
  const [motivoMovimentacao, setMotivoMovimentacao] = useState('Fundo de troco');
  const [obsMovimentacao, setObsMovimentacao] = useState('');

  const carregarCaixa = async () => {
    setLoading(true);
    try {
      const [resAtual, resHist] = await Promise.all([
        fetch('/api/caixa/atual'),
        fetch('/api/caixa/historico')
      ]);
      const atual = await resAtual.json();
      const hist = await resHist.json();
      setSessaoAberta(atual);
      setHistorico(hist);
    } catch (err) {
      console.error('Erro ao carregar dados do caixa', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCaixa();
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR');
  };
  
  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const parseToCents = (val: string) => {
    const clean = val.replace(/[^\d,-]/g, '').replace(',', '.');
    return Math.round(parseFloat(clean) * 100) || 0;
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    let value = e.target.value.replace(/\D/g, '');
    if (!value) value = '0';
    const num = parseInt(value, 10);
    const str = (num / 100).toFixed(2).replace('.', ',');
    setter(str);
  };

  const handleAbrirCaixa = async () => {
    const cents = parseToCents(saldoInicialRaw);
    if (cents < 0) return alert('Saldo não pode ser negativo');
    
    try {
      const res = await fetch('/api/caixa/abrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openingAmountCents: cents,
          terminal: 'Caixa 01', // Simulation of terminal setup
          openedBy: 'Operador padrão'
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao abrir caixa');
      }
      setModalOpen(false);
      setSaldoInicialRaw('0,00');
      carregarCaixa();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFecharCaixa = async () => {
    const cents = parseToCents(valorContadoRaw);
    
    // Calcula diferença apenas para confirmar
    const expected = sessaoAberta?.openingAmountCents || 0;
    const diff = cents - expected;
    
    if (!window.confirm(`Deseja realmente fechar o caixa?\nValor Contado: ${formatCurrency(cents)}\nDiferença: ${formatCurrency(diff)}`)) {
      return;
    }
    
    try {
      const res = await fetch('/api/caixa/fechar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countedAmountCents: cents
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao fechar caixa');
      }
      setModalOpen(false);
      setValorContadoRaw('0,00');
      carregarCaixa();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMovimentacao = async () => {
    const cents = parseToCents(valorMovimentacaoRaw);
    if (cents <= 0) return alert('Informe um valor maior que zero.');

    try {
      const res = await fetch('/api/caixa/movimentacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: modalType === 'suprimento' ? 'SUPPLY' : 'WITHDRAWAL',
          amountCents: cents,
          reason: motivoMovimentacao,
          note: obsMovimentacao
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao registrar movimentação');
      }
      setModalOpen(false);
      setValorMovimentacaoRaw('0,00');
      setObsMovimentacao('');
      carregarCaixa();
      alert(`${modalType === 'suprimento' ? 'Suprimento' : 'Sangria'} registrada com sucesso.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex-1 bg-white rounded-[28px] my-[17px] mr-[17px] shadow-sm flex flex-col relative overflow-hidden border border-[#DFE2DF]/50">
      <header className="flex flex-col mt-[45px] ml-[34px] mr-[34px] mb-[30px]">
        <h1 className="text-[#15543C] text-[38px] font-bold tracking-tight">Caixa</h1>
        <p className="text-[#74747C] text-[16px] mt-2">Controle a abertura e o fechamento do caixa.</p>
      </header>

      <div className="flex-1 flex flex-col px-[34px] overflow-y-auto pb-[40px]">
        
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#74747C]">Carregando dados do caixa...</div>
        ) : (
          <>
            {/* ESTADO ATUAL */}
            {!sessaoAberta ? (
              // CAIXA FECHADO
              <div className="w-full bg-[#F8FBF8] border border-[#DFE3DF] rounded-[16px] p-[40px] flex flex-col items-center justify-center mb-[40px]">
                <div className="w-[72px] h-[72px] rounded-full bg-[#DDEBDD] flex items-center justify-center mb-5 text-[#15543C]">
                  <Lock className="w-[32px] h-[32px]" strokeWidth={2} />
                </div>
                <h2 className="text-[#15543C] font-bold text-[22px] mb-2">Caixa fechado</h2>
                <p className="text-[#74747C] text-[16px] mb-8 text-center">Abra o caixa para iniciar as operações do PDV.</p>
                <button 
                  onClick={() => { setModalType('abrir'); setModalOpen(true); }}
                  className="bg-[#48905A] hover:bg-[#3D7A4D] transition-colors h-[54px] px-[32px] rounded-[12px] text-white font-semibold text-[17px] shadow-[0_4px_12px_rgba(72,144,90,0.15)] flex items-center gap-2"
                >
                  <Unlock className="w-[20px] h-[20px]" />
                  Abrir caixa
                </button>
              </div>
            ) : (
              // CAIXA ABERTO
              <div className="w-full bg-white border border-[#DFE3DF] rounded-[16px] p-[30px] flex flex-col mb-[40px] shadow-sm">
                <div className="flex items-center justify-between border-b border-[#DFE3DF] pb-[20px] mb-[20px]">
                  <div className="flex items-center gap-4">
                    <h2 className="text-[#15543C] font-bold text-[24px]">Caixa aberto</h2>
                    <span className="bg-[#DDEBDD] text-[#15543C] font-bold text-[13px] px-3 py-1 rounded-full uppercase tracking-wider">Aberto</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setModalType('suprimento');
                        setMotivoMovimentacao('Fundo de troco');
                        setModalOpen(true);
                      }}
                      className="border border-[#DFE3DF] bg-white hover:bg-gray-50 transition-colors h-[48px] px-[24px] rounded-[10px] text-[#15543C] font-semibold text-[16px] shadow-sm flex items-center gap-2"
                    >
                      <ArrowDown className="w-[18px] h-[18px] text-[#48905A]" />
                      Suprimento
                    </button>
                    <button 
                      onClick={() => {
                        setModalType('sangria');
                        setMotivoMovimentacao('Retirada para cofre');
                        setModalOpen(true);
                      }}
                      className="border border-[#DFE3DF] bg-white hover:bg-gray-50 transition-colors h-[48px] px-[24px] rounded-[10px] text-[#14171F] font-semibold text-[16px] shadow-sm flex items-center gap-2"
                    >
                      <ArrowUp className="w-[18px] h-[18px] text-red-500" />
                      Sangria
                    </button>
                    <div className="w-[1px] h-[30px] bg-[#DFE3DF] mx-2"></div>
                    <button 
                      onClick={() => { 
                        setModalType('fechar'); 
                        setValorContadoRaw(((sessaoAberta.expectedAmountCents || sessaoAberta.openingAmountCents) / 100).toFixed(2).replace('.', ','));
                        setModalOpen(true); 
                      }}
                      className="border border-[#DFE3DF] bg-white hover:bg-gray-50 transition-colors h-[48px] px-[24px] rounded-[10px] text-[#14171F] font-semibold text-[16px] shadow-sm flex items-center gap-2"
                    >
                      <Lock className="w-[18px] h-[18px] text-[#74747C]" />
                      Fechar caixa
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-[24px] mb-[30px]">
                  <div>
                    <div className="text-[#74747C] text-[14px] font-medium mb-1">Aberto em</div>
                    <div className="text-[#14171F] font-semibold text-[16px]">{formatDate(sessaoAberta.openedAt)} às {formatTime(sessaoAberta.openedAt)}</div>
                  </div>
                  <div>
                    <div className="text-[#74747C] text-[14px] font-medium mb-1">Terminal</div>
                    <div className="text-[#14171F] font-semibold text-[16px]">{sessaoAberta.terminal}</div>
                  </div>
                  <div>
                    <div className="text-[#74747C] text-[14px] font-medium mb-1">Operador</div>
                    <div className="text-[#14171F] font-semibold text-[16px]">{sessaoAberta.openedBy}</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-[16px]">
                  <div className="bg-[#F8FBF8] border border-[#DFE3DF] rounded-[12px] p-4 flex flex-col justify-center">
                    <span className="text-[#74747C] text-[15px] font-medium mb-1">Saldo inicial</span>
                    <span className="text-[#14171F] font-bold text-[20px]">{formatCurrency(sessaoAberta.openingAmountCents)}</span>
                  </div>
                  <div className="bg-white border border-[#DFE3DF] rounded-[12px] p-4 flex flex-col justify-center">
                    <span className="text-[#74747C] text-[15px] font-medium mb-1 flex items-center gap-1"><ArrowDown className="w-4 h-4 text-[#48905A]" /> Entradas (Suprimentos)</span>
                    <span className="text-[#14171F] font-bold text-[20px]">{formatCurrency(sessaoAberta.entradas || 0)}</span>
                  </div>
                  <div className="bg-white border border-[#DFE3DF] rounded-[12px] p-4 flex flex-col justify-center">
                    <span className="text-[#74747C] text-[15px] font-medium mb-1 flex items-center gap-1"><ArrowUp className="w-4 h-4 text-red-500" /> Saídas (Sangrias)</span>
                    <span className="text-[#14171F] font-bold text-[20px]">{formatCurrency(sessaoAberta.saidas || 0)}</span>
                  </div>
                  <div className="bg-[#15543C] border border-[#15543C] rounded-[12px] p-4 flex flex-col justify-center">
                    <span className="text-[#9FCBA8] text-[15px] font-medium mb-1">Saldo esperado</span>
                    <span className="text-white font-bold text-[22px]">{formatCurrency(sessaoAberta.expectedAmountCents || sessaoAberta.openingAmountCents)}</span>
                  </div>
                </div>

                <div className="mt-[40px]">
                  <h3 className="text-[#15543C] font-bold text-[18px] mb-[16px]">Movimentações do caixa</h3>
                  <div className="border border-[#DFE3DF] rounded-[14px] bg-white overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#DFE3DF] bg-gray-50/50">
                          <th className="py-3 px-4 text-[#74747C] font-semibold text-[14px]">Horário</th>
                          <th className="py-3 px-4 text-[#74747C] font-semibold text-[14px]">Tipo</th>
                          <th className="py-3 px-4 text-[#74747C] font-semibold text-[14px]">Motivo</th>
                          <th className="py-3 px-4 text-[#74747C] font-semibold text-[14px]">Operador</th>
                          <th className="py-3 px-4 text-[#74747C] font-semibold text-[14px] text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!sessaoAberta.movimentacoes || sessaoAberta.movimentacoes.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-[#74747C]">Nenhuma movimentação registrada neste caixa.</td>
                          </tr>
                        ) : (
                          sessaoAberta.movimentacoes.map(m => (
                            <tr key={m.id} className="border-b border-[#DFE3DF] last:border-0 hover:bg-gray-50/50 transition-colors">
                              <td className="py-3 px-4 text-[#14171F] font-medium">{formatTime(m.createdAt)}</td>
                              <td className="py-3 px-4">
                                {m.type === 'SUPPLY' ? (
                                  <span className="text-[#48905A] font-semibold text-[14px]">Suprimento</span>
                                ) : (
                                  <span className="text-red-500 font-semibold text-[14px]">Sangria</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-[#14171F]">
                                <div>{m.reason}</div>
                                {m.note && <div className="text-[12px] text-[#74747C] mt-0.5 line-clamp-1">{m.note}</div>}
                              </td>
                              <td className="py-3 px-4 text-[#14171F]">{m.operator}</td>
                              <td className={`py-3 px-4 font-bold text-right ${m.type === 'SUPPLY' ? 'text-[#48905A]' : 'text-red-500'}`}>
                                {m.type === 'SUPPLY' ? '+' : '-'} {formatCurrency(m.amountCents)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* HISTÓRICO DE CAIXAS */}
            <div>
              <h3 className="text-[#15543C] font-bold text-[20px] mb-[20px]">Histórico de caixas</h3>
              <div className="border border-[#DFE3DF] rounded-[14px] bg-white overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#DFE3DF] bg-gray-50/50">
                      <th className="py-4 px-5 text-[#74747C] font-semibold text-[14px]">Data</th>
                      <th className="py-4 px-5 text-[#74747C] font-semibold text-[14px]">Abertura</th>
                      <th className="py-4 px-5 text-[#74747C] font-semibold text-[14px]">Fechamento</th>
                      <th className="py-4 px-5 text-[#74747C] font-semibold text-[14px]">Terminal</th>
                      <th className="py-4 px-5 text-[#74747C] font-semibold text-[14px] text-right">Saldo incial</th>
                      <th className="py-4 px-5 text-[#74747C] font-semibold text-[14px] text-right">Diferença</th>
                      <th className="py-4 px-5 text-[#74747C] font-semibold text-[14px]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-[#74747C]">Nenhum histórico encontrado.</td>
                      </tr>
                    ) : (
                      historico.map((h) => (
                        <tr key={h.id} className="border-b border-[#DFE3DF] last:border-0 hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-5 text-[#14171F] font-medium">{formatDate(h.openedAt)}</td>
                          <td className="py-4 px-5 text-[#14171F]">{formatTime(h.openedAt)}</td>
                          <td className="py-4 px-5 text-[#14171F]">{h.closedAt ? formatTime(h.closedAt) : '-'}</td>
                          <td className="py-4 px-5 text-[#14171F]">{h.terminal}</td>
                          <td className="py-4 px-5 text-[#14171F] font-medium text-right">{formatCurrency(h.openingAmountCents)}</td>
                          <td className={`py-4 px-5 font-bold text-right ${h.differenceAmountCents === undefined ? 'text-gray-400' : h.differenceAmountCents === 0 ? 'text-[#74747C]' : h.differenceAmountCents > 0 ? 'text-[#48905A]' : 'text-red-500'}`}>
                            {h.differenceAmountCents === undefined ? '-' : h.differenceAmountCents > 0 ? `+ ${formatCurrency(h.differenceAmountCents)}` : h.differenceAmountCents < 0 ? `- ${formatCurrency(Math.abs(h.differenceAmountCents))}` : formatCurrency(0)}
                          </td>
                          <td className="py-4 px-5">
                            {h.status === 'OPEN' ? (
                              <span className="bg-[#DDEBDD] text-[#15543C] font-bold text-[12px] px-2 py-1 rounded-md uppercase tracking-wider">Aberto</span>
                            ) : (
                              <span className="bg-gray-100 text-[#74747C] font-bold text-[12px] px-2 py-1 rounded-md uppercase tracking-wider">Fechado</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL - ABRIR/FECHAR CAIXA */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[20px] w-full max-w-[460px] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-[24px] py-[20px] border-b border-[#DFE3DF]">
              <h2 className="text-[#15543C] font-bold text-[20px]">
                {modalType === 'abrir' && 'Abrir caixa'}
                {modalType === 'fechar' && 'Fechar caixa'}
                {modalType === 'suprimento' && 'Registrar suprimento'}
                {modalType === 'sangria' && 'Registrar sangria'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-[#9A9A9A] hover:text-[#14171F] transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-[24px] flex flex-col gap-[20px]">
              {modalType === 'abrir' ? (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-[#14171F] font-semibold text-[15px]">Saldo inicial (R$)</label>
                    <input 
                      type="text"
                      value={saldoInicialRaw}
                      onChange={(e) => handleCurrencyChange(e, setSaldoInicialRaw)}
                      className="h-[54px] border border-[#DFE3DF] rounded-[12px] px-4 text-[18px] text-[#14171F] focus:outline-none focus:border-[#48905A] transition-colors font-medium"
                      placeholder="0,00"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[#14171F] font-semibold text-[15px]">Terminal</label>
                    <input type="text" value="Caixa 01" disabled className="h-[54px] border border-[#DFE3DF] bg-gray-50 rounded-[12px] px-4 text-[16px] text-[#74747C] outline-none" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[#14171F] font-semibold text-[15px]">Operador</label>
                    <input type="text" value="Operador padrão" disabled className="h-[54px] border border-[#DFE3DF] bg-gray-50 rounded-[12px] px-4 text-[16px] text-[#74747C] outline-none" />
                  </div>
                </>
              ) : modalType === 'fechar' ? (
                <>
                  <div className="bg-[#F8FBF8] border border-[#DFE3DF] rounded-[12px] p-4 flex flex-col gap-2 mb-2">
                    <div className="flex justify-between items-center text-[15px]">
                      <span className="text-[#74747C]">Saldo inicial</span>
                      <span className="text-[#14171F] font-semibold">{sessaoAberta && formatCurrency(sessaoAberta.openingAmountCents)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[15px]">
                      <span className="text-[#74747C]">Entradas (Suprimentos)</span>
                      <span className="text-[#14171F] font-semibold">{sessaoAberta && formatCurrency(sessaoAberta.entradas || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[15px]">
                      <span className="text-[#74747C]">Saídas (Sangrias)</span>
                      <span className="text-[#14171F] font-semibold">{sessaoAberta && formatCurrency(sessaoAberta.saidas || 0)}</span>
                    </div>
                    <div className="h-[1px] bg-[#DFE3DF] my-1" />
                    <div className="flex justify-between items-center text-[16px]">
                      <span className="text-[#15543C] font-bold">Saldo esperado</span>
                      <span className="text-[#15543C] font-bold">{sessaoAberta && formatCurrency(sessaoAberta.expectedAmountCents || sessaoAberta.openingAmountCents)}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[#14171F] font-semibold text-[15px]">Valor contado no caixa (R$)</label>
                    <input 
                      type="text"
                      value={valorContadoRaw}
                      onChange={(e) => handleCurrencyChange(e, setValorContadoRaw)}
                      className="h-[54px] border border-[#DFE3DF] rounded-[12px] px-4 text-[18px] text-[#14171F] focus:outline-none focus:border-[#48905A] transition-colors font-medium"
                      placeholder="0,00"
                    />
                  </div>
                </>
              ) : (
                <>
                  {modalType === 'sangria' && sessaoAberta && (
                    <div className="bg-[#F8FBF8] border border-[#DFE3DF] rounded-[12px] p-4 mb-2 flex justify-between items-center">
                      <span className="text-[#74747C] font-medium text-[15px]">Saldo disponível</span>
                      <span className="text-[#15543C] font-bold text-[18px]">{formatCurrency(sessaoAberta.expectedAmountCents || sessaoAberta.openingAmountCents)}</span>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[#14171F] font-semibold text-[15px]">Valor (R$) *</label>
                    <input 
                      type="text"
                      value={valorMovimentacaoRaw}
                      onChange={(e) => handleCurrencyChange(e, setValorMovimentacaoRaw)}
                      className="h-[54px] border border-[#DFE3DF] rounded-[12px] px-4 text-[18px] text-[#14171F] focus:outline-none focus:border-[#48905A] transition-colors font-medium"
                      placeholder="0,00"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[#14171F] font-semibold text-[15px]">Motivo *</label>
                    <select
                      value={motivoMovimentacao}
                      onChange={(e) => setMotivoMovimentacao(e.target.value)}
                      className="h-[54px] border border-[#DFE3DF] rounded-[12px] px-4 text-[16px] text-[#14171F] focus:outline-none focus:border-[#48905A] transition-colors bg-white appearance-none"
                    >
                      {modalType === 'suprimento' ? (
                        <>
                          <option value="Fundo de troco">Fundo de troco</option>
                          <option value="Reforço de caixa">Reforço de caixa</option>
                          <option value="Entrada manual">Entrada manual</option>
                          <option value="Outro">Outro</option>
                        </>
                      ) : (
                        <>
                          <option value="Retirada para cofre">Retirada para cofre</option>
                          <option value="Retirada administrativa">Retirada administrativa</option>
                          <option value="Troco excedente">Troco excedente</option>
                          <option value="Outra retirada">Outra retirada</option>
                          <option value="Outro">Outro</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[#14171F] font-semibold text-[15px]">Observação</label>
                    <textarea
                      value={obsMovimentacao}
                      onChange={(e) => setObsMovimentacao(e.target.value)}
                      maxLength={500}
                      className="border border-[#DFE3DF] rounded-[12px] p-4 text-[16px] text-[#14171F] focus:outline-none focus:border-[#48905A] transition-colors resize-none h-[100px]"
                      placeholder="Opcional..."
                    />
                  </div>
                </>
              )}
            </div>

            <div className="p-[24px] border-t border-[#DFE3DF] flex gap-[12px]">
              <button 
                onClick={() => setModalOpen(false)}
                className="flex-1 h-[54px] border border-[#DFE3DF] rounded-[12px] text-[#14171F] font-semibold text-[16px] hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={
                  modalType === 'abrir' ? handleAbrirCaixa : 
                  modalType === 'fechar' ? handleFecharCaixa : 
                  handleMovimentacao
                }
                className="flex-1 h-[54px] bg-[#48905A] hover:bg-[#3D7A4D] transition-colors rounded-[12px] text-white font-semibold text-[16px] shadow-sm"
              >
                {modalType === 'abrir' && 'Abrir caixa'}
                {modalType === 'fechar' && 'Fechar caixa'}
                {modalType === 'suprimento' && 'Registrar suprimento'}
                {modalType === 'sangria' && 'Registrar sangria'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
