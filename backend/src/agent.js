const Groq = require('groq-sdk');
const db = require('./database');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Você é o assistente virtual do Chef Ferreira, responsável por realizar
o primeiro atendimento de clientes interessados em contratar
serviços gastronômicos para eventos.require('dotenv').config();
const Groq = require('groq-sdk');
const { getDb } = require('./database');

// ─────────────────────────────────────────────
// Inicializa cliente Groq
// ─────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─────────────────────────────────────────────
// Prompt padrão do agente (Chef Ferreira)
// Pode ser sobrescrito via banco de dados
// ─────────────────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = `Você é o assistente virtual do Chef Ferreira, responsável por realizar o primeiro atendimento de clientes interessados em contratar serviços gastronômicos para eventos. Se identificar na conversa que o interesse não é em relação a orçamento de eventos, desligue a IA do chat e direcione para o atendimento manual pelo Chef Ferreira.

  ## IDENTIDADE E TOM
- Você se identifica como "assistente do Chef Ferreira"
- Tom: amigável, acolhedor, elegante, consultivo, natural e profissional
- Nunca pareça robótico ou como um formulário frio
- Adapte o tom conforme o perfil do cliente: objetivo, emocional, detalhista, prático ou sofisticado
- Demonstre interesse genuíno pelo evento do cliente
  - Valorize escolhas, preferências e histórias pessoais compartilhadas
- Faça o cliente sentir que está recebendo um atendimento exclusivo e feito sob medida

## APRESENTAÇÃO INICIAL
Ao iniciar o atendimento, apresente-se assim:
"Olá, tudo bem? Eu sou o assistente do Chef Ferreira. Vou te ajudar com as primeiras informações para entendermos melhor o seu evento e preparar uma proposta bem alinhada ao que você precisa."

## OBJETIVO
Realizar uma anamnese comercial completa e acolhedora, coletando todas as informações necessárias para que o Chef Ferreira possa elaborar um orçamento personalizado.

  ## CONTEXTO DO NEGÓCIO
- O Chef Ferreira é especializado em experiências gastronômicas personalizadas para eventos em Blumenau e região do Vale do Itajaí
  - Serviços: jantares privados, eventos corporativos, casamentos, aniversários, confraternizações, festas temáticas
- Diferencial: cardápio personalizado, atendimento exclusivo, experiência completa e feita sob medida
- O sucesso do atendimento é medido pelo cliente se sentir especial e bem cuidado

## INFORMAÇÕES A COLETAR (de forma natural, não como formulário)
1. Tipo de evento (casamento, aniversário, corporativo, jantar íntimo, etc.)
2. Data prevista do evento
  3. Número aproximado de convidados
4. Local do evento (residência, espaço alugado, clube, etc.)
                    5. Estilo gastronômico desejado (brasileiro, italiano, fusion, frutos do mar, etc.)
  6. Restrições alimentares dos convidados
7. Orçamento aproximado (faixa, sem precisar de valor exato)
8. Como conheceu o Chef Ferreira

## REGRAS DE CONDUTA
- Colete as informações de forma natural e conversacional — máximo 2 perguntas por mensagem
- Não invente preços, valores ou disponibilidade de datas
- Quando tiver coletado informações suficientes (pelo menos tipo, data, nº de convidados e local), informe que vai preparar um resumo para o Chef Ferreira e que ele entrará em contato em breve
- Se o assunto claramente não for sobre eventos ou gastronomia, informe educadamente que o atendimento é focado em eventos e transfira para o Chef
- NUNCA prometa valores ou confirme disponibilidade sem autorização

## GATILHOS DE ESCALADA PARA HUMANO
Use a frase "ESCALAR_PARA_HUMANO" (apenas internamente, não envie ao cliente) quando:
- Já coletou todas as informações principais do evento
  - Cliente pediu explicitamente para falar com o Chef
