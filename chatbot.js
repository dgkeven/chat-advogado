// Importação dos módulos necessários
const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs'); // Módulo para interagir com o sistema de arquivos

// --- CONFIGURAÇÃO DO SERVIDOR EXPRESS ---
const app = express();
const PORT = process.env.PORT || 5002;
const SESSIONS_FILE = './sessions.json'; // Arquivo para persistir o estado das conversas

let qrCodeString = null;

// --- GERENCIAMENTO DE ESTADO (MEMÓRIA DO BOT) ---
let conversas = {};
try {
    if (fs.existsSync(SESSIONS_FILE)) {
        const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        conversas = JSON.parse(data);
        console.log('✅ Sessões de conversa carregadas do arquivo.');
    }
} catch (error) {
    console.error('⚠️ Erro ao carregar o arquivo de sessões. Iniciando com memória vazia.', error);
    conversas = {};
}

// --- FUNÇÃO DE SALVAMENTO SÍNCRONA (MAIS ROBUSTA) ---
function saveConversations() {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(conversas, null, 2));
    } catch (err) {
        console.error('❌ Erro CRÍTICO ao salvar as sessões no arquivo:', err);
    }
}

// --- CONTROLE DE MENSAGENS DUPLICADAS ---
const processedMessages = new Set();
setInterval(() => {
    processedMessages.clear();
}, 60000); // Limpa o cache a cada 1 minuto

// --- ROTAS DO SERVIDOR EXPRESS ---
app.get('/', (req, res) => {
    res.send('Bot WhatsApp - Jonathan Berleze Advocacia rodando!');
});

