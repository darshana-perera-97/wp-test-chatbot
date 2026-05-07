const express = require('express');
const crypto = require('crypto');
require('dotenv').config(); // Ensure you have a .env file for secrets

const app = express();

// Use a raw body buffer to verify signatures accurately
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

const PORT = process.env.PORT || 3001;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_secure_token_123";
const APP_SECRET = process.env.APP_SECRET; // Your App Secret from the dashboard

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

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ WEBHOOK_VERIFIED');
            return res.status(200).send(challenge);
        } else {
            console.error('❌ Verification failed: Tokens do not match');
            return res.sendStatus(403);
        }
    }
});

/**
 * 2. Event Handler Endpoint (POST)
 */
app.post('/webhook', (req, res) => {
    // Optional: Security Signature Check
    if (APP_SECRET) {
        const signature = req.headers['x-hub-signature-256'];
        const hash = crypto.createHmac('sha256', APP_SECRET)
                           .update(req.rawBody)
                           .digest('hex');
        
        if (signature !== `sha256=${hash}`) {
            return res.sendStatus(401);
        }
    }

    const body = req.body;

    // Check if the event is from a valid object (e.g., 'whatsapp_business_account')
    if (body.object) {
        // Return 200 OK immediately so the platform doesn't timeout
        res.status(200).send('EVENT_RECEIVED');

        // Handle the incoming data logic
        handleWebhookEvent(body);
    } else {
        res.sendStatus(404);
    }
});

/**
 * 3. Business Logic
 */
function handleWebhookEvent(body) {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) return;

    // A: Handle Incoming Messages
    if (value.messages) {
        const message = value.messages[0];
        console.log(`📩 New message from ${message.from}: ${message.text?.body}`);
    }

    // B: Handle Status Updates (sent, delivered, read)
    if (value.statuses) {
        const statusUpdate = value.statuses[0];
        console.log(`📊 Message ${statusUpdate.id} status changed to: ${statusUpdate.status}`);
    }
}

app.listen(PORT, () => {
    console.log(`🚀 Webhook server running on port ${PORT}`);
});