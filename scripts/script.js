// ============================================
// CONFIGURAÇÃO DA API GROQ
// ============================================

// INSIRA SUA API KEY DO GROQ AQUI:
const GROQ_API_KEY = "sua-api-key-aqui"; // <-- COLE SUA API KEY AQUI

// Modelos válidos do Groq (atualizados Dezembro 2024)
const GROQ_MODELS = {
    // Modelos disponíveis atualmente (verificar em console.groq.com/docs/models)
    'llama-3.3-70b': 'llama-3.3-70b-versatile',  // Mais recente e recomendado
    'llama-3.1-8b': 'llama-3.1-8b-instant',      // Versão mais rápida
    'mixtral': 'mixtral-8x7b-32768',             // Alternativa sólida
    'gemma': 'gemma2-9b-it'                      // Modelo Google
};

// Modelo atual - use 'llama-3.3-70b-versatile' (modelo mais recente)
const CURRENT_MODEL = 'llama-3.3-70b-versatile';

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================

let currentResult = null;
const HISTORY_KEY = 'codefix_history';

// ============================================
// FUNÇÕES DA API GROQ
// ============================================

async function analyzeWithGroqAPI(code, language) {
    const systemPrompt = `Você é um analisador e corretor de código especializado. 
Sua tarefa é analisar o código fornecido, identificar TODOS os problemas e retornar o código corrigido.

IMPORTANTE: Você DEVE retornar APENAS um objeto JSON com a seguinte estrutura EXATA:
{
  "hasIssues": boolean,
  "issues": [
    {
      "type": "bug/security/performance/naming/validation/syntax/logic/memory/style",
      "severity": "high/medium/low",
      "line": number,
      "description": "Descrição clara do problema",
      "suggestion": "Solução específica para corrigir"
    }
  ],
  "correctedCode": "Código completo corrigido e funcional",
  "summary": "Resumo conciso das correções aplicadas"
}

Regras:
1. Analise o código linha por linha
2. Identifique TODOS os problemas (sintaxe, lógica, segurança, performance, etc.)
3. Forneça o código COMPLETAMENTE corrigido
4. Se não houver problemas, retorne "hasIssues": false
5. NUNCA adicione texto fora do JSON
6. O código corrigido deve ser EXECUTÁVEL`;

    const userPrompt = `Linguagem: ${language}

Analise e corrija o seguinte código:

\`\`\`${language}
${code}
\`\`\`

Retorne o JSON com a análise completa e o código corrigido.`;

    try {
        console.log('Enviando requisição para Groq API...');
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                model: CURRENT_MODEL,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: userPrompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 4000,
                top_p: 0.9,
                stream: false,
                response_format: { type: "json_object" }
            })
        });

        console.log('Status da resposta:', response.status);
        
        if (!response.ok) {
            let errorMessage = `Erro HTTP: ${response.status}`;
            try {
                const errorData = await response.json();
                console.error('Erro da API:', errorData);
                errorMessage = errorData.error?.message || JSON.stringify(errorData);
            } catch (e) {
                const errorText = await response.text();
                errorMessage = errorText || errorMessage;
            }
            throw new Error(`Erro na API Groq: ${errorMessage}`);
        }

        const data = await response.json();
        console.log('Resposta da API:', data);
        
        const aiResponse = data.choices[0]?.message?.content || '';
        
        if (!aiResponse) {
            throw new Error('Resposta vazia da API');
        }

        // Tentar extrair JSON da resposta
        let jsonStr = aiResponse.trim();
        
        // Remover possíveis markdown
        jsonStr = jsonStr.replace(/```json\s*/gi, '');
        jsonStr = jsonStr.replace(/```\s*/gi, '');
        
        // Verificar se começa e termina com chaves
        if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) {
            // Tentar encontrar JSON dentro do texto
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            } else {
                throw new Error('Não foi possível extrair JSON da resposta');
            }
        }

        const result = JSON.parse(jsonStr);
        
        // Validar estrutura básica
        if (typeof result.hasIssues === 'undefined') {
            result.hasIssues = Array.isArray(result.issues) && result.issues.length > 0;
        }
        
        if (!result.correctedCode) {
            result.correctedCode = code;
        }
        
        if (!result.summary) {
            result.summary = result.hasIssues 
                ? `Foram encontrados ${result.issues?.length || 0} problema(s) e aplicadas correções.`
                : '✅ Código analisado. Nenhum problema encontrado!';
        }
        
        return result;
        
    } catch (error) {
        console.error('Erro na análise com Groq:', error);
        throw error;
    }
}

