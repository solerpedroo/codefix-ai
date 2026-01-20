import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Code, Loader, History, Trash2, Download } from 'lucide-react';

const CodeFixAI = () => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await window.storage.list('codefix:');
      if (data && data.keys) {
        const historyItems = await Promise.all(
          data.keys.map(async (key) => {
            try {
              const item = await window.storage.get(key);
              return item ? JSON.parse(item.value) : null;
            } catch {
              return null;
            }
          })
        );
        setHistory(historyItems.filter(Boolean).sort((a, b) => b.timestamp - a.timestamp));
      }
    } catch (error) {
      console.log('Histórico vazio ou erro:', error);
      setHistory([]);
    }
  };

  const analyzeCode = async () => {
    if (!code.trim()) {
      alert('Por favor, insira um código para análise');
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `Você é um especialista em análise de código. Analise o seguinte código ${language} e retorne APENAS um JSON válido (sem markdown, sem \`\`\`json) com esta estrutura exata:

{
  "hasIssues": true/false,
  "issues": [
    {
      "type": "bug/performance/naming/validation/security",
      "severity": "high/medium/low",
      "line": número_da_linha,
      "description": "descrição do problema",
      "suggestion": "como corrigir"
    }
  ],
  "correctedCode": "código corrigido completo",
  "summary": "resumo das correções feitas"
}

Código para análise:
\`\`\`${language}
${code}
\`\`\`

Detecte:
- Bugs e erros lógicos
- Problemas de performance
- Variáveis mal nomeadas
- Falta de validações
- Vulnerabilidades de segurança
- Boas práticas não seguidas

Se não houver problemas, retorne hasIssues: false e correctedCode igual ao original.`
          }]
        })
      });

      const data = await response.json();
      const aiResponse = data.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');

      const cleanResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analysisResult = JSON.parse(cleanResponse);

      const historyItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        language,
        originalCode: code,
        result: analysisResult
      };

      await window.storage.set(`codefix:${historyItem.id}`, JSON.stringify(historyItem));
      
      setResult(analysisResult);
      await loadHistory();

    } catch (error) {
      console.error('Erro na análise:', error);
      setResult({
        hasIssues: false,
        issues: [],
        correctedCode: code,
        summary: 'Erro ao analisar código. Tente novamente.',
        error: true
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const loadFromHistory = (item) => {
    setCode(item.originalCode);
    setLanguage(item.language);
    setResult(item.result);
    setShowHistory(false);
  };

  const deleteHistoryItem = async (id) => {
    try {
      await window.storage.delete(`codefix:${id}`);
      await loadHistory();
    } catch (error) {
      console.error('Erro ao deletar:', error);
    }
  };

  const clearAllHistory = async () => {
    if (!confirm('Tem certeza que deseja limpar todo o histórico?')) return;
    
    try {
      const data = await window.storage.list('codefix:');
      if (data && data.keys) {
        await Promise.all(data.keys.map(key => window.storage.delete(key)));
      }
      setHistory([]);
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    
    const report = `# CodeFix AI - Relatório de Análise
    
**Linguagem:** ${language}
**Data:** ${new Date().toLocaleString('pt-BR')}

## Código Original
\`\`\`${language}
${code}
\`\`\`

## Problemas Encontrados
${result.issues.map((issue, i) => `
${i + 1}. **${issue.type.toUpperCase()}** (${issue.severity})
   - Linha: ${issue.line}
   - Descrição: ${issue.description}
   - Sugestão: ${issue.suggestion}
`).join('\n')}

## Código Corrigido
\`\`\`${language}
${result.correctedCode}
\`\`\`

## Resumo
${result.summary}
`;

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codefix-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityColor = (severity) => {
    const colors = {
      high: 'text-red-600 bg-red-50 border-red-200',
      medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      low: 'text-blue-600 bg-blue-50 border-blue-200'
    };
    return colors[severity] || colors.medium;
  };

  const getTypeIcon = (type) => {
    const icons = {
      bug: '🐛',
      performance: '⚡',
      naming: '🏷️',
      validation: '✅',
      security: '🔒'
    };
    return icons[type] || '⚠️';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Code className="w-12 h-12 text-purple-400" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              CodeFix AI
            </h1>
          </div>
          <p className="text-slate-300 text-lg">
            Detecte falhas e otimize seu código automaticamente com IA
          </p>
        </div>

        {/* Controls */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-slate-700">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-3 items-center">
              <label className="text-slate-300 font-medium">Linguagem:</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="c">C</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
                <option value="sql">SQL</option>
                <option value="go">Go</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                <History className="w-4 h-4" />
                Histórico ({history.length})
              </button>
              
              {result && (
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Baixar Relatório
                </button>
              )}
            </div>
          </div>
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-purple-400">Histórico de Análises</h2>
              {history.length > 0 && (
                <button
                  onClick={clearAllHistory}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Limpar Tudo
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p className="text-slate-400 text-center py-8">Nenhuma análise no histórico</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-700/50 rounded-lg p-4 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1" onClick={() => loadFromHistory(item)}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-1 bg-purple-600 rounded text-xs font-mono">
                            {item.language}
                          </span>
                          <span className="text-slate-400 text-sm">
                            {new Date(item.timestamp).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 font-mono truncate">
                          {item.originalCode.substring(0, 60)}...
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {item.result.issues.length} problema(s) encontrado(s)
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                        className="text-red-400 hover:text-red-300 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input */}
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-bold mb-4 text-purple-400">Código Original</h2>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={`Cole seu código ${language} aqui...`}
              className="w-full h-96 bg-slate-900 border border-slate-600 rounded-lg p-4 text-white font-mono text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
            />
            
            <button
              onClick={analyzeCode}
              disabled={analyzing || !code.trim()}
              className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-600 disabled:to-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Code className="w-5 h-5" />
                  Analisar Código
                </>
              )}
            </button>
          </div>

          {/* Output */}
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-bold mb-4 text-green-400">Código Corrigido</h2>
            
            {!result ? (
              <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                <Code className="w-16 h-16 mb-4 opacity-50" />
                <p>Aguardando análise...</p>
              </div>
            ) : result.error ? (
              <div className="flex flex-col items-center justify-center h-96 text-red-400">
                <AlertCircle className="w-16 h-16 mb-4" />
                <p>{result.summary}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 h-80 overflow-auto">
                  <pre className="text-sm font-mono text-green-300 whitespace-pre-wrap">
                    {result.correctedCode}
                  </pre>
                </div>

                {result.hasIssues && (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    {result.issues.length} problema(s) corrigido(s)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Analysis Results */}
        {result && !result.error && (
          <div className="mt-6 space-y-6">
            {/* Summary */}
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-bold mb-3 text-purple-400">📊 Resumo da Análise</h3>
              <p className="text-slate-300 leading-relaxed">{result.summary}</p>
            </div>

            {/* Issues */}
            {result.hasIssues && result.issues.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold mb-4 text-red-400">🔍 Problemas Detectados</h3>
                <div className="space-y-3">
                  {result.issues.map((issue, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 ${getSeverityColor(issue.severity)}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{getTypeIcon(issue.type)}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold uppercase text-sm">
                              {issue.type}
                            </span>
                            <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-semibold">
                              {issue.severity}
                            </span>
                            {issue.line && (
                              <span className="text-xs opacity-75">
                                Linha {issue.line}
                              </span>
                            )}
                          </div>
                          <p className="mb-2 font-medium">{issue.description}</p>
                          <div className="bg-white/10 rounded p-2 text-sm">
                            <strong>💡 Sugestão:</strong> {issue.suggestion}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!result.hasIssues && (
              <div className="bg-green-900/20 border border-green-700 rounded-xl p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                  <div>
                    <h3 className="text-lg font-bold text-green-400">
                      Código limpo!
                    </h3>
                    <p className="text-slate-300">
                      Nenhum problema detectado. Seu código está seguindo as boas práticas.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-slate-400 text-sm">
          <p>Powered by Claude AI • Análise inteligente de código em tempo real</p>
        </div>
      </div>
    </div>
  );
};

export default CodeFixAI;