app.get('/qrcode', async (req, res) => {
    if (!qrCodeString) {
        return res.send('QR Code ainda não gerado. Aguarde a inicialização do bot e atualize a página.');
    }
    try {
        const qrImage = await qrcode.toDataURL(qrCodeString);
        const html = `
            <html>
                <head>
                    <title>QR Code WhatsApp</title>
                    <style>
                        body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; font-family: Arial, sans-serif; }
                        .container { text-align: center; padding: 40px; background-color: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                        h2 { color: #333; }
                        img { margin-top: 20px; border: 1px solid #ddd; padding: 5px; border-radius: 8px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Escaneie o QR Code para autenticar</h2>
                        <img src="${qrImage}" alt="QR Code do WhatsApp" />
                    </div>
                </body>
            </html>
        `;
        res.send(html);
    } catch (err) {
        console.error('Erro ao gerar imagem do QR Code:', err);
        res.status(500).send('Erro ao gerar imagem do QR Code');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}. Acesse /qrcode para ver o QR Code.`);
});


// --- CONFIGURAÇÃO DO CLIENTE WHATSAPP ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
            '--disable-extensions', '--disable-gpu', '--disable-software-rasterizer',
            '--single-process'
        ],
    }
});

// --- EVENTOS DO CLIENTE WHATSAPP ---
client.on('qr', qr => {
    qrCodeString = qr;
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot está pronto e conectado! ✅');
});

// NOVO EVENTO: Captura mensagens criadas (enviadas pela conta do bot)
client.on('message_create', async msg => {
    // Processa apenas as mensagens enviadas PELA CONTA DO BOT
    if (!msg.fromMe) {
        return;
    }

    try {
        const chatId = msg.to; // Para mensagens enviadas, o chat é o destino 'to'
        const texto = msg.body.trim().toLowerCase();

        // Filtros básicos
        if (chatId.includes('@g.us')) return;

        await handleOwnerMessage(chatId, texto);
    } catch (error) {
        console.error(`❌ Erro crítico em 'message_create' para ${msg.to}:`, error);
    }
});


// EVENTO EXISTENTE: Captura mensagens recebidas de clientes
client.on('message', async msg => {
    try {
        const chatId = msg.from;
        const texto = msg.body.trim().toLowerCase();
        const msgId = msg.id._serialized;

        // --- FILTROS APRIMORADOS ---
        if (processedMessages.has(msgId)) return;
        if (chatId === 'status@broadcast' || msg.type !== 'chat') return;
        if (chatId.includes('@g.us')) return;

        processedMessages.add(msgId);

        // Esta função agora só lida com mensagens de clientes
        await handleClientMessage(chatId, texto, msg);

    } catch (error) {
        console.error(`❌ Erro crítico em 'message' para ${msg.from}:`, error);
    }
});

// --- LÓGICA DE MANIPULAÇÃO DE MENSAGENS ---

/**
 * @description Chamada quando você, usando a conta do bot, envia uma mensagem.
 */
async function handleOwnerMessage(chatId, texto) {
    let conversation = conversas[chatId];
    console.log(`[DONO/BOT] Mensagem da conta do bot para ${chatId}. Status atual: ${conversation?.status || 'Nenhum'}`);

    // Comando para reativar o bot para um cliente
    if (texto === 'automatico' || texto === 'encerrar') {
        if (conversation) {
            delete conversas[chatId];
            saveConversations();
            console.log(`[DONO/BOT] 🤖 Atendimento automático REATIVADO para ${chatId}.`);
        }
        return;
    }

    // Se a conversa era automática, a sua intervenção a torna manual.
    if (conversation && conversation.status === 'automated') {
        conversation.status = 'manual';
        saveConversations();
        console.log(`[DONO/BOT] Intervenção! Status para ${chatId} agora é MANUAL.`);
    } else if (!conversation) {
        // Se você inicia uma conversa, ela já começa como manual.
        conversas[chatId] = { status: 'manual' };
        saveConversations();
        console.log(`[DONO/BOT] Nova conversa iniciada. Status definido para MANUAL.`);
    }
}

/**
 * @description Chamada quando um cliente envia uma mensagem.
 */
async function handleClientMessage(chatId, texto, msg) {
    let conversation = conversas[chatId];
    console.log(`[CLIENTE] Mensagem de ${chatId}. Status da conversa: ${conversation?.status || 'Nenhum'}`);

    // Se a conversa está em modo manual ou sendo processada, o bot não faz nada.
    if (conversation && (conversation.status === 'manual' || conversation.status === 'processing')) {
        console.log(`[CLIENTE] Conversa em modo ${conversation.status}. Ignorando.`);
        return;
    }

    // Se é o primeiro contato do cliente, inicia o atendimento automático.
    if (!conversation) {
        try {
            // "Tranca" a conversa na memória para evitar respostas duplicadas
            conversas[chatId] = { status: 'processing' };

            console.log(`[CLIENTE] Nova conversa. Iniciando atendimento para ${chatId}.`);
            await client.sendMessage(chatId, `Olá, espero que esteja bem! 🙋‍♂️
Obrigado por entrar em contato com o escritório *Jonathan Berleze Advocacia*.  
Estamos prontos para ajudá-lo(a) com suas necessidades jurídicas.  

Selecione uma das opções abaixo:  

1️⃣ Saber o andamento do meu processo  
2️⃣ Qual valor da consulta?  
3️⃣ Agendar horário de atendimento  
4️⃣ Conversar com secretaria  

❌ Envie "encerrar" a qualquer momento para finalizar o atendimento.`);

            // Atualiza para o status final e salva permanentemente.
            conversas[chatId] = { status: 'automated', etapa: 1, secretaria: 'jonathan' };
            saveConversations();

        } catch (err) {
            console.error(`[CLIENTE] Erro ao iniciar nova conversa com ${chatId}.`, err);
            delete conversas[chatId]; // Limpa em caso de erro
            saveConversations();
        }
        return;
    }

    // Se o cliente digita "encerrar", finaliza o atendimento.
    if (texto === 'encerrar') {
        delete conversas[chatId];
        saveConversations();
        await client.sendMessage(chatId, '❌ Atendimento encerrado. Estamos à disposição sempre que precisar.');
        return;
    }

    // Continua o fluxo normal da conversa.
    await processarFluxoConversa(chatId, texto, msg);
}

/**
 * @description Conduz o usuário através das etapas da conversa automática.
 */
async function processarFluxoConversa(chatId, texto, msg) {
    let conversation = conversas[chatId];
    if (!conversation || conversation.status !== 'automated') return;

    if (texto === '@ingrid' && conversation.secretaria === 'jonathan') {
        conversation.secretaria = 'ingrid';
        conversation.etapa = 4;
        await client.sendMessage(chatId, `👩 *Ingrid (Secretária)*: Oi, tudo bem? Assumindo seu atendimento agora. Como posso te ajudar?`);
    } else if (texto === '@jonathan' && conversation.secretaria === 'ingrid') {
        conversation.secretaria = 'jonathan';
        conversation.etapa = 1;
        await client.sendMessage(chatId, `🙋‍♂️ *Dr. Jonathan*: Estou assumindo novamente seu atendimento.`);
    } else if (texto === 'menu') {
        await client.sendMessage(chatId, `Selecione uma das opções abaixo:  

1️⃣ Saber o andamento do meu processo  
2️⃣ Qual valor da consulta?  
3️⃣ Agendar horário de atendimento  
4️⃣ Conversar com secretaria`);
        conversation.etapa = 1;
    } else {
        switch (conversation.etapa) {
            case 1:
                if (texto === '1') {
                    await client.sendMessage(chatId, `📂 *Dr. Jonathan*: Para consultar o andamento do seu processo, por favor me informe o *número do processo* ou o *nome completo do titular*.`);
                    conversation.etapa = 2;
                } else if (texto === '2') {
                    await client.sendMessage(chatId, `💰 *Dr. Jonathan*: O valor da consulta é de R$ 300,00, com duração média de 1 hora. No atendimento, avaliarei sua situação jurídica e darei as orientações necessárias. \n\nDeseja mais alguma informação? Digite *menu* para voltar ou *encerrar* para finalizar.`);
                } else if (texto === '3') {
                    await client.sendMessage(chatId, `📅 *Dr. Jonathan*: Para agendar um atendimento, por favor, informe sua disponibilidade de dias e horários.`);
                    conversation.etapa = 3;
                } else if (texto === '4') {
                    // Erro de digitação corrigido aqui: catId -> chatId
                    await client.sendMessage(chatId, `👩 *Ingrid (Secretária)*: Olá, eu sou Ingrid, secretária do Dr. Jonathan. Para que eu possa melhor auxiliar, me diga em que posso te ajudar?`);
                    conversation.etapa = 4;
                    conversation.secretaria = 'ingrid';
                }
                break;
            case 2:
                await client.sendMessage(chatId, `🔎 *Dr. Jonathan*: Obrigado pelas informações. Em breve retornarei com o andamento atualizado do processo. \n\nDeseja mais alguma informação? Digite *menu* para voltar ou *encerrar* para finalizar.`);
                conversation.etapa = 1;
                break;
            case 3:
                await client.sendMessage(chatId, `📌 *Dr. Jonathan*: Obrigado! Recebi sua disponibilidade e entrarei em contato para confirmar o agendamento. \n\nDeseja mais alguma informação? Digite *menu* para voltar ou *encerrar* para finalizar.`);
                conversation.etapa = 1;
                break;
            case 4:
                await client.sendMessage(chatId, `👩 *Ingrid (Secretária)*: Entendido! Já estou verificando para poder te ajudar da melhor forma. \n\nDeseja mais alguma informação? Digite *menu* para voltar ou *encerrar* para finalizar.`);
                conversation.etapa = 1;
                break;
        }
    }
    saveConversations();
}

// --- INICIALIZAÇÃO DO BOT ---
client.initialize().catch(err => {
    console.error("❌ Erro na inicialização do cliente:", err);
});
