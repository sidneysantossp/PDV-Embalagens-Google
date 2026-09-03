const fs = require('fs');
let content = fs.readFileSync('src/services/VendaService.ts', 'utf8');

const replacement = `
    const config = db.configuracaoPagamento;

    // Verificar duplicação de métodos
    const metodosVistos = new Set<string>();
    let totalPago = 0;

    for (const p of data.pagamentos) {
      if (metodosVistos.has(p.metodo)) {
        throw new Error(\`Método de pagamento duplicado: \${p.metodo}.\`);
      }
      metodosVistos.add(p.metodo);

      if (p.valorCentavos <= 0) {
        throw new Error('O valor de cada pagamento deve ser maior que zero.');
      }

      if (p.metodo === 'CASH') {
        if (!p.valorRecebidoCentavos || p.valorRecebidoCentavos < p.valorCentavos) {
          throw new Error('O valor recebido em dinheiro não pode ser menor que o valor aplicado.');
        }
      }

      let installments = p.installments ?? 1;
      if (p.metodo === 'CREDIT_CARD') {
        if (installments < 1 || installments > config.maxCreditInstallments) {
          throw new Error(\`Número de parcelas no crédito deve ser entre 1 e \${config.maxCreditInstallments}.\`);
        }
      } else {
        if (installments > 1) {
          throw new Error(\`Parcelamento não permitido para o método \${p.metodo}.\`);
        }
        installments = 1;
      }
      // Mutating to ensure default 1 is set
      p.installments = installments;

      totalPago += p.valorCentavos;
    }
`;

content = content.replace(/\/\/ Verificar duplicação de métodos[\s\S]*?totalPago \+= p\.valorCentavos;\n    \}/, replacement.trim());

// And updating the novaVenda pagamentos map:
const mapRepl = `
      pagamentos: data.pagamentos.map((p, index) => {
        let trocoCentavos = 0;
        let valorRecebidoCentavos = p.valorRecebidoCentavos;
        
        if (p.metodo === 'CASH') {
          trocoCentavos = (valorRecebidoCentavos || p.valorCentavos) - p.valorCentavos;
        } else {
          valorRecebidoCentavos = undefined;
          trocoCentavos = undefined as any;
        }

        return {
          id: \`\${Date.now()}-\${index}\`,
          vendaId: '', // Será preenchido depois
          metodo: p.metodo,
          valorCentavos: p.valorCentavos,
          valorRecebidoCentavos,
          trocoCentavos,
          installments: p.installments
        };
      })
`;

content = content.replace(/pagamentos: data\.pagamentos\.map\(\(p, index\) => \{[\s\S]*?\}\)/, mapRepl.trim());

fs.writeFileSync('src/services/VendaService.ts', content);
