const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { processMessage } = require('../agent');
const { getDb } = require('../database');
const axios = require('axios');

// Webhook recebe mensagens da Evolution API / WhatsApp
router.post('/', async (req, res) => {
    try {
          const { data, event } = req.body;

          if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
                  return res.json({ status: 'ignored' });
                }

          const message = data?.message || data?.messages?.[0];
          if (!message || message.key?.fromMe) return res.json({ status: 'ignored' });

          const phone = message.key?.remoteJid?.replace('@s.whatsapp.net', '') || 
                        message.key?.remoteJid;
          const text = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || '';

          if (!phone || !text) return res.json({ status: 'no-text' });

          const db = getDb();

          // Buscar ou criar lead
          let lead = db.prepare('SELECT * FROM leads WHERE phone = ?').get(phone);
          if (!lead) {
                  const leadId = uuidv4();
                  db.prepare('INSERT INTO leads (id, phone, status) VALUES (?, ?, ?)').run(leadId, phone, 'novo');
                  lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
                }

          // Buscar ou criar conversa
          let conv = db.prepare('SELECT * FROM conversations WHERE phone = ? AND status = "ativo"').get(phone);
          if (!conv) {
                  const convId = uuidv4();
                  db.prepare('INSERT INTO conversations (id, lead_id, phone) VALUES (?, ?, ?)').run(convId, lead.id, phone);
                  conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
                }

          // Salvar mensagem do usuário
          db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)')
            .run(uuidv4(), conv.id, 'user', text);

          // Se IA desativada, apenas registra
          if (!conv.ai_enabled) {
                  global.broadcast({ type: 'new_message', conversationId: conv.id, phone, role: 'user', content: text });
                  return res.json({ status: 'ai-disabled' });
                }

          // Buscar histórico
          const history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 20').all(conv.id);

          // Processar com IA
          const { reply, shouldEscalate, tokensUsed, model } = await processMessage(conv.id, text, history.slice(0, -1));

          // Salvar resposta da IA
          db.prepare('INSERT INTO messages (id, conversation_id, role, content, tokens_used, model) VALUES (?, ?, ?, ?, ?, ?)')
            .run(uuidv4(), conv.id, 'assistant', reply, tokensUsed, model);

          // Escalada para humano
          if (shouldEscalate) {
                  db.prepare('UPDATE conversations SET escalated = 1, ai_enabled = 0 WHERE id = ?').run(conv.id);
                  db.prepare('UPDATE leads SET status = "qualificado" WHERE id = ?').run(lead.id);
                  global.broadcast({ type: 'escalation', conversationId: conv.id, phone, reason: 'Dados coletados - transferir para Chef' });
                }

          // Enviar resposta via Evolution API
          if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) {
                  await axios.post(`${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
                            number: phone,
                            text: reply
                          }, {
                            headers: { 'apikey': process.env.EVOLUTION_API_KEY }
                          });
                }

          global.broadcast({ type: 'new_message', conversationId: conv.id, phone, role: 'assistant', content: reply });
          res.json({ status: 'ok', reply });

        } catch (error) {
          console.error('Erro no webhook:', error);
          res.status(500).json({ error: error.message });
        }
  });

module.exports = router;
