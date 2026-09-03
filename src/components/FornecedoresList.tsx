import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, Edit, ShieldAlert, Truck, ChevronRight, PackageSearch } from 'lucide-react';
import type { Fornecedor } from '../types';
import FornecedorForm from './FornecedorForm';
import FornecedorDetail from './FornecedorDetail';
import { formatCNPJ, formatCPF } from '../utils';

export default function FornecedoresList() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [loading, setLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState<'LIST' | 'FORM' | 'DETAIL'>('LIST');
  const [selectedFornecedor, setSelectedFornecedor] = useState<Fornecedor | null>(null);

  const carregar = () => {
    fetch('/api/fornecedores')
      .then(r => r.json())
      .then(data => {
        setFornecedores(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    carregar();
  }, [viewMode]);

  const filtered = fornecedores.filter(f => {
    if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
    
    if (search) {
      const termo = search.toLowerCase();
      const docs = f.documento.includes(termo);
      const nome = (f.nomeFantasia || f.razaoSocial || f.nome || '').toLowerCase().includes(termo);
      const tel = (f.telefone || f.celular || '').includes(termo);
      const email = (f.email || '').toLowerCase().includes(termo);
      return docs || nome || tel || email;
    }
    return true;
  }).sort((a, b) => {
    const nomeA = (a.nomeFantasia || a.razaoSocial || a.nome || '').toLowerCase();
    const nomeB = (b.nomeFantasia || b.razaoSocial || b.nome || '').toLowerCase();
    return nomeA.localeCompare(nomeB);
  });

  const handleCreate = () => {
    setSelectedFornecedor(null);
    setViewMode('FORM');
  };

  const handleEdit = (f: Fornecedor) => {
    setSelectedFornecedor(f);
    setViewMode('FORM');
  };

  const handleDetail = (f: Fornecedor) => {
    setSelectedFornecedor(f);
    setViewMode('DETAIL');
  };

  if (viewMode === 'FORM') {
    return (
      <FornecedorForm 
        fornecedor={selectedFornecedor} 
        onClose={() => setViewMode('LIST')} 
      />
    );
  }

  if (viewMode === 'DETAIL' && selectedFornecedor) {
    return (
      <FornecedorDetail 
        fornecedor={selectedFornecedor} 
        onClose={() => setViewMode('LIST')}
        onEdit={() => handleEdit(selectedFornecedor)}
      />
    );
  }

  return (
    <div className="flex-1 p-8 bg-white overflow-hidden flex flex-col h-full rounded-tl-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#14171F] tracking-tight">Fornecedores</h1>
          <p className="text-[#74747C] mt-1">Cadastre e gerencie os fornecedores da loja.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="bg-[#48905A] hover:bg-[#3D7A4D] text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Novo fornecedor
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 border border-[#DFE3DF] rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#48905A] focus:border-transparent transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="border border-[#DFE3DF] rounded-xl px-4 py-3 bg-white text-[#14171F] outline-none focus:ring-2 focus:ring-[#48905A]"
        >
          <option value="ALL">Todos</option>
          <option value="ACTIVE">Ativos</option>
          <option value="INACTIVE">Inativos</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto border border-[#DFE3DF] rounded-2xl bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-gray-500">
            <PackageSearch className="w-12 h-12 mb-4 text-gray-300" />
            <p className="text-lg">Nenhum fornecedor encontrado.</p>
            {search === '' && (
              <button onClick={handleCreate} className="mt-4 text-[#48905A] font-semibold hover:underline">
                Cadastrar fornecedor
              </button>
            )}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-[#DFE3DF]">
            <thead className="bg-[#F4F5F4] sticky top-0">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#74747C] uppercase tracking-wider">Fornecedor</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#74747C] uppercase tracking-wider">Documento</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#74747C] uppercase tracking-wider">Contato</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#74747C] uppercase tracking-wider">Cidade / UF</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#74747C] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-[#74747C] uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#DFE3DF]">
              {filtered.map((f) => {
                const docFmt = f.tipoPessoa === 'PJ' ? formatCNPJ(f.documento) : formatCPF(f.documento);
                const titulo = f.nomeFantasia || f.nome;
                const sub = f.razaoSocial || (f.tipoPessoa === 'PJ' ? '-' : '');
                
                return (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-[#14171F]">{titulo}</div>
                      {sub && <div className="text-xs text-[#74747C]">{sub}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#74747C]">
                      {docFmt}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#74747C]">
                      <div>{f.telefone || f.celular || '-'}</div>
                      <div className="text-xs">{f.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#74747C]">
                      {f.cidade && f.estado ? `${f.cidade} / ${f.estado}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${f.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {f.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleDetail(f)} 
                        className="text-[#48905A] hover:text-[#3D7A4D] mx-2"
                        title="Ver detalhes"
                      >
                        <Eye className="w-5 h-5 inline" />
                      </button>
                      <button 
                        onClick={() => handleEdit(f)} 
                        className="text-blue-600 hover:text-blue-800 mx-2"
                        title="Editar"
                      >
                        <Edit className="w-5 h-5 inline" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
