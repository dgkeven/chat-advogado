# Bot WhatsApp - Jonathan Berleze Advocacia

Este é um **bot de atendimento via WhatsApp** desenvolvido com **Node.js** usando a biblioteca [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).  
O bot automatiza respostas de atendimento jurídico, agenda de consultas e transferência de atendentes.

---

## 🔹 Funcionalidades

- Exibição de QR Code para autenticação do WhatsApp Web.
- Atendimento automático fora do horário comercial com mensagem padrão.
- Fluxo de atendimento com múltiplas etapas:
  - Consulta de andamento de processo.
  - Informações sobre valor de consulta.
  - Agendamento de atendimento.
  - Conversa com atendente humano.
- Transferência de atendimento entre dois atendentes (`Jonathan` e `Ingrid`).
- Modo manual de atendimento para desativar respostas automáticas.

---

## 🔹 Pré-requisitos

- [Node.js](https://nodejs.org/) v16 ou superior.
- [npm](https://www.npmjs.com/).
- WhatsApp instalado em um celular para autenticação via QR Code.

---

## 🔹 Instalação

```bash
1. Clone o repositório:

git clone https://github.com/dgkeven/chat-advogado.git
cd chat-advogado
```

````

2. Instale as dependências:

```bash
npm install
```

---

## 🔹 Configuração

- Nenhuma configuração extra é necessária, pois o bot utiliza **LocalAuth**, que salva a sessão do WhatsApp automaticamente.
- Caso seja necessário limpar a sessão, basta deletar a pasta `./.wwebjs_auth`.

---

## 🔹 Execução

1. Inicie o bot:

```bash
node chatbot.js
```

2. Abra o navegador e acesse para verificar status:

```
http://localhost:5002/
```

3. Para acessar o QR Code e autenticar o WhatsApp:

```
http://localhost:5002/qrcode
```

---

## 🔹 Comandos do WhatsApp

- `cancelar` → Encerra o atendimento atual.
- `manual` → Ativa modo manual (desativa respostas automáticas).
- `encerrar` → Desativa modo manual e reativa o bot.
- `@ingrid` → Transfere atendimento para a secretária Ingrid.
- `@jonathan` → Transfere atendimento de volta para Jonathan.

---

## 🔹 Horário de Atendimento

- Segunda a Sexta: **08:00 às 18:00**
- Fora do horário comercial, o bot envia uma mensagem automática informando que o atendimento está indisponível.

---

## 🔹 Estrutura do Código

- `chatbot.js` → Arquivo principal que contém toda a lógica do bot.
- Variáveis globais:

  - `conversas` → Controla a etapa e atendente de cada usuário.
  - `atendimentoManual` → Controla se o usuário está em modo manual.
  - `avisadosForaExpediente` → Controla se o usuário já foi avisado fora do expediente.

---

## 🔹 Tecnologias

- Node.js
- Express.js
- whatsapp-web.js
- qrcode

---

## 🔹 Observações

- Certifique-se de que o computador ou servidor tenha conexão estável com a internet.
- O bot mantém a sessão ativa, portanto não é necessário escanear o QR Code a cada execução.
- Em caso de erros de autenticação, limpe a pasta `./.wwebjs_auth` e escaneie o QR Code novamente.

---

## 🔹 Autor

- **Jonathan Berleze Advocacia**
- Desenvolvedor do bot: Keven Mendes

---

## 🔹 Licença

Este projeto está licenciado sob a MIT License. Consulte o arquivo `LICENSE` para mais detalhes.
````

---