// ============================================
// FUNÇÃO DE FALLBACK LOCAL
// ============================================

function analyzeWithLocalFallback(code, language) {
    return new Promise((resolve) => {
        setTimeout(() => {
            let hasIssues = false;
            let issues = [];
            let correctedCode = code;
            let summary = "⚠️ API não configurada. Para análise completa com IA, configure sua API Key no código.";
            
            // Análise básica local
            const lines = code.split('\n');
            
            lines.forEach((line, index) => {
                const lineNum = index + 1;
                
                // Detecção básica de problemas comuns
                if (language === 'python') {
                    // printf em Python
                    if (line.includes('printf(') && !line.includes('#')) {
                        hasIssues = true;
                        issues.push({
                            type: "syntax",
                            severity: "high",
                            line: lineNum,
                            description: "printf() não é uma função Python válida",
                            suggestion: "Use print() em vez de printf()"
                        });
                        correctedCode = correctedCode.replace(/printf\(/g, 'print(');
                    }
                    
                    // Divisão por zero
                    if (line.includes('/ 0') || line.includes('/0')) {
                        hasIssues = true;
                        issues.push({
                            type: "logic",
                            severity: "high",
                            line: lineNum,
                            description: "Divisão por zero detectada",
                            suggestion: "Adicione verificação antes da divisão"
                        });
                    }
                }
                
                // C/C++ sem main
                if ((language === 'c' || language === 'cpp') && 
                    code.includes('printf(') && 
                    !code.includes('int main') && 
                    !code.includes('void main')) {
                    hasIssues = true;
                    issues.push({
                        type: "structure",
                        severity: "high",
                        line: 1,
                        description: "Código C/C++ sem função main()",
                        suggestion: "Adicione int main() { ... } return 0;"
                    });
                    correctedCode = `#include <stdio.h>\n\nint main() {\n    ${code}\n    return 0;\n}`;
                }
            });
            
            if (hasIssues) {
                summary = `⚠️ Análise básica: ${issues.length} problema(s) encontrado(s). Configure a API para análise completa.`;
            }
            
            resolve({
                hasIssues: hasIssues,
                issues: issues,
                correctedCode: correctedCode,
                summary: summary
            });
        }, 800);
    });
}

// ============================================
// FUNÇÃO PRINCIPAL DE ANÁLISE
// ============================================

async function analyzeCode() {
    const code = document.getElementById('codeInput').value.trim();
    const language = document.getElementById('languageSelect').value;
    
    if (!code) {
        alert('Por favor, insira um código para análise!');
        return;
    }
    
    // Verificar se API key está configurada
    if (!GROQ_API_KEY || GROQ_API_KEY === "sua-api-key-aqui") {
        alert('⚠️ API Key não configurada!\n\nPor favor, abra o arquivo script.js e cole sua API Key do Groq na linha 8:\n\nconst GROQ_API_KEY = "sua-chave-aqui";\n\nObtenha uma chave gratuita em: https://console.groq.com/keys');
        return;
    }

    const analyzeBtn = document.getElementById('analyzeBtn');
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="loading"></span> Analisando com IA...';

    document.getElementById('resultContainer').innerHTML = `
        <div class="placeholder">
            <div class="loading" style="width: 60px; height: 60px; border-width: 5px;"></div>
            <p style="margin-top: 20px;">Analisando código com Groq AI...</p>
            <p style="font-size: 0.9em; color: #64748b; margin-top: 10px;">
                Usando: ${CURRENT_MODEL}<br>
                Linguagem: ${language}
            </p>
        </div>`;

    try {
        let result;
        
        try {
            result = await analyzeWithGroqAPI(code, language);
        } catch (apiError) {
            console.warn('Falha na API Groq, usando fallback local:', apiError);
            result = await analyzeWithLocalFallback(code, language);
            result.summary = `⚠️ ${apiError.message}. ${result.summary}`;
        }
        
        currentResult = result;
        displayResult(result);
        
        // Salvar no histórico
        const historyItem = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            language: language,
            originalCode: code,
            result: result
        };
        
        saveToHistory(historyItem);
        updateHistoryDisplay();
        
        document.getElementById('downloadBtn').style.display = 'inline-flex';

    } catch (error) {
        console.error('Erro na análise:', error);
        document.getElementById('resultContainer').innerHTML = `
            <div class="placeholder" style="color: #ef4444;">
                <p>❌ Erro na análise:</p>
                <p style="font-size: 0.9em; margin-top: 10px; background: rgba(220, 38, 38, 0.1); padding: 10px; border-radius: 5px;">
                    ${error.message}
                </p>
                <p style="font-size: 0.8em; margin-top: 20px; color: #64748b;">
                    Verifique sua API Key no arquivo script.js
                </p>
            </div>`;
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span class="btn-icon"></span> Analisar Código com IA';
    }
}

