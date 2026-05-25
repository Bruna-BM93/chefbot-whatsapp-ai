require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const WebSocket = require('ws');

const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ server });

// Middlewares
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(morgan('dev'));

// Database
const db = require('./database');
db.init();

// Routes
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/dashboard', require('./routes/dashboard'));

// WebSocket - broadcast para clientes conectados
wss.on('connection', (ws) => {
  console.log('Cliente WebSocket conectado');
    ws.on('close', () => console.log('Cliente WebSocket desconectado'));
    });

    global.broadcast = (data) => {
      wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
                    }
                      });
                      };

                      const PORT = process.env.PORT || 4000;
                      server.listen(PORT, () => {
                        console.log(`ChefBot Backend rodando na porta ${PORT}`);
                        });
