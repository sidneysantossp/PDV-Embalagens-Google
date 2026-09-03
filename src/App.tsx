import VendasList from "./components/VendasList";

import PagamentoModal from "./components/PagamentoModal";

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ScanLine, 
  ShoppingBasket, 
  Plus, 
  HelpCircle, 
  LogOut, 
  ShoppingCart,
  MonitorSmartphone,
  Box,
  ClipboardList,
  Truck,
  Settings,
  Users,
  BarChart3,
  CreditCard,
  Trash2,
  Minus,
  Wallet
} from "lucide-react";
import type { Produto, Venda, VendaItem } from './types';
import Caixa from './components/Caixa';
import Configuracoes from './components/Configuracoes';
import FornecedoresList from './components/FornecedoresList';
import ComprasList from './components/ComprasList';
import ContasAPagar from './components/ContasAPagar';
import ContasAReceber from './components/ContasAReceber';
import Estoque from './components/Estoque';

export default function App() {
  const [activeTab, setActiveTab] = useState<'pdv' | 'caixa' | 'vendas' | 'config' | 'fornecedores' | 'compras' | 'contas' | 'receber' | 'estoque'>('pdv');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<{ produto: Produto, quantidade: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [descontoTipo, setDescontoTipo] = useState<'FIXO' | 'PERCENTUAL'>('FIXO');
  const [descontoValorRaw, setDescontoValorRaw] = useState('');
  
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [caixaAtual, setCaixaAtual] = useState<any>(null);

  useEffect(() => {
    fetch('/api/produtos')
      .then(res => res.json())
      .then(data => {
        setProdutos(data);
        setLoading(false);
      })
      .catch(err => console.error('Erro ao carregar produtos', err));
      
    fetch('/api/caixa/atual')
      .then(res => res.json())
      .then(data => setCaixaAtual(data))
      .catch(err => console.error(err));
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const adicionarAoCarrinho = (produto: Produto) => {
    setCarrinho(prev => {
      const exist = prev.find(item => item.produto.id === produto.id);
      if (exist) {
        return prev.map(item => item.produto.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item);
      }
      return [...prev, { produto, quantidade: 1 }];
    });
  };

  const removerDoCarrinho = (produtoId: string) => {
    setCarrinho(prev => {
      const exist = prev.find(item => item.produto.id === produtoId);
      if (exist && exist.quantidade > 1) {
        return prev.map(item => item.produto.id === produtoId ? { ...item, quantidade: item.quantidade - 1 } : item);
      }
      return prev.filter(item => item.produto.id !== produtoId);
    });
  };

  const subtotal = carrinho.reduce((acc, item) => acc + (item.produto.valor * item.quantidade), 0);
  
  let descontoCalculado = 0;
  const valNum = parseFloat(descontoValorRaw.replace(',', '.')) || 0;
  if (descontoTipo === 'FIXO') {
    descontoCalculado = valNum;
  } else {
    descontoCalculado = (subtotal * valNum) / 100;
  }
  
  const desconto = Math.min(descontoCalculado, subtotal);
  const total = subtotal - desconto;

  const finalizarVenda = async (pagamentos: any[], extra?: { clienteId?: string; dueDate?: string }) => {
    if (carrinho.length === 0) return;
    if (!caixaAtual) {
      alert('Nenhum caixa aberto!');
      return;
    }
    
    const venda: any = {
      subtotal,
      desconto,
      total,
      sessaoCaixaId: caixaAtual.id,
      itens: carrinho.map(item => ({
        produtoId: item.produto.id,
        quantidade: item.quantidade,
        valorUnitario: item.produto.valor,
        total: item.produto.valor * item.quantidade
      })),
      pagamentos,
      clienteId: extra?.clienteId,
      dueDate: extra?.dueDate
    };

    try {
      const res = await fetch('/api/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(venda)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro desconhecido');
      }
      setCarrinho([]);
      setDescontoValorRaw('');
      setCheckoutModalOpen(false);
      alert('Venda finalizada com sucesso!');
    } catch (err: any) {
      alert(err.message);
      console.error('Erro ao finalizar venda', err);
    }
  };
  return (
    <div className="flex min-h-screen md:h-screen flex-col md:flex-row bg-[#F1F6F0] font-sans text-[#14171F] overflow-x-hidden selection:bg-[#48905A] selection:text-white">
      
      {/* Sidebar */}
      <aside className="w-full md:w-[278px] flex-shrink-0 flex flex-col md:h-full bg-[#F1F6F0]">
        
        {/* Logo */}
        <div className="flex items-center px-5 pt-4 pb-3 md:px-[21px] md:pt-[22px] md:pb-[22px] gap-3">
          <div className="w-[42px] h-[48px] shrink-0 text-[#15543C]">
            <svg viewBox="0 0 42 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <path d="M4 11H38M8 11V39C8 41.2091 9.79086 43 12 43H30C32.2091 43 34 41.2091 34 39V11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 11V7C12 5.89543 12.8954 5 14 5H28C29.1046 5 30 5.89543 30 7V11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18 20V32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M24 20V32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="text-[#15543C] font-bold text-[21px] md:text-[27px] leading-[1.1] tracking-tight">
            Embalagens<br/>Guaraú
          </div>
        </div>

        {/* Menu */}
        <nav className="flex md:flex-1 min-h-0 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden flex-row md:flex-col gap-1 mt-1 pb-3 md:pb-2 px-2 md:px-0 [&>div]:shrink-0 [&>div]:mx-1 md:[&>div]:mx-[21px]">
          <div 
            onClick={() => setActiveTab('pdv')}
            className={`mx-[21px] flex items-center gap-3 rounded-[10px] h-[43px] px-[14px] cursor-pointer transition-colors ${
              activeTab === 'pdv' ? 'bg-[#DDEBDD] text-[#15543C]' : 'text-[#14171F] hover:bg-[#E5EEE5]'
            }`}
          >
            <MonitorSmartphone className="w-[19px] h-[19px]" strokeWidth={2} />
            <span className={`font-semibold text-[15px] ${activeTab === 'pdv' ? 'font-bold' : ''}`}>PDV</span>
          </div>
          <div className="mx-[21px] flex items-center gap-3 text-[#14171F] h-[43px] px-[14px] hover:bg-[#E5EEE5] rounded-[10px] cursor-pointer transition-colors">
            <Box className="w-[19px] h-[19px]" strokeWidth={2} />
            <span className="font-semibold text-[15px]">Produtos</span>
          </div>
          <div 
            onClick={() => setActiveTab('estoque')}
            className={`mx-[21px] flex items-center gap-3 rounded-[10px] h-[43px] px-[14px] cursor-pointer transition-colors ${
              activeTab === 'estoque' ? 'bg-[#DDEBDD] text-[#15543C]' : 'text-[#14171F] hover:bg-[#E5EEE5]'
            }`}
          >
            <ClipboardList className="w-[19px] h-[19px]" strokeWidth={2} />
            <span className={`font-semibold text-[15px] ${activeTab === 'estoque' ? 'font-bold' : ''}`}>Estoque</span>
          </div>
          <div className="mx-[21px] flex items-center gap-3 text-[#14171F] h-[43px] px-[14px] hover:bg-[#E5EEE5] rounded-[10px] cursor-pointer transition-colors">
            <Users className="w-[19px] h-[19px]" strokeWidth={2} />
            <span className="font-semibold text-[15px]">Clientes</span>
          </div>
          <div className="mx-[21px] flex items-center gap-3 text-[#14171F] h-[43px] px-[14px] hover:bg-[#E5EEE5] rounded-[10px] cursor-pointer transition-colors">
            <BarChart3 className="w-[19px] h-[19px]" strokeWidth={2} />
            <span className="font-semibold text-[15px]">Relatórios</span>
          </div>
          <div 
            onClick={() => setActiveTab('caixa')}
            className={`mx-[21px] flex items-center gap-3 rounded-[10px] h-[43px] px-[14px] cursor-pointer transition-colors ${
              activeTab === 'caixa' ? 'bg-[#DDEBDD] text-[#15543C]' : 'text-[#14171F] hover:bg-[#E5EEE5]'
            }`}
          >
            <Wallet className="w-[22px] h-[22px]" strokeWidth={2} />
            <span className={`font-semibold text-[15px] ${activeTab === 'caixa' ? 'font-bold' : ''}`}>Caixa</span>
          </div>
          <div 
            onClick={() => setActiveTab('vendas')}
            className={`mx-[21px] flex items-center gap-3 rounded-[10px] h-[43px] px-[14px] cursor-pointer transition-colors ${
              activeTab === 'vendas' ? 'bg-[#DDEBDD] text-[#15543C]' : 'text-[#14171F] hover:bg-[#E5EEE5]'
            }`}
          >
            <ClipboardList className="w-[22px] h-[22px]" strokeWidth={2} />
            <span className={`font-semibold text-[15px] ${activeTab === 'vendas' ? 'font-bold' : ''}`}>Vendas</span>
          </div>

          <div 
            onClick={() => setActiveTab('fornecedores')}
            className={`mx-[21px] flex items-center gap-3 rounded-[10px] h-[43px] px-[14px] cursor-pointer transition-colors ${
              activeTab === 'fornecedores' ? 'bg-[#DDEBDD] text-[#15543C]' : 'text-[#14171F] hover:bg-[#E5EEE5]'
            }`}
          >
            <Truck className="w-[22px] h-[22px]" strokeWidth={2} />
            <span className={`font-semibold text-[15px] ${activeTab === 'fornecedores' ? 'font-bold' : ''}`}>Fornecedores</span>
          </div>

          <div 
            onClick={() => setActiveTab('compras')}
            className={`mx-[21px] flex items-center gap-3 rounded-[10px] h-[43px] px-[14px] cursor-pointer transition-colors ${
              activeTab === 'compras' ? 'bg-[#DDEBDD] text-[#15543C]' : 'text-[#14171F] hover:bg-[#E5EEE5]'
            }`}
          >
            <ClipboardList className="w-[22px] h-[22px]" strokeWidth={2} />
            <span className={`font-semibold text-[15px] ${activeTab === 'compras' ? 'font-bold' : ''}`}>Compras</span>
          </div>

          <div 
            onClick={() => setActiveTab('contas')}
            className={`mx-[21px] flex items-center gap-3 rounded-[10px] h-[43px] px-[14px] cursor-pointer transition-colors ${
              activeTab === 'contas' ? 'bg-[#DDEBDD] text-[#15543C]' : 'text-[#14171F] hover:bg-[#E5EEE5]'
            }`}
          >
            <Wallet className="w-[22px] h-[22px]" strokeWidth={2} />
            <span className={`font-semibold text-[15px] ${activeTab === 'contas' ? 'font-bold' : ''}`}>Contas a pagar</span>
          </div>

          <div 
            onClick={() => setActiveTab('receber')}
            className={`mx-[21px] flex items-center gap-3 rounded-[10px] h-[43px] px-[14px] cursor-pointer transition-colors ${
              activeTab === 'receber' ? 'bg-[#DDEBDD] text-[#15543C]' : 'text-[#14171F] hover:bg-[#E5EEE5]'
            }`}
          >
            <Wallet className="w-[22px] h-[22px]" strokeWidth={2} />
            <span className={`font-semibold text-[15px] ${activeTab === 'receber' ? 'font-bold' : ''}`}>Contas a receber</span>
          </div>

          <div 
            onClick={() => setActiveTab('config')}
            className={`mx-[21px] flex items-center gap-3 rounded-[10px] h-[43px] px-[14px] cursor-pointer transition-colors ${
              activeTab === 'config' ? 'bg-[#DDEBDD] text-[#15543C]' : 'text-[#14171F] hover:bg-[#E5EEE5]'
            }`}
          >
            <Settings className="w-[22px] h-[22px]" strokeWidth={2} />
            <span className={`font-semibold text-[15px] ${activeTab === 'config' ? 'font-bold' : ''}`}>Configurações</span>
          </div>
        </nav>

        {/* Footer */}
        <div className="hidden md:flex px-[21px] pb-[24px] flex-col gap-[14px]">
          <div className="bg-white border border-[#DFE2DF] rounded-[13px] flex flex-col text-[#15543C] shadow-sm">
            <div className="flex items-center gap-3 h-[59px] px-4 cursor-pointer hover:bg-gray-50 rounded-t-[13px] transition-colors">
              <HelpCircle className="w-[20px] h-[20px]" strokeWidth={2.2} />
              <span className="font-semibold text-[15px]">Ajuda</span>
            </div>
            <div className="h-[1px] bg-[#DFE2DF] mx-4" />
            <div className="flex items-center gap-3 h-[59px] px-4 cursor-pointer hover:bg-gray-50 rounded-b-[13px] transition-colors">
              <LogOut className="w-[20px] h-[20px]" strokeWidth={2.2} />
              <span className="font-semibold text-[15px]">Sair</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      {activeTab === 'pdv' ? (
        <main className="flex-1 bg-white md:rounded-[28px] md:my-[17px] md:mr-[17px] shadow-sm flex flex-col relative overflow-y-auto overflow-x-hidden xl:overflow-hidden border border-[#DFE2DF]/50">
          
          {/* Top Header */}
        <header className="flex justify-between items-center mt-6 mx-5 md:mt-[55px] md:ml-[34px] md:mr-[34px]">
          <h1 className="text-[#15543C] text-[28px] md:text-[38px] font-bold tracking-tight">Nova venda</h1>
          <button className="flex items-center gap-2 border border-[#DFE2DF] rounded-[12px] bg-white h-[45px] px-[18px] text-[#15543C] font-semibold text-[15px] hover:bg-gray-50 transition-colors shadow-sm">
            <Plus className="w-[18px] h-[18px]" strokeWidth={2.5} />
            Cliente
          </button>
        </header>

        {/* Main Content Area */}
        <div className="flex flex-col xl:flex-row flex-none xl:flex-1 mt-5 mx-5 md:mt-[25px] md:ml-[34px] md:gap-[38px] md:pr-[34px] min-h-0 pb-5">
          
          {/* Left Column (Products) */}
          <div className="w-full xl:w-[835px] flex flex-none xl:flex-1 flex-col min-h-0">
            {/* Search */}
            <div className="flex items-center bg-white border border-[#DFE2DF] rounded-[13px] h-[63px] px-[18px] shadow-sm group focus-within:border-[#48905A] transition-colors">
              <Search className="w-[22px] h-[22px] text-[#74747C] mr-[14px]" strokeWidth={1.7} />
              <input 
                type="text" 
                placeholder="Buscar produto ou código de barras" 
                className="flex-1 bg-transparent outline-none text-[16px] text-[#14171F] placeholder:text-[#9A9A9A]"
              />
              <button className="text-[#9A9A9A] hover:text-[#15543C] transition-colors ml-3 border-l border-[#DFE2DF] pl-4 h-[30px] flex items-center">
                <ScanLine className="w-[24px] h-[24px]" strokeWidth={1.5} />
              </button>
            </div>

            {/* Categories */}
            <div className="flex flex-wrap gap-3 md:gap-[22px] mt-5 md:mt-[26px] pb-2">
              {[
                { 
                  name: 'Copos', 
                  active: true,
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" className="w-[42px] h-[42px] mb-[10px]" stroke="currentColor" strokeWidth="1.2">
                      <path d="M6 8L7.5 21H16.5L18 8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 8H19L18.5 5H5.5L5 8Z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )
                },
                { 
                  name: 'Pratos', 
                  active: false,
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" className="w-[42px] h-[42px] mb-[10px]" stroke="currentColor" strokeWidth="1.2">
                      <ellipse cx="12" cy="12" rx="9" ry="6" strokeLinecap="round"/>
                      <ellipse cx="12" cy="12" rx="5" ry="3" strokeLinecap="round"/>
                    </svg>
                  )
                },
                { 
                  name: 'Talheres', 
                  active: false,
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" className="w-[42px] h-[42px] mb-[10px]" stroke="currentColor" strokeWidth="1.2">
                      <path d="M12 22V11" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 11C12 11 14 9 14 5C14 5 12 5 12 8C12 5 10 5 10 5C10 9 12 11 12 11Z" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 5V4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 5V4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 5V4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )
                },
                { 
                  name: 'Embalagens', 
                  active: false,
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" className="w-[42px] h-[42px] mb-[10px]" stroke="currentColor" strokeWidth="1.2">
                      <path d="M4 14L5 19H19L20 14" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 14L6 9H18L20 14" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 14H20" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 9V6C9 5.44772 9.44772 5 10 5H14C14.5523 5 15 5.44772 15 6V9" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )
                },
                { 
                  name: 'Sacos', 
                  active: false,
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" className="w-[42px] h-[42px] mb-[10px]" stroke="currentColor" strokeWidth="1.2">
                      <path d="M8 8C8 5.79086 9.79086 4 12 4C14.2091 4 16 5.79086 16 8" strokeLinecap="round"/>
                      <path d="M5 10L6.5 21H17.5L19 10H5Z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )
                },
              ].map((cat, i) => (
                <div 
                  key={i} 
                  className={`flex shrink-0 flex-col items-center justify-center w-[112px] h-[104px] md:w-[149px] md:h-[135px] rounded-[14px] cursor-pointer transition-all ${
                    cat.active 
                      ? 'bg-[#F3FAF4] border border-[#48905A] text-[#15543C] shadow-[0_2px_14px_rgba(72,144,90,0.08)]' 
                      : 'bg-white border border-[#DFE2DF] text-[#15543C] hover:bg-gray-50 shadow-sm'
                  }`}
                >
                  {cat.icon}
                  <span className={`font-semibold text-[15px] ${cat.active ? 'text-[#15543C]' : 'text-[#14171F]'}`}>
                    {cat.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Product List */}
            <div className="mt-5 md:mt-[32px] border border-[#DFE2DF] rounded-[13px] bg-white flex flex-none xl:flex-1 h-[360px] xl:h-auto overflow-hidden min-h-0 xl:min-h-[440px] shadow-sm">
              {/* Table Header */}
              <div className="flex items-center h-[54px] px-3 md:px-6 border-b border-[#DFE2DF] text-[#74747C] font-semibold text-[13px] md:text-[14px]">
                <div className="flex-1">Produto</div>
                <div className="w-[82px] md:w-[120px] text-right pr-2 md:pr-[70px]">Preço</div>
              </div>
              
              {/* Table Body */}
              <div className="flex-1 overflow-y-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-[#74747C]">Carregando produtos...</div>
                ) : (
                  produtos.map((item) => (
                    <div key={item.id} className="flex items-center min-h-[74px] px-3 md:px-6 border-b border-[#DFE2DF]/60 hover:bg-[#F8FBF8] transition-colors group">
                      <div className="w-[56px] h-[52px] md:w-[77px] md:h-[59px] bg-[#F4F5F4] rounded-[10px] overflow-hidden flex items-center justify-center shrink-0 border border-black/5">
                        {item.imagem ? (
                          <img src={item.imagem} alt={item.nome} className="w-[50px] object-contain opacity-75 mix-blend-multiply grayscale-[20%]" />
                        ) : (
                          <Box className="w-8 h-8 text-[#9A9A9A]" />
                        )}
                      </div>
                      <div className="ml-3 md:ml-5 flex-1 min-w-0 text-[14px] md:text-[17px] text-[#14171F] font-medium break-words">
                        {item.nome}
                      </div>
                      <div className="w-[82px] md:w-[120px] shrink-0 text-right font-bold text-[14px] md:text-[17px] text-[#15543C] pr-2 md:pr-7 tracking-tight">
                        {formatCurrency(item.valor)}
                      </div>
                      <button 
                        onClick={() => adicionarAoCarrinho(item)}
                        className="w-[44px] h-[40px] md:w-[55px] md:h-[43px] shrink-0 border border-[#48905A]/40 rounded-[10px] flex items-center justify-center bg-white text-[#15543C] hover:bg-[#F3FAF4] hover:border-[#48905A] transition-colors shadow-sm"
                      >
                        <Plus className="w-[20px] h-[20px]" strokeWidth={2.5} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column (Summary) */}
          <div className="w-full xl:w-[364px] flex-none mt-5 xl:mt-0 bg-white border border-[#DFE3DF] rounded-[14px] flex flex-col xl:h-[699px] shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            
            {/* Header */}
            <div className="px-[25px] pt-[26px] pb-[22px] flex items-center gap-[12px]">
              <ShoppingCart className="w-[26px] h-[26px] text-[#15543C]" strokeWidth={1.8} />
              <h2 className="text-[#15543C] font-bold text-[20px]">Resumo do pedido</h2>
            </div>

            {/* Primeiro Divisor */}
            <div className="mx-[25px] h-[1px] bg-[#DFE3DF]"></div>

            <div className="flex-1 flex flex-col px-[25px] min-h-0 overflow-y-auto">
              {carrinho.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <svg viewBox="0 0 100 85" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[120px] h-[100px] text-[#9FCBA8] mb-[28px]">
                    <path d="M10 25L18 75H82L90 25H10Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M28 25V15C28 9.47715 32.4772 5 38 5H62C67.5228 5 72 9.47715 72 15V25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M30 45V60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M50 45V60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M70 45V60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M92 12L96 16L92 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 12L4 16L8 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div className="text-[#15543C] font-semibold text-[17px] mb-[8px] text-center">Nenhum item adicionado</div>
                  <div className="text-[#74747C] text-[15px] text-center font-normal">
                    Adicione produtos para iniciar a venda.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 py-4">
                  {carrinho.map((item) => (
                    <div key={item.produto.id} className="flex flex-col bg-white border border-[#DFE3DF] rounded-[10px] p-3 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-[15px] text-[#14171F] line-clamp-2 pr-2">{item.produto.nome}</span>
                        <span className="font-bold text-[15px] text-[#15543C]">{formatCurrency(item.produto.valor * item.quantidade)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-[#74747C]">{formatCurrency(item.produto.valor)} un</span>
                        <div className="flex items-center gap-3 bg-[#F4F5F4] rounded-lg p-1">
                          <button onClick={() => removerDoCarrinho(item.produto.id)} className="w-7 h-7 flex items-center justify-center bg-white rounded text-[#14171F] shadow-sm hover:text-red-500 transition-colors">
                            {item.quantidade > 1 ? <Minus className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                          <span className="font-semibold text-[14px] w-4 text-center">{item.quantidade}</span>
                          <button onClick={() => adicionarAoCarrinho(item.produto)} className="w-7 h-7 flex items-center justify-center bg-white rounded text-[#14171F] shadow-sm hover:text-[#48905A] transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-[25px] pb-[25px] bg-white rounded-b-[14px]">
              <div className="border-t border-[#DFE3DF] pt-[16px] pb-[16px]">
                <div className="flex flex-col gap-2 mb-4">
                  <label className="text-[14px] text-[#74747C] font-medium">Aplicar Desconto</label>
                  <div className="flex gap-2">
                    <select 
                      value={descontoTipo} 
                      onChange={(e) => setDescontoTipo(e.target.value as 'FIXO' | 'PERCENTUAL')}
                      className="border border-[#DFE3DF] rounded-[10px] px-3 h-[46px] text-[#14171F] font-medium outline-none focus:border-[#48905A] bg-white w-[100px]"
                    >
                      <option value="FIXO">R$</option>
                      <option value="PERCENTUAL">%</option>
                    </select>
                    <input 
                      type="text" 
                      value={descontoValorRaw}
                      onChange={(e) => setDescontoValorRaw(e.target.value.replace(/[^0-9,]/g, ''))}
                      placeholder={descontoTipo === 'FIXO' ? '0,00' : '0'}
                      className="border border-[#DFE3DF] rounded-[10px] px-4 h-[46px] text-[16px] text-[#14171F] font-medium outline-none focus:border-[#48905A] flex-1"
                    />
                  </div>
                </div>
              </div>
              
              <div className="border-t border-[#DFE3DF] pt-[16px] pb-[16px] flex justify-between items-center">
                <span className="text-[17px] text-[#14171F] font-medium">Subtotal</span>
                <span className="text-[17px] text-[#14171F] font-normal">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center mb-[24px]">
                <span className="text-[17px] text-[#15543C] font-medium">Desconto</span>
                <span className="text-[17px] text-[#15543C] font-medium">{formatCurrency(desconto)}</span>
              </div>
              
              <div className="border-t border-[#DFE3DF] pt-[22px] pb-[32px] flex justify-between items-center">
                <span className="text-[22px] font-bold text-[#14171F]">Total</span>
                <span className="text-[29px] font-bold text-[#15543C] tracking-tight">{formatCurrency(total)}</span>
              </div>

              <button 
                onClick={() => setCheckoutModalOpen(true)}
                disabled={carrinho.length === 0}
                className="w-full h-[63px] bg-[#48905A] hover:bg-[#3D7A4D] transition-colors rounded-[12px] flex items-center justify-center gap-[10px] text-white shadow-[0_4px_12px_rgba(72,144,90,0.15)] disabled:opacity-95 disabled:cursor-not-allowed"
              >
                <CreditCard className="w-[22px] h-[22px] text-white" strokeWidth={2} />
                <span className="font-semibold text-[20px]">Finalizar venda</span>
              </button>
            </div>

          </div>

        </div>
        </main>
      ) : activeTab === 'caixa' ? (
        <Caixa />
      ) : activeTab === 'vendas' ? (
        <VendasList />
      ) : activeTab === 'fornecedores' ? (
        <FornecedoresList />
      ) : activeTab === 'compras' ? (
        <ComprasList />
      ) : activeTab === 'contas' ? (
        <ContasAPagar />
      ) : activeTab === 'receber' ? (
        <ContasAReceber />
      ) : activeTab === 'estoque' ? (
        <Estoque />
      ) : (
        <Configuracoes />
      )}
      {checkoutModalOpen && (
        <PagamentoModal
          total={total}
          onClose={() => setCheckoutModalOpen(false)}
          onConfirm={finalizarVenda}
        />
      )}
    </div>
  );
}
