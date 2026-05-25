# ChefBot WhatsApp AI

Sistema completo de atendimento automatizado via WhatsApp com Inteligencia Artificial - Agente virtual para eventos gastronomicos (Chef Ferreira)

## Funcionalidades

- Atendimento automatico via WhatsApp com IA (Groq - GRATUITO)
- - Agente configurado como assistente do Chef Ferreira
  - - Coleta automatica de informacoes do evento (anamnese comercial)
    - - Escalada automatica para atendimento humano quando necessario
      - - Dashboard com visualizacao de conversas em tempo real
        - - Gerenciamento de leads com status
          - - Historico completo de mensagens
            - - WebSocket para atualizacoes em tempo real
              - - Banco de dados SQLite (sem configuracao externa)
               
                - ## Tecnologias
               
                - - Backend: Node.js + Express
                  - - IA: Groq API (LLaMA 3.3 70B - GRATUITO)
                    - - WhatsApp: Evolution API (open source)
                      - - Banco: SQLite
                        - - Tempo real: WebSocket
                         
                          - ## Como usar
                         
                          - ### 1. Clonar o repositorio
                         
                          - git clone https://github.com/Bruna-BM93/chefbot-whatsapp-ai.git
                          - cd chefbot-whatsapp-ai
                         
                          - ### 2. Configurar variaveis de ambiente
                         
                          - cp .env.example .env
                         
                          - Edite o arquivo .env e preencha:
                          - - GROQ_API_KEY: Obtenha gratuitamente em https://console.groq.com
                            - - EVOLUTION_API_URL: URL da sua Evolution API
                              - - EVOLUTION_API_KEY: Chave da Evolution API
                                - - EVOLUTION_INSTANCE: Nome da instancia WhatsApp
                                 
                                  - ### 3. Instalar dependencias
                                 
                                  - cd backend
                                  - npm install
                                 
                                  - ### 4. Iniciar o backend
                                 
                                  - npm run dev
                                 
                                  - O servidor inicia na porta 4000.
                                 
                                  - ### 5. Configurar webhook na Evolution API
                                 
                                  - No painel da Evolution API, configure o webhook para:
                                  - http://SEU_IP:4000/api/webhook
                                 
                                  - ### Obter chave Groq gratuita
                                 
                                  - 1. Acesse https://console.groq.com
                                    2. 2. Crie uma conta gratuita
                                       3. 3. Va em API Keys e gere uma chave
                                          4. 4. Cole no .env em GROQ_API_KEY
                                             5. 5. Limite gratuito: 14.400 requisicoes por dia
                                               
                                                6. ### Configurar Evolution API (WhatsApp)
                                               
                                                7. 1. Instale via Docker: docker run -d -p 8080:8080 atendai/evolution-api
                                                   2. 2. Acesse http://localhost:8080
                                                      3. 3. Crie uma instancia e escaneie o QR Code com seu WhatsApp
                                                         4. 4. Copie a API Key e configure no .env
                                                           
                                                            5. ## Estrutura do Projeto
                                                           
                                                            6. chefbot-whatsapp-ai/
                                                            7.   backend/
                                                            8.       src/
                                                            9.         index.js        - Servidor principal
                                                            10.           agent.js        - Logica do agente IA (prompt Chef Ferreira)
                                                            11.             database.js     - Banco de dados SQLite
                                                            12.               routes/
                                                            13.                   webhook.js    - Recebe mensagens do WhatsApp
                                                            14.                       conversations.js
                                                            15.                           messages.js
                                                            16.                               leads.js
                                                            17.                                   dashboard.js
                                                            18.                                 .env.example        - Modelo de configuracao
                                                            19.                               README.md
                                                           
                                                            20.                           ## Arquitetura
                                                           
                                                            21.                       WhatsApp -> Evolution API -> Webhook (/api/webhook) -> Agente IA (Groq) -> Resposta -> WhatsApp
                                                           
                                                            22.                   ## Escalada para Humano
                                                           
                                                            23.               O agente detecta automaticamente quando deve transferir para o Chef Ferreira:
                                                            24.           - Quando as informacoes do evento ja foram coletadas
                                                            25.       - Quando o cliente pede para falar com o Chef
                                                            26.   - Quando o assunto nao e sobre eventos gastronomicos
                                                               
                                                                  - ## Modelos de IA Disponiveis (Groq - Gratuitos)
                                                               
                                                                  - - llama-3.3-70b-versatile (recomendado - melhor qualidade)
                                                                    - - llama-3.1-8b-instant (mais rapido - menor custo)
                                                                      - - mixtral-8x7b-32768 (bom equilibrio)
                                                                       
                                                                        - ## Suporte
                                                                       
                                                                        - Repositorio: https://github.com/Bruna-BM93/chefbot-whatsapp-ai