- Assunto claramente fora do escopo (não é sobre eventos/gastronomia)
  - Cliente demonstra urgência ou frustração que a IA não consegue resolver`;

  // ─────────────────────────────────────────────
  // Busca prompt configurado no banco (se houver)
  // ─────────────────────────────────────────────
  function getSystemPrompt() {
    try {
        const db = getDb();
            const config = db.prepare('SELECT system_prompt FROM agent_config WHERE id = 1').get();
                if (config && config.system_prompt && config.system_prompt.trim().length > 50) {
                      return config.system_prompt;
                          }
                            } catch (_) {
                                // banco ainda não inicializado ou tabela não existe — usa padrão
                                  }
                                    return DEFAULT_SYSTEM_PROMPT;
                                    }

                                    // ─────────────────────────────────────────────
                                    // Detecção de escalada
                                    // ─────────────────────────────────────────────
                                    function detectEscalation(reply, userMessage) {
                                      // Gatilho explícito inserido pelo próprio prompt
                                        if (reply.includes('ESCALAR_PARA_HUMANO')) return true;

                                          const combined = (reply + ' ' + userMessage).toLowerCase();

                                            const escalationPhrases = [
                                                'vou passar para o chef',
                                                    'chef ferreira vai entrar em contato',
                                                        'transferindo para o chef',
                                                            'atendimento manual',
                                                                'falar com o chef',
                                                                    'chamar o chef',
                                                                        'encaminhar para o chef',
                                                                            'resumo para o chef',
                                                                                'informações suficientes',
                                                                                    'fora do meu escopo',
                                                                                        'não é sobre eventos',
                                                                                          ];

                                                                                            return escalationPhrases.some(phrase => combined.includes(phrase));
                                                                                            }

                                                                                            // ─────────────────────────────────────────────
                                                                                            // Remove marcador interno antes de enviar ao cliente
                                                                                            // ─────────────────────────────────────────────
                                                                                            function cleanReply(text) {
                                                                                              return text.replace(/ESCALAR_PARA_HUMANO/g, '').replace(/\s{2,}/g, ' ').trim();
                                                                                              }

                                                                                              // ─────────────────────────────────────────────
                                                                                              // Função principal — processa mensagem com IA
                                                                                              // ─────────────────────────────────────────────
                                                                                              async function processMessage(conversationId, userMessage, history = []) {
                                                                                                const model   = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
                                                                                                  const systemPrompt = getSystemPrompt();

                                                                                                    // Monta histórico no formato esperado pela API
                                                                                                      const messages = [
                                                                                                          ...history.map(h => ({ role: h.role, content: h.content })),
                                                                                                              { role: 'user', content: userMessage },
                                                                                                                ];
                                                                                                                
                                                                                                                  const response = await groq.chat.completions.create({
                                                                                                                      model,
                                                                                                                          messages: [
                                                                                                                                { role: 'system', content: systemPrompt },
                                                                                                                                      ...messages,
                                                                                                                                          ],
                                                                                                                                              temperature : parseFloat(process.env.AI_TEMPERATURE  || '0.7'),
                                                                                                                                                  max_tokens  : parseInt(process.env.AI_MAX_TOKENS     || '600', 10),
                                                                                                                                                      top_p       : 1,
                                                                                                                                                          stream      : false,
                                                                                                                                                            });
                                                                                                                                                            
                                                                                                                                                              const rawReply    = response.choices[0].message.content || '';
                                                                                                                                                                const shouldEscalate = detectEscalation(rawReply, userMessage);
                                                                                                                                                                  const reply          = cleanReply(rawReply);
                                                                                                                                                                  
                                                                                                                                                                    return {
                                                                                                                                                                        reply,
                                                                                                                                                                            shouldEscalate,
                                                                                                                                                                                model   : response.model,
                                                                                                                                                                                    tokensUsed: response.usage?.total_tokens || 0,
                                                                                                                                                                                        inputTokens : response.usage?.prompt_tokens     || 0,
                                                                                                                                                                                            outputTokens: response.usage?.completion_tokens || 0,
                                                                                                                                                                                              };
                                                                                                                                                                                              }
                                                                                                                                                                                              
                                                                                                                                                                                              // ─────────────────────────────────────────────
                                                                                                                                                                                              // Salva prompt customizado no banco
                                                                                                                                                                                              // ─────────────────────────────────────────────
                                                                                                                                                                                              function saveSystemPrompt(newPrompt) {
                                                                                                                                                                                                const db = getDb();
                                                                                                                                                                                                  const existing = db.prepare('SELECT id FROM agent_config WHERE id = 1').get();
                                                                                                                                                                                                    if (existing) {
                                                                                                                                                                                                        db.prepare(
                                                                                                                                                                                                              'UPDATE agent_config SET system_prompt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1'
                                                                                                                                                                                                                  ).run(newPrompt);
                                                                                                                                                                                                                    } else {
                                                                                                                                                                                                                        db.prepare(
                                                                                                                                                                                                                              'INSERT INTO agent_config (id, system_prompt, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)'
                                                                                                                                                                                                                                  ).run(newPrompt);
                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                    
                                                                                                                                                                                                                                    module.exports = {
                                                                                                                                                                                                                                      processMessage,
                                                                                                                                                                                                                                        getSystemPrompt,
                                                                                                                                                                                                                                          saveSystemPrompt,
                                                                                                                                                                                                                                            DEFAULT_SYSTEM_PROMPT,
                                                                                                                                                                                                                                            };
                                                                                                                                                                                                                                            

## IDENTIDADE E TOM
- Você se identifica como "assistente do Chef Ferreira"
- Tom: amigável, acolhedor, elegante, consultivo, natural e profissional
- Nunca pareça robótico ou como um formulário frio
- Adapte o tom conforme o perfil do cliente
- Demonstre interesse genuíno pelo evento do cliente

## APRESENTAÇÃO INICIAL
"Olá, tudo bem? Eu sou o assistente do Chef Ferreira. Vou te ajudar com as primeiras informações para entendermos melhor o seu evento e preparar uma proposta bem alinhada ao que você precisa."

## OBJETIVO
Realizar uma anamnese comercial completa e acolhedora, coletando informações para que o Chef Ferreira possa elaborar um orçamento personalizado.

## CONTEXTO DO NEGÓCIO
- O Chef Ferreira é especializado em experiências gastronômicas personalizadas para eventos em Blumenau e região do Vale do Itajaí
- Serviços: jantares privados, eventos corporativos, casamentos, aniversários, confraternizações
- Diferencial: experiência personalizada e sob medida

## INFORMAÇÕES A COLETAR
1. Tipo de evento (casamento, aniversário, corporativo, jantar íntimo, etc.)
2. Data prevista
3. Número de convidados
4. Local do evento (próprio, alugado, residência)
5. Estilo gastronômico desejado
6. Restrições alimentares
7. Orçamento aproximado (faixa)
8. Como conheceu o Chef Ferreira

## REGRAS IMPORTANTES
- Colete as informações de forma natural, conversando - não como formulário
- Faça no máximo 2 perguntas por mensagem
- Se o assunto não for sobre eventos/gastronomia, informe que o atendimento é focado em eventos e transfira para o Chef
- Quando tiver informações suficientes, diga que irá preparar a proposta e acione o Chef Ferreira
- NUNCA invente preços ou valores específicos`;

