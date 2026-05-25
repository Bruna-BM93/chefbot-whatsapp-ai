──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────const express = require('express');
const router  = express.Router();
const { getDb } = require('../database');

// ─────────────────────────────────────────────
// GET /api/dashboard
// Retorna estatísticas gerais do sistema
// ─────────────────────────────────────────────
router.get('/', (req, res) => {
    try {
          const db = getDb();

          // Contagens gerais
          const totalLeads         = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
          const totalConversations = db.prepare('SELECT COUNT(*) as c FROM conversations').get().c;
          const totalMessages      = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
          const activeConversations = db.prepare(
                  'SELECT COUNT(*) as c FROM conversations WHERE status = "ativo"'
                ).get().c;
          const escalatedPending = db.prepare(
                  'SELECT COUNT(*) as c FROM conversations WHERE escalated = 1 AND status = "ativo"'
                ).get().c;

          // Leads por status
          const leadsByStatus = db.prepare(
                  'SELECT status, COUNT(*) as count FROM leads GROUP BY status ORDER BY count DESC'
                ).all();

          // Total de tokens usados (custo IA)
          const tokensRow = db.prepare(
                  'SELECT COALESCE(SUM(tokens_used), 0) as total FROM messages WHERE role = "assistant"'
                ).get();
          const totalTokens = tokensRow.total;

          // Últimas 7 conversas escaladas
          const recentEscalations = db.prepare(`
                                                     SELECT c.id, c.phone, c.created_at, c.updated_at,
                                                            l.name as lead_name
                                                     FROM conversations c
                                                     LEFT JOIN leads l ON c.lead_id = l.id
                                                     WHERE c.escalated = 1
                                                     ORDER BY c.updated_at DESC
                                                     LIMIT 7
                                                   `).all();

                                                   // Mensagens por dia (últimos 7 dias)
                                                   const messagesByDay = db.prepare(`
                                                                                          SELECT DATE(created_at) as day, COUNT(*) as count
                                                                                          FROM messages
                                                                                          WHERE created_at >= DATE('now', '-7 days')
                                                                                          GROUP BY DATE(created_at)
                                                                                          ORDER BY day ASC
                                                                                        `).all();

                                                                                        // Novas leads por dia (últimos 7 dias)
                                                                                        const leadsByDay = db.prepare(`
                                                                                                                            SELECT DATE(created_at) as day, COUNT(*) as count
                                                                                                                            FROM leads
                                                                                                                            WHERE created_at >= DATE('now', '-7 days')
                                                                                                                            GROUP BY DATE(created_at)
                                                                                                                            ORDER BY day ASC
                                                                                                                          `).all();
                                                                                                                      
                                                                                                                          // Conversas ativas com última mensagem
                                                                                                                          const activeChats = db.prepare(`
                                                                                                                                                               SELECT c.id, c.phone, c.ai_enabled, c.escalated, c.updated_at,
                                                                                                                                                                      l.name as lead_name,
                                                                                                                                                                      (SELECT content FROM messages WHERE conversation_id = c.id
                                                                                                                                                                                     ORDER BY created_at DESC LIMIT 1) as last_message
                                                                                                                                                               FROM conversations c
                                                                                                                                                               LEFT JOIN leads l ON c.lead_id = l.id
                                                                                                                                                               WHERE c.status = "ativo"
                                                                                                                                                               ORDER BY c.updated_at DESC
                                                                                                                                                               LIMIT 10
                                                                                                                                                             `).all();
                                                                                                                                                         
                                                                                                                                                             res.json({
                                                                                                                                                                     summary: {
                                                                                                                                                                               totalLeads,
                                                                                                                                                                               totalConversations,
                                                                                                                                                                               totalMessages,
                                                                                                                                                                               activeConversations,
                                                                                                                                                                               escalatedPending,
                                                                                                                                                                               totalTokens,
                                                                                                                                                                     },
                                                                                                                                                                             leadsByStatus,
                                                                                                                                                                     recentEscalations,
                                                                                                                                                                     messagesByDay,
                                                                                                                                                                     leadsByDay,
                                                                                                                                                                     activeChats,
                                                                                                                                                             });
                                                                                                                                                         } catch (err) {
                                                                                                                                                               console.error('[dashboard] GET /', err.message);
                                                                                                                                                               res.status(500).json({ error: err.message });
                                                                                                                                                         }
                                                                                                                                                         });
                                                                                                                      
                                                                                                                      // ─────────────────────────────────────────────
                                                                                                                      // GET /api/dashboard/health
                                                                                                                      // Health check do sistema
                                                                                                                      // ─────────────────────────────────────────────
                                                                                                                      router.get('/health', (req, res) => {
                                                                                                                          try {
                                                                                                                                const db = getDb();
                                                                                                                                db.prepare('SELECT 1').get(); // testa conexao com banco
                                                                                                                                res.json({
                                                                                                                                        status   : 'ok',
                                                                                                                                        timestamp: new Date().toISOString(),
                                                                                                                                        uptime   : process.uptime(),
                                                                                                                                        memory   : process.memoryUsage(),
                                                                                                                                        env: {
                                                                                                                                                  groqConfigured     : !!process.env.GROQ_API_KEY,
                                                                                                                                                  evolutionConfigured: !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY),
                                                                                                                                                  model              : process.env.AI_MODEL || 'llama-3.3-70b-versatile',
                                                                                                                                        },
                                                                                                                                });
                                                                                                                          } catch (err) {
                                                                                                                                res.status(500).json({ status: 'error', error: err.message });
                                                                                                                          }
                                                                                                                      });
                                                                                                                      
                                                                                                                      module.exports = router;
                                                                                                                      