// ============================================
// FUNÇÕES DE EXIBIÇÃO
// ============================================

function displayResult(result) {
    let statsHtml = '';
    if (result.hasIssues && result.issues && result.issues.length > 0) {
        const highCount = result.issues.filter(i => i.severity === 'high').length;
        const mediumCount = result.issues.filter(i => i.severity === 'medium').length;
        const lowCount = result.issues.filter(i => i.severity === 'low').length;
        
        statsHtml = `<div class="stats">
            <div class="stat-item">${result.issues.length} problema(s)</div>
            ${highCount > 0 ? `<div class="stat-item" style="border-color: #dc2626; color: #f87171;">${highCount} alta</div>` : ''}
            ${mediumCount > 0 ? `<div class="stat-item" style="border-color: #eab308; color: #fbbf24;">${mediumCount} média</div>` : ''}
            ${lowCount > 0 ? `<div class="stat-item">${lowCount} baixa</div>` : ''}
        </div>`;
    }

    const escapedCode = result.correctedCode
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    document.getElementById('resultContainer').innerHTML = 
        `<pre class="result-code">${escapedCode}</pre>` + statsHtml;

    const summarySection = document.getElementById('summarySection');
    summarySection.style.display = 'block';

    if (!result.hasIssues || !result.issues || result.issues.length === 0) {
        summarySection.innerHTML = `
            <div class="success-panel">
                <div>
                    <h3>✅ Código Perfeito!</h3>
                    <p style="color: #86efac;">${result.summary}</p>
                </div>
            </div>`;
    } else {
        const issuesHtml = result.issues.map((issue, index) => {
            const severityClass = 'issue-' + issue.severity;
            const severityText = issue.severity === 'high' ? 'Alta' : 
                               issue.severity === 'medium' ? 'Média' : 'Baixa';
            const severityIcon = issue.severity === 'high' ? '🔴' :
                               issue.severity === 'medium' ? '🟡' : '🔵';
            
            return `<div class="issue-card ${severityClass}">
                <div class="issue-header">
                    <span class="issue-type">${issue.type || 'problema'}</span>
                    <span class="severity-badge severity-${issue.severity}">
                        ${severityIcon} ${severityText}
                    </span>
                    ${issue.line ? `<span style="font-size: 0.9em; opacity: 0.8;">Linha ${issue.line}</span>` : ''}
                </div>
                <p style="margin-bottom: 10px;"><strong>📋 Problema:</strong> ${issue.description || 'Descrição não disponível'}</p>
                <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px;">
                    <strong>💡 Sugestão:</strong> ${issue.suggestion || 'Sem sugestão disponível'}
                </div>
            </div>`;
        }).join('');

        summarySection.innerHTML = `
            <div class="summary-panel">
                <h3>📊 Resumo da Análise</h3>
                <p style="color: #93c5fd; line-height: 1.6;">${result.summary}</p>
            </div>
            <div class="summary-panel">
                <h3>🔎 Problemas Detectados (${result.issues.length})</h3>
                <div class="issues-container">${issuesHtml}</div>
            </div>`;
    }
}

// ============================================
// FUNÇÕES DO HISTÓRICO
// ============================================

