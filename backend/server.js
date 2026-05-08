const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Middleware to capture Raw Body for signature verification
app.use(express.json({
    verify: (req, res, buf) => { req.rawBody = buf; }
}));

const { PORT, VERIFY_TOKEN, APP_SECRET, ACCESS_TOKEN, PHONE_NUMBER_ID } = process.env;
const SERVER_PORT = PORT || 3001;

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

/** 
 * 1. Verification (GET)
 */
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ WEBHOOK_VERIFIED');
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

/** 
 * 2. Message Handler (POST)
 */
app.post('/webhook', async (req, res) => {
    // Signature Verification
    if (APP_SECRET) {
        const signature = req.headers['x-hub-signature-256'];
        const hash = crypto.createHmac('sha256', APP_SECRET).update(req.rawBody).digest('hex');

        if (signature !== `sha256=${hash}`) {
            console.error("❌ Signature mismatch!");
            return res.sendStatus(401);
        }
    }

    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
        // Always respond with 200 OK immediately
        res.status(200).send('EVENT_RECEIVED');

        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (Array.isArray(value?.messages) && value.messages.length > 0) {
            const businessNumber = value.metadata?.display_phone_number || 'unknown';

            for (const message of value.messages) {
                const customerPhone = message.from || 'unknown';
                const messageType = message.type || 'unknown';
                const messageText = message.text?.body || '[non-text message]';
                const customerMsg = message.text?.body?.toLowerCase() || '';

                console.log(
                    `📩 Incoming | to: ${businessNumber} | from: ${customerPhone} | type: ${messageType} | message: ${messageText}`
                );

                // Logic for Auto-Reply
                let replyText = "Hi! I'm your automated assistant. How can I help you today?";

                if (!customerMsg) {
                    replyText = "Thanks for your message! Please send text so I can assist you better.";
                } else if (customerMsg.includes("price") || customerMsg.includes("cost")) {
                    replyText = "Our custom landing pages start at 45,000 LKR. Would you like a breakdown?";
                } else if (customerMsg.includes("portfolio")) {
                    replyText = "You can view our latest projects here: https://yourportfolio.lk";
                }

                await sendWhatsAppMessage(customerPhone, replyText);
            }
        }
    } else {
        res.sendStatus(404);
    }
});

/** 
 * 3. Send Message Function
 */
async function sendWhatsAppMessage(to, text) {
    try {
        await axios({
            method: "POST",
            url: `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
            data: {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: to,
                type: "text",
                text: { body: text }
            },
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ACCESS_TOKEN}`
            }
        });
        console.log(`📤 Reply sent to ${to}`);
    } catch (err) {
        console.error("❌ Send Error:", err.response?.data || err.message);
    }
}

app.listen(SERVER_PORT, () => console.log(`🚀 Bot is live on port ${SERVER_PORT}`));