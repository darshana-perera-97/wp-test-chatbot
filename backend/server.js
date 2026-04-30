const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN; // Your custom string
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Basic API health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// 1. Webhook Verification (Meta calls this once during setup)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// 2. Message Receiver & Auto-Responder
app.post('/webhook', async (req, res) => {
    const data = req.body;

    if (data.object === 'whatsapp_business_account') {
        const entry = data.entry?.[0];
        const changes = entry?.changes?.[0];
        const message = changes?.value?.messages?.[0];

        if (message && message.type === 'text') {
            const from = message.from; // Sender's phone number
            const text = message.text.body.toLowerCase().trim();

            // Defined Replies Logic
            const replies = {
                "hello": "Hi! Welcome to our automated assistant.",
                "services": "We offer Web Dev, IoT Prototyping, and Digital Marketing.",
                "contact": "You can reach us at contact@globeai.info."
            };

            const replyText = replies[text] || "Sorry, I only understand 'hello', 'services', or 'contact'.";
            
            await sendReply(from, replyText);
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// Function to call the Cloud API
async function sendReply(to, text) {
    try {
        await axios.post(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
            messaging_product: "whatsapp",
            to: to,
            text: { body: text }
        }, {
            headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
        });
    } catch (err) {
        console.error("Error sending message:", err.response?.data || err.message);
    }
}

app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));