async function processMessage(conversationId, userMessage, history) {
  try {
      const messages = [
            ...history.map(h => ({ role: h.role, content: h.content })),
                  { role: 'user', content: userMessage }
                      ];

                          const response = await groq.chat.completions.create({
                                model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
                                      messages: [
                                              { role: 'system', content: SYSTEM_PROMPT },
                                                      ...messages
                                                            ],
                                                                  temperature: 0.7,
                                                                        max_tokens: 500,
                                                                            });

                                                                                const reply = response.choices[0].message.content;

                                                                                    // Detectar se deve escalar para humano
                                                                                        const shouldEscalate = detectEscalation(reply, userMessage);

                                                                                            return {
                                                                                                  reply,
                                                                                                        shouldEscalate,
                                                                                                              model: response.model,
                                                                                                                    tokensUsed: response.usage?.total_tokens || 0
                                                                                                                        };
                                                                                                                          } catch (error) {
                                                                                                                              console.error('Erro no agente IA:', error);
                                                                                                                                  throw error;
                                                                                                                                    }
                                                                                                                                    }
                                                                                                                                    
                                                                                                                                    function detectEscalation(reply, userMessage) {
                                                                                                                                      const escalationKeywords = [
                                                                                                                                          'transferir', 'chef ferreira', 'atendimento manual',
                                                                                                                                              'proposta preparada', 'entrar em contato diretamente',
                                                                                                                                                  'não é sobre eventos', 'fora do escopo'
                                                                                                                                                    ];
                                                                                                                                                      const combined = (reply + ' ' + userMessage).toLowerCase();
                                                                                                                                                        return escalationKeywords.some(kw => combined.includes(kw));
                                                                                                                                                        }
                                                                                                                                                        
                                                                                                                                                        module.exports = { processMessage, SYSTEM_PROMPT };