function saveToHistory(item) {
    const history = getHistory();
    history.unshift(item);
    if (history.length > 50) history.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function getHistory() {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
}

function updateHistoryDisplay() {
    const history = getHistory();
    document.getElementById('historyCount').textContent = history.length;
    
    const historyList = document.getElementById('historyList');
    if (history.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px;">Nenhuma análise no histórico</p>';
    } else {
        historyList.innerHTML = history.map(item => {
            const issuesCount = item.result.issues?.length || 0;
            const hasIssues = item.result.hasIssues && issuesCount > 0;
            
            return `<div class="history-item" onclick="loadFromHistory(${JSON.stringify(item).replace(/</g, '&lt;').replace(/>/g, '&gt;')})">
                <div style="flex: 1;">
                    <div style="margin-bottom: 8px;">
                        <span class="language-badge">${item.language}</span>
                        <span style="margin-left: 10px; color: #64748b; font-size: 0.9em;">
                            ${new Date(item.timestamp).toLocaleString('pt-BR')}
                        </span>
                    </div>
                    <p style="font-family: monospace; font-size: 0.9em; color: #93c5fd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${item.originalCode.substring(0, 80).replace(/</g, '&lt;').replace(/>/g, '&gt;')}...
                    </p>
                    <p style="font-size: 0.85em; color: ${hasIssues ? '#ef4444' : '#60a5fa'}; margin-top: 5px;">
                        ${hasIssues ? `⚠️ ${issuesCount} problema(s)` : '✅ Sem problemas'}
                    </p>
                </div>
                <button onclick="event.stopPropagation(); deleteHistoryItem('${item.id}')" 
                        style="background: #dc2626; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer;">
                    🗑️
                </button>
            </div>`;
        }).join('');
    }
}

function loadFromHistory(item) {
    document.getElementById('codeInput').value = item.originalCode;
    document.getElementById('languageSelect').value = item.language;
    currentResult = item.result;
    displayResult(item.result);
    document.getElementById('downloadBtn').style.display = 'inline-flex';
    document.getElementById('historyPanel').style.display = 'none';
}

function deleteHistoryItem(id) {
    let history = getHistory();
    history = history.filter(item => item.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    updateHistoryDisplay();
}

function clearHistory() {
    if (!confirm('Tem certeza que deseja limpar todo o histórico?')) return;
    localStorage.removeItem(HISTORY_KEY);
    updateHistoryDisplay();
}

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================

function toggleHistory() {
    const panel = document.getElementById('historyPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function downloadReport() {
    if (!currentResult) return;
    
    const code = document.getElementById('codeInput').value;
    const language = document.getElementById('languageSelect').value;
    
    const issuesText = (currentResult.issues || []).map((issue, i) => {
        const severityText = issue.severity === 'high' ? 'Alta' : 
                           issue.severity === 'medium' ? 'Média' : 'Baixa';
        return `
### ${i + 1}. ${issue.type?.toUpperCase() || 'PROBLEMA'} (Severidade: ${severityText})
- **Linha:** ${issue.line || 'N/A'}
- **Descrição:** ${issue.description || 'N/A'}
- **Sugestão:** ${issue.suggestion || 'N/A'}`;
    }).join('\n');

    const report = `# CodeFix AI - Relatório de Análise
Desenvolvido por Pedro Soler

## 📊 Informações da Análise
- **Linguagem:** ${language}
- **Data:** ${new Date().toLocaleString('pt-BR')}
- **Modelo:** ${CURRENT_MODEL}
- **Status:** ${currentResult.hasIssues ? 'Problemas encontrados' : 'Código perfeito'}

---

## 📝 Código Original
\`\`\`${language}
${code}
\`\`\`

---

## 🚨 Problemas Detectados
${currentResult.issues && currentResult.issues.length > 0 ? issuesText : '✅ Nenhum problema encontrado.'}

---

## ✅ Código Corrigido
\`\`\`${language}
${currentResult.correctedCode}
\`\`\`

---

## 📋 Resumo
${currentResult.summary || 'Análise completa realizada.'}

---

*Relatório gerado automaticamente por CodeFix AI com Groq*
*© 2026 Pedro Soler - Todos os direitos reservados*`;

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codefix-${language}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// INICIALIZAÇÃO
// ============================================

// Inicializar quando o documento carregar
document.addEventListener('DOMContentLoaded', function() {
    updateHistoryDisplay();
    
    // Verificar se API key está configurada
    if (!GROQ_API_KEY || GROQ_API_KEY === "sua-api-key-aqui") {
        console.warn('⚠️ API Key do Groq não configurada!');
        console.info('Por favor, abra o arquivo script.js e cole sua API Key na linha 8.');
        console.info('Obtenha uma chave gratuita em: https://console.groq.com/keys');
    } else {
        console.log('✅ API Key do Groq configurada.');
    }
});