const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const moment = require('moment-timezone');
const fs = require('fs'); // Módulo para interagir com arquivos

const app = express();
const PORT = process.env.PORT || 5002;
const SESSIONS_FILE = './sessions.json'; // Arquivo que guardará a memória do bot

let qrCodeString = null;

// Carrega as conversas salvas do arquivo, se ele existir
let conversas = {};
try {
    if (fs.existsSync(SESSIONS_FILE)) {
        const data = fs.readFileSync(SESSIONS_FILE);
        conversas = JSON.parse(data);
        console.log('Sessões de conversa carregadas com sucesso.');
    }
} catch (error) {
    console.error('Erro ao carregar o arquivo de sessões:', error);
    conversas = {};
}

// Função para salvar o estado das conversas no arquivo
function saveConversations() {
    fs.writeFile(SESSIONS_FILE, JSON.stringify(conversas, null, 2), (err) => {
        if (err) {
            console.error('Erro ao salvar as sessões:', err);
        }
    });
}

app.get('/', (req, res) => {
    res.send('Bot WhatsApp - Jonathan Berleze Advocacia rodando!');
});

app.get('/qrcode', async (req, res) => {
    if (!qrCodeString) {
        return res.send('QR Code ainda não gerado. Aguarde o bot inicializar.');
    }
    try {
        const qrImage = await qrcode.toDataURL(qrCodeString);
        const html = `
            <html>
                <body style="text-align:center; font-family:sans-serif">
                    <h2>Escaneie o QR Code abaixo para autenticar no WhatsApp</h2>
                    <img src="${qrImage}" />
                </body>
            </html>
        `;
        res.send(html);
    } catch (err) {
        res.status(500).send('Erro ao gerar imagem do QR Code');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--single-process'
        ],
    }
});

client.on('qr', qr => {
    qrCodeString = qr;
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot está pronto! ✅');
});

client.on('message', async msg => {
    const chatId = msg.fromMe ? msg.to : msg.from;
    const texto = msg.body.trim().toLowerCase();

    if (chatId.includes('@g.us')) return;

    let conversation = conversas[chatId];

    if (!conversation) {
        if (msg.fromMe) {
            console.log(`Conversa com ${chatId} iniciada por você. Status: MANUAL.`);
            conversas[chatId] = { status: 'manual' };
            saveConversations(); // Salva a alteração na memória
            return;
        } else {
            console.log(`Nova conversa com ${chatId} iniciada pelo cliente. Status: AUTOMÁTICO.`);
            client.sendMessage(chatId, `Olá, espero que esteja bem! 🙋‍♂️
Obrigado por entrar em contato com o escritório *Jonathan Berleze Advocacia*.  
Estamos prontos para ajudá-lo(a) com suas necessidades jurídicas.  

Selecione uma das opções abaixo:  

1️⃣ Saber o andamento do meu processo  
2️⃣ Qual valor da consulta?  
3️⃣ Agendar horário de atendimento  
4️⃣ Conversar com secretaria  

❌ Envie "encerrar" a qualquer momento para finalizar o atendimento.`);
            conversas[chatId] = { status: 'automated', etapa: 1, secretaria: 'jonathan' };
            saveConversations(); // Salva a alteração na memória
            return;
        }
    }

    if (texto === 'manual') {
        conversation.status = 'manual';
        saveConversations(); // Salva a alteração
        return client.sendMessage(chatId, '🤖 Atendimento automático desativado. Agora está em modo manual.');
    }
    if (texto === 'encerrar') {
        delete conversas[chatId]; // Deleta a conversa da memória
        saveConversations(); // Salva a remoção
        if (conversation.status === 'manual') {
            return client.sendMessage(chatId, '✅ Atendimento automático reativado. Conte comigo!');
        } else {
            return client.sendMessage(chatId, '❌ Atendimento encerrado. Estamos à disposição sempre que precisar.');
        }
    }

    if (conversation.status === 'manual') {
        return;
    }

    if (texto === '@ingrid' && conversation.secretaria === 'jonathan') {
        conversation.secretaria = 'ingrid';
        conversation.etapa = 4;
        saveConversations();
        return client.sendMessage(chatId, `👩 *Ingrid (Secretária)*: Oi, tudo bem? Assumindo seu atendimento agora. Como posso te ajudar?`);
    }
    if (texto === '@jonathan' && conversation.secretaria === 'ingrid') {
        conversation.secretaria = 'jonathan';
        conversation.etapa = 1;
        saveConversations();
        return client.sendMessage(chatId, `🙋‍♂️ *Dr. Jonathan*: Estou assumindo novamente seu atendimento.`);
    }

    if (texto === 'menu') {
        client.sendMessage(chatId, `📋 Menu de opções: ...`); // (Menu completo omitido por brevidade)
        conversation.etapa = 1;
        saveConversations();
        return;
    }

    const etapa = conversation.etapa;
    switch (etapa) {
        // (Lógica do switch/case permanece a mesma, mas com saveConversations() em cada mudança de etapa)
        case 1:
            if (texto === '1') {
                client.sendMessage(chatId, `📂 *Dr. Jonathan*: Para consultar o andamento do seu processo, por favor me informe o *número do processo* ou o *nome completo do titular*.`);
                conversation.etapa = 2;
            } else if (texto === '2') {
                client.sendMessage(chatId, `💰 *Dr. Jonathan*: O valor da consulta é de R$ 300,00, com duração média de 1 hora. No atendimento, avaliarei sua situação jurídica e darei as orientações necessárias.  

Deseja mais alguma informação? Digite *menu* para voltar ou *encerrar* para finalizar.`);
                conversation.etapa = 1;
            } else if (texto === '3') {
                client.sendMessage(chatId, `📅 *Dr. Jonathan*: Para agendar um atendimento, por favor, informe sua disponibilidade de dias e horários.`);
                conversation.etapa = 3;
            } else if (texto === '4') {
                client.sendMessage(chatId, `👩 *Ingrid (Secretária)*: Olá, eu sou Ingrid, secretária do Dr. Jonathan. Para que eu possa melhor auxiliar, me diga em que posso te ajudar?`);
                conversation.etapa = 4;
                conversation.secretaria = 'ingrid';
            }
            break;
        case 2:
            client.sendMessage(chatId, `🔎 *Dr. Jonathan*: Obrigado pelas informações. Em breve retornarei com o andamento atualizado do processo.  

Deseja mais alguma informação? Digite *menu* para voltar ou *encerrar* para finalizar.`);
            conversation.etapa = 1;
            break;
        case 3:
            client.sendMessage(chatId, `📌 *Dr. Jonathan*: Obrigado! Recebi sua disponibilidade e entrarei em contato para confirmar o agendamento.  

Deseja mais alguma informação? Digite *menu* para voltar ou *encerrar* para finalizar.`);
            conversation.etapa = 1;
            break;
        case 4:
            client.sendMessage(chatId, `👩 *Ingrid (Secretária)*: Entendido! Já estou verificando para poder te ajudar da melhor forma.  

Deseja mais alguma informação? Digite *menu* para voltar ou *encerrar* para finalizar.`);
            conversation.etapa = 1;
            break;
    }
    saveConversations(); // Salva qualquer mudança de etapa ocorrida no switch
});

client.initialize();