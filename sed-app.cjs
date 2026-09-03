const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  `import Caixa from './components/Caixa';`,
  `import Caixa from './components/Caixa';\nimport Configuracoes from './components/Configuracoes';`
);

content = content.replace(
  `const [activeTab, setActiveTab] = useState<'pdv' | 'caixa' | 'vendas'>('pdv');`,
  `const [activeTab, setActiveTab] = useState<'pdv' | 'caixa' | 'vendas' | 'config'>('pdv');`
);

const configTabHtml = `
          <div 
            onClick={() => setActiveTab('vendas')}
            className={\`mx-[21px] flex items-center gap-4 rounded-[15px] h-[59px] px-[18px] cursor-pointer transition-colors \${
              activeTab === 'vendas' ? 'bg-[#DDEBDD] text-[#15543C]' : 'text-[#14171F] hover:bg-[#E5EEE5]'
            }\`}
          >
            <ClipboardList className="w-[22px] h-[22px]" strokeWidth={2} />
            <span className={\`font-semibold text-[17px] \${activeTab === 'vendas' ? 'font-bold' : ''}\`}>Vendas</span>
          </div>
          <div 
            onClick={() => setActiveTab('config')}
            className={\`mx-[21px] flex items-center gap-4 rounded-[15px] h-[59px] px-[18px] cursor-pointer transition-colors \${
              activeTab === 'config' ? 'bg-[#DDEBDD] text-[#15543C]' : 'text-[#14171F] hover:bg-[#E5EEE5]'
            }\`}
          >
            <Settings className="w-[22px] h-[22px]" strokeWidth={2} />
            <span className={\`font-semibold text-[17px] \${activeTab === 'config' ? 'font-bold' : ''}\`}>Configurações</span>
          </div>
`;

content = content.replace(/<div \n\s*onClick=\{\(\) => setActiveTab\('vendas'\)\}[\s\S]*?<\/div>/, configTabHtml.trim());

const renderTabReplacement = `
      ) : activeTab === 'caixa' ? (
        <Caixa />
      ) : activeTab === 'vendas' ? (
        <VendasList />
      ) : (
        <Configuracoes />
      )}
`;

content = content.replace(/\) : activeTab === 'caixa' \? \([\s\S]*?<\/VendasList>\n      \)\}/, renderTabReplacement.trim());

fs.writeFileSync('src/App.tsx', content);
