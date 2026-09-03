const fs = require('fs');
let content = fs.readFileSync('src/components/VendasList.tsx', 'utf8');

const getPagamentoLabelReplacement = `
  const getPagamentoLabel = (venda: Venda) => {
    if (!venda.pagamentos || venda.pagamentos.length === 0) return 'N/A';
    if (venda.pagamentos.length === 1) {
      const p = venda.pagamentos[0];
      const methodLabel = p.metodo === 'CASH' ? 'Dinheiro' : 
                          p.metodo === 'DEBIT_CARD' ? 'Débito' : 
                          p.metodo === 'CREDIT_CARD' ? 'Crédito' : 'PIX';
      if (p.metodo === 'CREDIT_CARD' && p.installments && p.installments > 1) {
        return \`\${methodLabel} (\${p.installments}x)\`;
      }
      return methodLabel;
    }
    return \`Misto (\${venda.pagamentos.length} formas)\`;
  };
`;

content = content.replace(/const getPagamentoLabel = [\s\S]*?return `Misto \(\${venda\.pagamentos\.length} formas\)`;\n  };/, getPagamentoLabelReplacement.trim());


const detalheReplacement = `
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-[#14171F]">
                        {p.metodo === 'CASH' ? 'Dinheiro' : p.metodo === 'PIX' ? 'PIX' : p.metodo === 'DEBIT_CARD' ? 'Débito' : 'Crédito'}
                        {p.metodo === 'CREDIT_CARD' && (p.installments || 1) > 1 && \` (\${p.installments} parcelas)\`}
                      </span>
                      <span className="font-bold">{formatCents(p.valorCentavos)}</span>
                    </div>
                    {p.metodo === 'CREDIT_CARD' && (p.installments || 1) > 1 && (
                      <div className="text-xs text-[#74747C]">
                        {p.installments}x de {formatCents(Math.floor(p.valorCentavos / p.installments!))}
                      </div>
                    )}
                    {p.metodo === 'CASH' && p.valorRecebidoCentavos !== undefined && (
`;

content = content.replace(/<div className="flex justify-between mb-1">[\s\S]*?\{p\.metodo === 'CASH' && p\.valorRecebidoCentavos !== undefined && \(/, detalheReplacement.trim());

fs.writeFileSync('src/components/VendasList.tsx', content);
