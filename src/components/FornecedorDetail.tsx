import React, { useState, useEffect } from 'react';
import { X, Edit, Power, PowerOff, Package, Link2, Trash2 } from 'lucide-react';
import type { Fornecedor, FornecedorProduto, Produto } from '../types';
import { formatCNPJ, formatCPF } from '../utils';

interface FornecedorDetailProps {
  fornecedor: Fornecedor;
  onClose: () => void;
  onEdit: () => void;
}

export default function FornecedorDetail({ fornecedor, onClose, onEdit }: FornecedorDetailProps) {
  const [vinculados, setVinculados] = useState<(FornecedorProduto & { produto: Produto })[]>([]);
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<Produto[]>([]);
  const [status, setStatus] = useState(fornecedor.status);
  const [loading, setLoading] = useState(true);
  
  // Vinculo form
  const [showVincular, setShowVincular] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [supplierProductCode, setSupplierProductCode] = useState('');

  const loadData = () => {
    Promise.all([
      fetch(`/api/fornecedores/${fornecedor.id}/produtos`).then(r => r.json()),
      fetch('/api/produtos').then(r => r.json())
    ]).then(([vinculosData, produtosData]) => {
      setVinculados(vinculosData);
      setProdutosDisponiveis(produtosData);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [fornecedor.id]);

  const toggleStatus = async () => {
    if (status === 'ACTIVE') {
      if (!confirm('Deseja inativar este fornecedor? Ele não poderá ser usado em novas compras.')) return;
    }
    
    const newStatus = status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`/api/fornecedores/${fornecedor.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) setStatus(newStatus);
    } catch (e) {
      console.error(e);
    }
  };

  const handleVincular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;

    try {
      const res = await fetch(`/api/fornecedores/${fornecedor.id}/produtos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProductId, supplierProductCode: supplierProductCode || undefined })
      });
      if (res.ok) {
        setShowVincular(false);
        setSelectedProductId('');
        setSupplierProductCode('');
        loadData();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDesvincular = async (productId: string) => {
    if (!confirm('Deseja remover o vínculo com este produto?')) return;
    try {
      const res = await fetch(`/api/fornecedores/${fornecedor.id}/produtos/${productId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const docFmt = fornecedor.tipoPessoa === 'PJ' ? formatCNPJ(fornecedor.documento) : formatCPF(fornecedor.documento);
  
  const naoVinculados = produtosDisponiveis.filter(p => !vinculados.some(v => v.productId === p.id));

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-hidden flex flex-col h-full rounded-tl-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-[#14171F] tracking-tight">{fornecedor.nomeFantasia || fornecedor.nome}</h1>
            <span className={`px-3 py-1 text-sm font-bold rounded-full ${status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {status === 'ACTIVE' ? 'ATIVO' : 'INATIVO'}
            </span>
          </div>
          {fornecedor.razaoSocial && <p className="text-[#74747C] mt-1">{fornecedor.razaoSocial}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-blue-600 shadow-sm transition-colors" title="Editar">
            <Edit className="w-5 h-5" />
          </button>
          <button onClick={toggleStatus} className={`p-2 bg-white border border-gray-200 rounded-xl shadow-sm transition-colors ${status === 'ACTIVE' ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`} title={status === 'ACTIVE' ? 'Inativar' : 'Reativar'}>
            {status === 'ACTIVE' ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
          </button>
          <button onClick={onClose} className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-500 shadow-sm transition-colors ml-2" title="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detalhes principais */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 border border-[#DFE3DF] rounded-2xl shadow-sm">
            <h2 className="text-lg font-bold text-[#15543C] mb-4 border-b pb-2">Identificação</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-bold text-[#74747C] uppercase">Documento ({fornecedor.tipoPessoa})</span>
                <span className="font-medium text-[#14171F]">{docFmt}</span>
              </div>
              {fornecedor.tipoPessoa === 'PJ' && (
                <>
                  <div>
                    <span className="block text-xs font-bold text-[#74747C] uppercase">Inscrição Estadual</span>
                    <span className="font-medium text-[#14171F]">{fornecedor.inscricaoEstadual || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-[#74747C] uppercase">Inscrição Municipal</span>
                    <span className="font-medium text-[#14171F]">{fornecedor.inscricaoMunicipal || '-'}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white p-6 border border-[#DFE3DF] rounded-2xl shadow-sm">
            <h2 className="text-lg font-bold text-[#15543C] mb-4 border-b pb-2">Contato</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-bold text-[#74747C] uppercase">Telefone</span>
                <span className="font-medium text-[#14171F]">{fornecedor.telefone || '-'}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-[#74747C] uppercase">Celular</span>
                <span className="font-medium text-[#14171F]">{fornecedor.celular || '-'}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-[#74747C] uppercase">E-mail</span>
                <span className="font-medium text-[#14171F]">{fornecedor.email || '-'}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-[#74747C] uppercase">Pessoa de Contato</span>
                <span className="font-medium text-[#14171F]">{fornecedor.contatoPrincipal || '-'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 border border-[#DFE3DF] rounded-2xl shadow-sm">
            <h2 className="text-lg font-bold text-[#15543C] mb-4 border-b pb-2">Endereço</h2>
            <div className="text-sm font-medium text-[#14171F]">
              {fornecedor.logradouro ? (
                <>
                  {fornecedor.logradouro}, {fornecedor.numero} {fornecedor.complemento && `(${fornecedor.complemento})`}<br />
                  {fornecedor.bairro} - {fornecedor.cidade}/{fornecedor.estado}<br />
                  CEP: {fornecedor.cep}
                </>
              ) : '-'}
            </div>
          </div>

          <div className="bg-white p-6 border border-[#DFE3DF] rounded-2xl shadow-sm">
            <h2 className="text-lg font-bold text-[#15543C] mb-4 border-b pb-2">Dados Comerciais</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <span className="block text-xs font-bold text-[#74747C] uppercase">Prazo Padrão</span>
                <span className="font-medium text-[#14171F]">{fornecedor.prazoPadraoPagamento ? `${fornecedor.prazoPadraoPagamento} dias` : '-'}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-[#74747C] uppercase">Pedido Mínimo</span>
                <span className="font-medium text-[#14171F]">
                  {fornecedor.pedidoMinimoCentavos ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fornecedor.pedidoMinimoCentavos / 100) : '-'}
                </span>
              </div>
            </div>
            {fornecedor.observacoes && (
              <div>
                <span className="block text-xs font-bold text-[#74747C] uppercase mb-1">Observações</span>
                <p className="text-sm text-[#14171F] bg-gray-50 p-3 rounded-xl border border-gray-100 whitespace-pre-wrap">{fornecedor.observacoes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Produtos vinculados */}
        <div className="space-y-6">
          <div className="bg-white p-6 border border-[#DFE3DF] rounded-2xl shadow-sm flex flex-col h-full">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <h2 className="text-lg font-bold text-[#15543C] flex items-center gap-2">
                <Package className="w-5 h-5" />
                Produtos ({vinculados.length})
              </h2>
              <button 
                onClick={() => setShowVincular(!showVincular)}
                className="text-sm font-bold text-[#48905A] hover:text-[#3D7A4D] flex items-center gap-1"
              >
                <Link2 className="w-4 h-4" /> Vincular
              </button>
            </div>

            {showVincular && (
              <form onSubmit={handleVincular} className="mb-6 p-4 bg-[#F4F5F4] rounded-xl border border-[#DFE3DF]">
                <div className="mb-3">
                  <label className="block text-xs font-bold text-[#14171F] mb-1">Produto</label>
                  <select 
                    required
                    value={selectedProductId}
                    onChange={e => setSelectedProductId(e.target.value)}
                    className="w-full border border-[#DFE3DF] rounded-lg px-3 py-2 outline-none focus:border-[#48905A] bg-white text-sm"
                  >
                    <option value="">Selecione um produto...</option>
                    {naoVinculados.map(p => (
                      <option key={p.id} value={p.id}>{p.codigo} - {p.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-bold text-[#14171F] mb-1">Código no Fornecedor (Opcional)</label>
                  <input 
                    type="text"
                    value={supplierProductCode}
                    onChange={e => setSupplierProductCode(e.target.value)}
                    className="w-full border border-[#DFE3DF] rounded-lg px-3 py-2 outline-none focus:border-[#48905A] text-sm"
                    placeholder="Ex: REF-1234"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowVincular(false)} className="flex-1 py-2 text-sm font-semibold text-[#74747C] hover:bg-gray-200 rounded-lg">Cancelar</button>
                  <button type="submit" className="flex-1 py-2 text-sm font-semibold text-white bg-[#48905A] hover:bg-[#3D7A4D] rounded-lg">Salvar</button>
                </div>
              </form>
            )}

            <div className="flex-1 overflow-y-auto pr-2">
              {loading ? (
                <div className="text-center text-sm text-gray-500 py-4">Carregando...</div>
              ) : vinculados.length === 0 ? (
                <div className="text-center text-sm text-gray-500 py-8 border-2 border-dashed border-gray-200 rounded-xl">
                  Nenhum produto vinculado.<br/>Clique em "Vincular" para adicionar.
                </div>
              ) : (
                <ul className="space-y-3">
                  {vinculados.map(v => (
                    <li key={v.productId} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-semibold text-sm text-[#14171F] truncate">{v.produto.nome}</div>
                        <div className="text-xs text-[#74747C] flex gap-2">
                          <span>SKU: {v.produto.codigo}</span>
                          {v.supplierProductCode && <span>• Ref: {v.supplierProductCode}</span>}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDesvincular(v.productId)}
                        className="text-red-400 hover:text-red-600 p-1"
                        title="Desvincular"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
