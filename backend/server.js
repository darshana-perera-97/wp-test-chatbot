const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// Fallback to a string ONLY if .env is missing, but log it so you know
const PORT = process.env.PORT || 3001;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN; 

if (!VERIFY_TOKEN) {
    console.warn("⚠️ WARNING: VERIFY_TOKEN is not defined in .env file!");
}

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

/**
 * 1. Verification Endpoint (GET)
 */
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // DEBUG LOGS - This will tell you exactly what is happening in your terminal
    console.log("--- New Verification Attempt ---");
    console.log("Stored Token in .env:", VERIFY_TOKEN);
    console.log("Token received from Meta:", token);

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ WEBHOOK_VERIFIED');
            return res.status(200).send(challenge);
        } else {
            console.error('❌ Verification failed: Tokens do not match');
            return res.sendStatus(403);
        }
    } else {
        console.error('❌ Missing mode or token in query params');
        return res.sendStatus(400);
    }
});

/**
 * 2. Event Handler Endpoint (POST)
 */
app.post('/webhook', (req, res) => {
    const APP_SECRET = process.env.APP_SECRET;

    if (APP_SECRET) {
        const signature = req.headers['x-hub-signature-256'];
        if (!signature) {
            console.warn("⚠️ Missing signature header");
        } else {
            const hash = crypto.createHmac('sha256', APP_SECRET)
                               .update(req.rawBody)
                               .digest('hex');
            if (signature !== `sha256=${hash}`) {
                console.error("❌ Signature mismatch! Request may not be from Meta.");
                return res.sendStatus(401);
            }
        }
    }

    const body = req.body;

    if (body.object) {
        res.status(200).send('EVENT_RECEIVED');
        handleWebhookEvent(body);
    } else {
        res.sendStatus(404);
    }
});

function handleWebhookEvent(body) {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) return;

    if (value.messages) {
        const message = value.messages[0];
        console.log(`📩 New message from ${message.from}: ${message.text?.body}`);
    }

    if (value.statuses) {
        const statusUpdate = value.statuses[0];
        console.log(`📊 Message ${statusUpdate.id} status: ${statusUpdate.status}`);
    }
}

app.listen(PORT, () => {
    console.log(`🚀 Webhook server running on port ${PORT}`);
    console.log(`🔑 Current Verify Token: ${VERIFY_TOKEN}`);
});