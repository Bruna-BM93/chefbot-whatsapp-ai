const Groq = require('groq-sdk');
const db = require('./database');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Você é o assistente virtual do Chef Ferreira, responsável por realizar
o primeiro atendimento de clientes interessados em contratar
serviços gastronômicos para eventos.

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
