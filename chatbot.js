const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const moment = require('moment-timezone');

const app = express();
const PORT = process.env.PORT || 5002;

let qrCodeString = null;

app.get('/', (req, res) => {
    res.send('Bot WhatsApp - Jonathan Berleze Advocacia rodando!');
});

// Exibir QR Code
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

// Estruturas de controle
const conversas = {}; // guarda etapa e atendente
const atendimentoManual = {}; // se for ativado o modo manual

client.on('qr', qr => {
    qrCodeString = qr;
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot está pronto! ✅');
});

// Função para verificar se está em horário de expediente
// Segunda a Sexta, das 08:00 às 18:00
function dentroDoExpediente() {
    const agora = moment().tz('America/Sao_Paulo');
    const hora = agora.hour();
    const diaSemana = agora.day(); // 0 = Domingo, 6 = Sábado

    return diaSemana >= 1 && diaSemana <= 5 && hora >= 8 && hora < 18;
}

// Guarda quem já recebeu aviso fora do expediente
const avisadosForaExpediente = {};

client.on('message', async msg => {
    const texto = msg.body.trim().toLowerCase();
    const chatId = msg.from;

    // Ignora grupos
    if (chatId.includes('@g.us')) return;

    // Fora do horário de expediente
    if (!dentroDoExpediente()) {
        // Só envia se ainda não foi avisado
        if (!avisadosForaExpediente[chatId]) {
            avisadosForaExpediente[chatId] = true;
            return client.sendMessage(
                chatId,
                '⏰ Olá! No momento não estamos disponíveis. Nosso horário de atendimento é de *segunda a sexta, das 08h às 18h*.\n\n📞 Caso seja urgente, entre em contato por telefone.'
            );
        }
        return; // já foi avisado, não continua o fluxo
    } else {
        // Se está em expediente, libera para fluxo normal
        // e reseta o controle (para avisar novamente em outro dia)
        if (avisadosForaExpediente[chatId]) {
            delete avisadosForaExpediente[chatId];
        }
    }

    // Ativa/desativa manual
    if (texto === 'manual') {
        atendimentoManual[chatId] = true;
        return client.sendMessage(chatId, '🤖 Atendimento automático desativado. Agora está em modo manual.');
    }
    if (texto === 'encerrar') {
        if (atendimentoManual[chatId]) {
            delete atendimentoManual[chatId];
            return client.sendMessage(chatId, '✅ Atendimento automático reativado. Conte comigo!');
        } else {
            delete conversas[chatId];
            return client.sendMessage(chatId, '❌ Atendimento encerrado. Estamos à disposição sempre que precisar.');
        }
    }

    // Se estiver em modo manual, não responde
    if (atendimentoManual[chatId]) return;

    // 🔄 Transferência de atendente
    if (texto === '@ingrid' && conversas[chatId] && conversas[chatId].atendente === 'jonathan') {
        conversas[chatId].atendente = 'ingrid';
        conversas[chatId].etapa = 4;
        return client.sendMessage(chatId, `👩 *Ingrid (Secretária)*: Oi, tudo bem? Assumindo seu atendimento agora. Como posso te ajudar?`);
    }

    if (texto === '@jonathan' && conversas[chatId] && conversas[chatId].atendente === 'ingrid') {
        conversas[chatId].atendente = 'jonathan';
        conversas[chatId].etapa = 1;
        return client.sendMessage(chatId, `🙋‍♂️ *Dr. Jonathan*: Estou assumindo novamente seu atendimento.`);
    }

    // Se não tem conversa iniciada, envia mensagem inicial
    if (!conversas[chatId]) {
        client.sendMessage(chatId, `Olá, espero que esteja bem! 🙋‍♂️
Obrigado por entrar em contato com o escritório *Jonathan Berleze Advocacia*.  
Estamos prontos para ajudá-lo(a) com suas necessidades jurídicas.  

Selecione uma das opções abaixo:  

1️⃣ Saber o andamento do meu processo  
2️⃣ Qual valor da consulta?  
3️⃣ Agendar horário de atendimento  
4️⃣ Conversar com atendente  

❌ Envie "encerrar" a qualquer momento para finalizar o atendimento.`);
        conversas[chatId] = { etapa: 1, atendente: 'jonathan' };
        return;
    }

    // Reabrir o menu caso cliente peça
    if (texto === 'menu') {
        client.sendMessage(chatId, `📋 Menu de opções:  

1️⃣ Saber o andamento do meu processo  
2️⃣ Qual valor da consulta?  
3️⃣ Agendar horário de atendimento  
4️⃣ Conversar com atendente  

❌ Envie "encerrar" para finalizar o atendimento.`);
        conversas[chatId].etapa = 1;
        return;
    }

    const etapa = conversas[chatId].etapa;
    let atendente = conversas[chatId].atendente;

    switch (etapa) {
        case 1:
            if (texto === '1') {
                client.sendMessage(chatId, `📂 *Dr. Jonathan*: Para consultar o andamento do seu processo, por favor me informe o *número do processo* ou o *nome completo do titular*.`);
                conversas[chatId].etapa = 2;
                atendente = 'jonathan';
            } else if (texto === '2') {
                client.sendMessage(chatId, `💰 *Dr. Jonathan*: O valor da consulta é de R$ 300,00, com duração média de 1 hora. No atendimento, avaliarei sua situação jurídica e darei as orientações necessárias.  

Deseja mais alguma informação? Digite *menu* para voltar ou *encerrar* para finalizar.`);
                conversas[chatId].etapa = 1; // mantém a conversa ativa
            } else if (texto === '3') {
                client.sendMessage(chatId, `📅 *Dr. Jonathan*: Para agendar um atendimento, por favor, informe sua disponibilidade de dias e horários.`);
                conversas[chatId].etapa = 3;
                atendente = 'jonathan';
            } else if (texto === '4') {
                client.sendMessage(chatId, `👩 *Ingrid (Secretária)*: Olá, eu sou Ingrid, secretária do Dr. Jonathan. Para que eu possa melhor auxiliar, me diga em que posso te ajudar?`);
                conversas[chatId].etapa = 4;
                conversas[chatId].atendente = 'ingrid'; // muda para Ingrid
            }
            break;

        case 2: // andamento do processo
            client.sendMessage(chatId, `🔎 *Dr. Jonathan*: Obrigado pelas informações. Em breve retornarei com o andamento atualizado do processo.  

Deseja mais alguma informação? Digite *menu* para voltar ou *encerrar* para finalizar.`);
            conversas[chatId].etapa = 1; // volta pro menu lógico
            break;

        case 3: // agendamento
            client.sendMessage(chatId, `📌 *Dr. Jonathan*: Obrigado! Recebi sua disponibilidade e entrarei em contato para confirmar o agendamento.  

Deseja mais alguma informação? Digite *menu* para voltar ou *encerrar* para finalizar.`);
            conversas[chatId].etapa = 1;
            break;

        case 4: // Ingrid continua atendendo
            client.sendMessage(chatId, `👩 *Ingrid (Secretária)*: Entendido! Já estou verificando para poder te ajudar da melhor forma.  

Deseja mais alguma informação? Digite *menu* para voltar ou *encerrar* para finalizar.`);
            conversas[chatId].etapa = 1;
            break;
    }
});

client.initialize();
