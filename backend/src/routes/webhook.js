const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { processMessage } = require('../agent');
const { getDb } = require('../database');
const axios = require('axios');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Normaliza número de telefone para formato puro (apenas dígitos).
 * Lida com variações do 9º dígito do Brasil.
 * Ex: "5547999999999@s.whatsapp.net" → "5547999999999"
 */
function normalizePhone(raw) {
      if (!raw) return null;
      return raw.replace('@s.whatsapp.net', '').replace(/\D/g, '');
}

/**
 * Extrai o texto de uma mensagem do Evolution API.
 * Suporta: texto simples, extended text, lista, botão, template.
 */
function extractText(message) {
      if (!message) return '';
      return (
              message.conversation ||
              message.extendedTextMessage?.text ||
              message.listResponseMessage?.singleSelectReply?.selectedRowId ||
              message.buttonsResponseMessage?.selectedButtonId ||
              message.templateButtonReplyMessage?.selectedId ||
              ''
            );
}

/**
 * Envia resposta de texto via Evolution API.
 */
async function sendReply(phone, text) {
      const { EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE } = process.env;
      if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
              console.warn('[webhook] Variáveis Evolution API não configuradas — resposta não enviada.');
              return;
      }
      try {
              await axios.post(
                        `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
                  { number: phone, text },
                  {
                              headers: {
                                            apikey: EVOLUTION_API_KEY,
                                            'Content-Type': 'application/json',
                              },
                              timeout: 10000,
                  }
                      );
      } catch (err) {
              console.error('[webhook] Erro ao enviar resposta:', err.response?.data || err.message);
      }
}

// ─────────────────────────────────────────────
// POST / — recebe eventos da Evolution API
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
      // Responde imediatamente para não bloquear o webhook
              res.json({ status: 'received' });

              try {
                      const body = req.body;

        // A Evolution API envia { event, data } ou { event, data: { messages: [...] } }
        const event = body.event || body.type || '';
                      const data  = body.data || body;

        // Só processa eventos de mensagens recebidas
        const validEvents = ['messages.upsert', 'MESSAGES_UPSERT', 'message'];
                      if (!validEvents.some(e => event.toLowerCase().includes(e.toLowerCase().replace('.', '')))) {
                                return;
                      }

        // Suporte a payload único ou array de mensagens
        const messages = Array.isArray(data.messages)
                        ? data.messages
                  : data.message
                          ? [data]
                    : [];

        for (const msgData of messages) {
                  const msg = msgData.message || msgData;

                        // Ignora mensagens enviadas por nós mesmos
                        if (msgData.key?.fromMe || msg.key?.fromMe) continue;

                        const phone = normalizePhone(msgData.key?.remoteJid || msg.key?.remoteJid);
                  const text  = extractText(msg).trim();

                        if (!phone || !text) continue;

                        console.log(`[webhook] Mensagem recebida de ${phone}: "${text.substring(0, 80)}"`);

                        await handleIncomingMessage(phone, text);
        }
              } catch (err) {
                      console.error('[webhook] Erro ao processar evento:', err.message);
              }
});

// ─────────────────────────────────────────────
// Lógica principal de atendimento
// ─────────────────────────────────────────────
async function handleIncomingMessage(phone, text) {
      const db = getDb();

  // 1. Busca ou cria lead
  let lead = db.prepare('SELECT * FROM leads WHERE phone = ?').get(phone);
      if (!lead) {
              const leadId = uuidv4();
              db.prepare(
                        'INSERT INTO leads (id, phone, status, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
                      ).run(leadId, phone, 'novo');
              lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
              console.log(`[webhook] Novo lead criado: ${phone}`);
      }

  // 2. Busca ou cria conversa ativa
  let conv = db.prepare(
          'SELECT * FROM conversations WHERE phone = ? AND status = "ativo" ORDER BY created_at DESC LIMIT 1'
        ).get(phone);

  if (!conv) {
          const convId = uuidv4();
          db.prepare(
                    'INSERT INTO conversations (id, lead_id, phone, status, ai_enabled, escalated, created_at, updated_at) VALUES (?, ?, ?, "ativo", 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
                  ).run(convId, lead.id, phone);
          conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
          console.log(`[webhook] Nova conversa criada para ${phone}`);
  }

  // 3. Salva mensagem do usuário
  db.prepare(
          'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, "user", ?, CURRENT_TIMESTAMP)'
        ).run(uuidv4(), conv.id, text);

  // 4. Atualiza timestamp da conversa
  db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conv.id);

  // Broadcast para o dashboard em tempo real
  if (global.broadcast) {
          global.broadcast({ type: 'new_message', conversationId: conv.id, phone, role: 'user', content: text });
  }

  // 5. Se IA desativada (atendimento humano assumiu), apenas registra
  if (!conv.ai_enabled) {
          console.log(`[webhook] IA desativada para ${phone} — mensagem registrada sem resposta automática`);
          return;
  }

  // 6. Busca histórico da conversa (últimas 20 mensagens para contexto)
  const history = db.prepare(
          'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 20'
        ).all(conv.id);

  // Retira a última mensagem (que acabamos de inserir) para não duplicar no contexto
  const historyWithoutLast = history.slice(0, -1);

  // 7. Processa com a IA
  let aiResult;
      try {
              aiResult = await processMessage(conv.id, text, historyWithoutLast);
      } catch (err) {
              console.error('[webhook] Erro na IA:', err.message);
              // Em caso de erro na IA, envia mensagem de fallback
        const fallback = 'Desculpe, tive um problema técnico. Por favor, tente novamente em instantes.';
              await sendReply(phone, fallback);
              db.prepare(
                        'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, "assistant", ?, CURRENT_TIMESTAMP)'
                      ).run(uuidv4(), conv.id, fallback);
              return;
      }

  const { reply, shouldEscalate, tokensUsed, model } = aiResult;

  // 8. Salva resposta da IA
  db.prepare(
          'INSERT INTO messages (id, conversation_id, role, content, tokens_used, model, created_at) VALUES (?, ?, "assistant", ?, ?, ?, CURRENT_TIMESTAMP)'
        ).run(uuidv4(), conv.id, reply, tokensUsed || 0, model || '');

  // 9. Trata escalada para atendimento humano
  if (shouldEscalate) {
          db.prepare(
                    'UPDATE conversations SET escalated = 1, ai_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
                  ).run(conv.id);
          db.prepare(
                    'UPDATE leads SET status = "qualificado", updated_at = CURRENT_TIMESTAMP WHERE id = ?'
                  ).run(lead.id);
          console.log(`[webhook] Escalada ativada para ${phone} — IA desativada, aguardando humano`);

        if (global.broadcast) {
                  global.broadcast({
                              type: 'escalation',
                              conversationId: conv.id,
                              phone,
                              leadId: lead.id,
                              reason: 'Dados coletados pelo agente — transferir para Chef Ferreira',
                  });
        }
  }

  // 10. Envia resposta via Evolution API
  await sendReply(phone, reply);

  // Broadcast da resposta da IA
  if (global.broadcast) {
          global.broadcast({ type: 'new_message', conversationId: conv.id, phone, role: 'assistant', content: reply });
  }

  console.log(`[webhook] Resposta enviada para ${phone} (${tokensUsed} tokens, escalada: ${shouldEscalate})`);
}

module.exports = router;
