const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Middleware to capture Raw Body for signature verification
app.use(express.json({
    verify: (req, res, buf) => { req.rawBody = buf; }
}));

const {
    PORT,
    VERIFY_TOKEN,
    APP_SECRET,
    ACCESS_TOKEN,
    PHONE_NUMBER_ID,
    VERIFY_SIGNATURE,
    OPENAI_API_KEY,
    OPENAI_MODEL
} = process.env;
const SERVER_PORT = PORT || 3001;
const SHOULD_VERIFY_SIGNATURE = VERIFY_SIGNATURE !== 'false';
const SALES_MODEL = OPENAI_MODEL || 'gpt-4o-mini';

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
    if (SHOULD_VERIFY_SIGNATURE) {
        if (!APP_SECRET) {
            console.error("❌ APP_SECRET is missing. Set APP_SECRET or use VERIFY_SIGNATURE=false for local testing.");
            return res.sendStatus(500);
        }

        const signature = req.headers['x-hub-signature-256'];
        if (!signature || !signature.startsWith('sha256=')) {
            console.error("❌ Missing or invalid x-hub-signature-256 header.");
            return res.sendStatus(401);
        }

        const receivedHash = signature.replace('sha256=', '');
        const expectedHash = crypto.createHmac('sha256', APP_SECRET.trim()).update(req.rawBody).digest('hex');
        const isValid =
            receivedHash.length === expectedHash.length &&
            crypto.timingSafeEqual(Buffer.from(receivedHash, 'hex'), Buffer.from(expectedHash, 'hex'));

        if (!isValid) {
            console.error("❌ Signature mismatch! Check your APP_SECRET in .env (must match Meta App Secret exactly).");
            return res.sendStatus(401);
        }
    } else {
        console.warn("⚠️ Signature verification is disabled (VERIFY_SIGNATURE=false). Use only for local testing.");
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
                const customerMsg = message.text?.body || '';

                console.log(
                    `📩 Incoming | to: ${businessNumber} | from: ${customerPhone} | type: ${messageType} | message: ${messageText}`
                );

                const replyText = await generateSalesReply(customerMsg);

                await sendWhatsAppMessage(customerPhone, replyText);
            }
        }

        if (Array.isArray(value?.statuses) && value.statuses.length > 0) {
            for (const status of value.statuses) {
                console.log(
                    `📬 Delivery | to: ${status.recipient_id || 'unknown'} | messageId: ${status.id || 'unknown'} | status: ${status.status || 'unknown'}`
                );
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
    const outgoingPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: { body: text }
    };

    console.log(`📤 Outgoing | to: ${to} | type: text | message: ${text}`);

    try {
        const response = await axios({
            method: "POST",
            url: `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
            data: outgoingPayload,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ACCESS_TOKEN}`
            }
        });
        console.log(
            `✅ Outgoing delivered to API | to: ${to} | http: ${response.status} | wamid: ${response.data?.messages?.[0]?.id || 'n/a'}`
        );
    } catch (err) {
        console.error("❌ Send Error:", err.response?.data || err.message);
    }
}

async function generateSalesReply(customerMessage) {
    if (!customerMessage) {
        return "Thanks for your message! Please send text so I can assist you better.";
    }

    if (!OPENAI_API_KEY) {
        return "Hi! Welcome to Nexgenai. We build AI chatbots, automation systems, and custom web solutions to grow your business. Tell me what you need and I will share the best package.";
    }

    try {
        const response = await axios({
            method: "POST",
            url: "https://api.openai.com/v1/chat/completions",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            data: {
                model: SALES_MODEL,
                temperature: 0.7,
                max_tokens: 180,
                messages: [
                    {
                        role: "system",
                        content:
                            "You are a friendly sales representative for Nexgenai. Your goal is to understand customer needs, build trust, explain services clearly, and guide them toward booking a consultation. Keep replies short (2-4 sentences), professional, and persuasive. Ask one relevant follow-up question when helpful."
                    },
                    {
                        role: "user",
                        content: customerMessage
                    }
                ]
            }
        });

        const aiReply = response.data?.choices?.[0]?.message?.content?.trim();
        if (aiReply) return aiReply;
    } catch (err) {
        console.error("❌ OpenAI reply error:", err.response?.data || err.message);
    }

    return "Thanks for reaching Nexgenai! We can help with AI chatbots, sales automation, and custom software for your business. Share your goal and timeline, and I will suggest the best solution.";
}

app.listen(SERVER_PORT, () => console.log(`🚀 Bot is live on port ${SERVER_PORT}`));