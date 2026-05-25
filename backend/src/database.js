const Database = require('better-sqlite3');
const path = require('path');

let db;

function init() {
    db = new Database(path.join(__dirname, '../../chefbot.db'));

    db.exec(`
                CREATE TABLE IF NOT EXISTS leads (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        phone TEXT UNIQUE NOT NULL,
                        email TEXT,
                        status TEXT DEFAULT 'novo',
                        event_type TEXT,
                        event_date TEXT,
                        guests INTEGER,
                        budget TEXT,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                      );

                CREATE TABLE IF NOT EXISTS conversations (
                        id TEXT PRIMARY KEY,
                        lead_id TEXT,
                        phone TEXT NOT NULL,
                        status TEXT DEFAULT 'ativo',
                        ai_enabled INTEGER DEFAULT 1,
                        escalated INTEGER DEFAULT 0,
                        escalation_reason TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (lead_id) REFERENCES leads(id)
                      );

                CREATE TABLE IF NOT EXISTS messages (
                        id TEXT PRIMARY KEY,
                        conversation_id TEXT NOT NULL,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        tokens_used INTEGER DEFAULT 0,
                        model TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
                      );

                CREATE TABLE IF NOT EXISTS agent_config (
                        id INTEGER PRIMARY KEY DEFAULT 1,
                        system_prompt TEXT,
                        model TEXT DEFAULT 'llama-3.3-70b-versatile',
                        temperature REAL DEFAULT 0.7,
                        max_tokens INTEGER DEFAULT 500,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                      );
              `);

              console.log('Banco de dados inicializado');
              return db;
            }

            function getDb() {
                if (!db) init();
                return db;
            }

            module.exports = { init, getDb };
