// ─── Messaging Routes ───────────────────────────────────────────────
// WhatsApp Business API webhook endpoints.
// IMPORTANT: These routes must be mounted OUTSIDE the API key auth
// middleware because Meta sends the webhook requests directly.

import { Router } from 'express';
import { whatsappClient } from '../messaging/whatsapp.js';

const router = Router();

// ─── WhatsApp Webhook Verification ──────────────────────────────────
// Meta sends a GET request to verify the webhook URL during setup.

router.get('/whatsapp/webhook', (req, res) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WhatsApp webhook verified.');
    res.status(200).send(challenge);
  } else {
    console.warn('WhatsApp webhook verification failed — token mismatch.');
    res.sendStatus(403);
  }
});

// ─── Incoming Messages ──────────────────────────────────────────────
// Meta POSTs incoming messages to this endpoint.
// Always respond 200 to acknowledge receipt (even on errors) to prevent
// Meta from retrying and creating duplicate processing.

router.post('/whatsapp/webhook', async (req, res) => {
  try {
    const body = req.body;

    // WhatsApp Cloud API webhook payload structure:
    // body.entry[].changes[].value.messages[]
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages?.length) {
      for (const message of messages) {
        await whatsappClient.handleIncomingMessage(message);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    // Still 200 to prevent Meta retries
    res.sendStatus(200);
  }
});

export { router as messagingRouter };
