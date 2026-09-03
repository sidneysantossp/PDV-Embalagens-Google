import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import type { Fornecedor, TipoPessoa } from '../types';
import { cleanDocument, formatCNPJ, formatCPF } from '../utils';

interface FornecedorFormProps {
  fornecedor: Fornecedor | null;
  onClose: () => void;
}

const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function FornecedorForm({ fornecedor, onClose }: FornecedorFormProps) {
  const isEdit = !!fornecedor;
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>(fornecedor?.tipoPessoa || 'PJ');
  
  const initialDoc = fornecedor ? (fornecedor.tipoPessoa === 'PJ' ? formatCNPJ(fornecedor.documento) : formatCPF(fornecedor.documento)) : '';
  const [documento, setDocumento] = useState(initialDoc);
  
  const [formData, setFormData] = useState({
    razaoSocial: fornecedor?.razaoSocial || '',
    nomeFantasia: fornecedor?.nomeFantasia || '',
    inscricaoEstadual: fornecedor?.inscricaoEstadual || '',
    inscricaoMunicipal: fornecedor?.inscricaoMunicipal || '',
    nome: fornecedor?.nome || '',
    telefone: fornecedor?.telefone || '',
    celular: fornecedor?.celular || '',
    email: fornecedor?.email || '',
    contatoPrincipal: fornecedor?.contatoPrincipal || '',
    cep: fornecedor?.cep || '',
    logradouro: fornecedor?.logradouro || '',
    numero: fornecedor?.numero || '',
    complemento: fornecedor?.complemento || '',
    bairro: fornecedor?.bairro || '',
    cidade: fornecedor?.cidade || '',
    estado: fornecedor?.estado || '',
    prazoPadraoPagamento: fornecedor?.prazoPadraoPagamento?.toString() || '',
    pedidoMinimoCentavos: fornecedor?.pedidoMinimoCentavos ? (fornecedor.pedidoMinimoCentavos / 100).toFixed(2).replace('.', ',') : '',
    observacoes: fornecedor?.observacoes || ''
  });
  
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = cleanDocument(e.target.value);
    if (tipoPessoa === 'PJ') {
      if (val.length > 14) val = val.substring(0, 14);
      setDocumento(formatCNPJ(val));
    } else {
      if (val.length > 11) val = val.substring(0, 11);
      setDocumento(formatCPF(val));
    }
  };

  const handleTipoChange = (novoTipo: TipoPessoa) => {
    if (novoTipo !== tipoPessoa) {
      setTipoPessoa(novoTipo);
      setDocumento('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!documento) {
      setError('O documento é obrigatório.');
      return;
    }

    setSaving(true);

    const payload = {
      tipoPessoa,
      documento: cleanDocument(documento),
      razaoSocial: formData.razaoSocial,
      nomeFantasia: formData.nomeFantasia,
      inscricaoEstadual: formData.inscricaoEstadual,
      inscricaoMunicipal: formData.inscricaoMunicipal,
      nome: formData.nome,
      telefone: formData.telefone,
      celular: formData.celular,
      email: formData.email,
      contatoPrincipal: formData.contatoPrincipal,
      cep: formData.cep,
      logradouro: formData.logradouro,
      numero: formData.numero,
      complemento: formData.complemento,
      bairro: formData.bairro,
      cidade: formData.cidade,
      estado: formData.estado,
      prazoPadraoPagamento: formData.prazoPadraoPagamento ? parseInt(formData.prazoPadraoPagamento) : undefined,
      pedidoMinimoCentavos: formData.pedidoMinimoCentavos ? Math.round(parseFloat(formData.pedidoMinimoCentavos.replace(',', '.')) * 100) : undefined,
      observacoes: formData.observacoes
    };

    try {
      const url = isEdit ? `/api/fornecedores/${fornecedor.id}` : '/api/fornecedores';
      const method = isEdit ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar.');
      }
      
      onClose(); // success, close form
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-hidden flex flex-col h-full rounded-tl-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#14171F] tracking-tight">{isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h1>
          <p className="text-[#74747C] mt-1">Preencha os dados do fornecedor</p>
        </div>
        <button onClick={onClose} className="p-2 bg-white hover:bg-gray-100 rounded-full text-gray-500 shadow-sm transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white border border-[#DFE3DF] rounded-2xl p-6 shadow-sm">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
          {/* Identificação */}
          <section>
            <h2 className="text-lg font-bold text-[#15543C] mb-4 border-b pb-2">Identificação</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isEdit && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-[#14171F] mb-1">Tipo de Pessoa</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={tipoPessoa === 'PJ'} onChange={() => handleTipoChange('PJ')} className="text-[#48905A] focus:ring-[#48905A]" />
                      <span>Pessoa Jurídica</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={tipoPessoa === 'PF'} onChange={() => handleTipoChange('PF')} className="text-[#48905A] focus:ring-[#48905A]" />
                      <span>Pessoa Física</span>
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-[#14171F] mb-1">{tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'} *</label>
                <input required type="text" value={documento} onChange={handleDocChange} placeholder={tipoPessoa === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
              </div>

              {tipoPessoa === 'PJ' ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-[#14171F] mb-1">Razão Social</label>
                    <input name="razaoSocial" value={formData.razaoSocial} onChange={handleChange} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#14171F] mb-1">Nome Fantasia</label>
                    <input name="nomeFantasia" value={formData.nomeFantasia} onChange={handleChange} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#14171F] mb-1">Inscrição Estadual</label>
                    <input name="inscricaoEstadual" value={formData.inscricaoEstadual} onChange={handleChange} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#14171F] mb-1">Inscrição Municipal</label>
                    <input name="inscricaoMunicipal" value={formData.inscricaoMunicipal} onChange={handleChange} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
                  </div>
                </>
              ) : (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-[#14171F] mb-1">Nome Completo</label>
                  <input name="nome" value={formData.nome} onChange={handleChange} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
                </div>
              )}
            </div>
          </section>

          {/* Contato */}
          <section>
            <h2 className="text-lg font-bold text-[#15543C] mb-4 border-b pb-2">Contato</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#14171F] mb-1">Telefone</label>
                <input name="telefone" value={formData.telefone} onChange={handleChange} placeholder="(00) 0000-0000" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#14171F] mb-1">Celular</label>
                <input name="celular" value={formData.celular} onChange={handleChange} placeholder="(00) 90000-0000" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#14171F] mb-1">E-mail</label>
                <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="contato@empresa.com" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#14171F] mb-1">Pessoa de Contato</label>
                <input name="contatoPrincipal" value={formData.contatoPrincipal} onChange={handleChange} placeholder="Nome do representante" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
              </div>
            </div>
          </section>

          {/* Endereço */}
          <section>
            <h2 className="text-lg font-bold text-[#15543C] mb-4 border-b pb-2">Endereço</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#14171F] mb-1">CEP</label>
                <input name="cep" value={formData.cep} onChange={handleChange} placeholder="00000-000" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[#14171F] mb-1">Logradouro</label>
                <input name="logradouro" value={formData.logradouro} onChange={handleChange} placeholder="Rua, Avenida, etc." className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#14171F] mb-1">Número</label>
                <input name="numero" value={formData.numero} onChange={handleChange} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#14171F] mb-1">Complemento</label>
                <input name="complemento" value={formData.complemento} onChange={handleChange} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#14171F] mb-1">Bairro</label>
                <input name="bairro" value={formData.bairro} onChange={handleChange} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[#14171F] mb-1">Cidade</label>
                <input name="cidade" value={formData.cidade} onChange={handleChange} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#14171F] mb-1">Estado</label>
                <select name="estado" value={formData.estado} onChange={handleChange} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A] bg-white">
                  <option value="">Selecione...</option>
                  {ESTADOS.map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Comercial */}
          <section>
            <h2 className="text-lg font-bold text-[#15543C] mb-4 border-b pb-2">Dados Comerciais</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#14171F] mb-1">Prazo Padrão (Dias)</label>
                <input type="number" min="0" name="prazoPadraoPagamento" value={formData.prazoPadraoPagamento} onChange={handleChange} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#14171F] mb-1">Pedido Mínimo (R$)</label>
                <input name="pedidoMinimoCentavos" value={formData.pedidoMinimoCentavos} onChange={(e) => setFormData({...formData, pedidoMinimoCentavos: e.target.value.replace(/[^0-9,]/g, '')})} placeholder="0,00" className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A]" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[#14171F] mb-1">Observações</label>
                <textarea name="observacoes" value={formData.observacoes} onChange={handleChange} rows={4} maxLength={1000} className="w-full border border-[#DFE3DF] rounded-xl px-4 py-3 outline-none focus:border-[#48905A] resize-none"></textarea>
              </div>
            </div>
          </section>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="px-6 py-3 font-semibold text-[#74747C] hover:bg-gray-100 rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-6 py-3 font-semibold text-white bg-[#48905A] hover:bg-[#3D7A4D] rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
              <Save className="w-5 h-5" />
              {saving ? 'Salvando...' : 'Salvar Fornecedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
