const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  `import Configuracoes from './components/Configuracoes';`,
  `import Configuracoes from './components/Configuracoes';\nimport FornecedoresList from './components/FornecedoresList';`
);

content = content.replace(
  `const [activeTab, setActiveTab] = useState<'pdv' | 'caixa' | 'vendas' | 'config'>('pdv');`,
  `const [activeTab, setActiveTab] = useState<'pdv' | 'caixa' | 'vendas' | 'config' | 'fornecedores'>('pdv');`
);

const fornecedoresTabHtml = `
          <div 
            onClick={() => setActiveTab('fornecedores')}
            className={\`mx-[21px] flex items-center gap-4 rounded-[15px] h-[59px] px-[18px] cursor-pointer transition-colors \${
              activeTab === 'fornecedores' ? 'bg-[#DDEBDD] text-[#15543C]' : 'text-[#14171F] hover:bg-[#E5EEE5]'
            }\`}
          >
            <Truck className="w-[22px] h-[22px]" strokeWidth={2} />
            <span className={\`font-semibold text-[17px] \${activeTab === 'fornecedores' ? 'font-bold' : ''}\`}>Fornecedores</span>
          </div>
`;

// Insert after vendas tab or before relatorios tab? I'll insert after vendas
content = content.replace(
  /<div \n\s*onClick=\{\(\) => setActiveTab\('vendas'\)\}[\s\S]*?<\/div>/,
  match => match + '\n' + fornecedoresTabHtml
);

content = content.replace(
  `ClipboardList,`,
  `ClipboardList,\n  Truck,`
);

const renderTabReplacement = `
      ) : activeTab === 'vendas' ? (
        <VendasList />
      ) : activeTab === 'fornecedores' ? (
        <FornecedoresList />
      ) : (
        <Configuracoes />
      )}
`;

content = content.replace(/\) : activeTab === 'vendas' \? \([\s\S]*?<\/Configuracoes>\n      \)\}/, renderTabReplacement.trim());

fs.writeFileSync('src/App.tsx', content);
