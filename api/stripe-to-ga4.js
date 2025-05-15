// File: api/stripe-to-ga4.js

import Stripe from 'stripe';
import { buffer } from 'micro';

// Desativa parser padrão para validar assinatura
export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verifica assinatura do Stripe
  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Apenas checkout concluído
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Monta payload GA4
    const measurementId = process.env.GA_MEASUREMENT_ID;
    const apiSecret     = process.env.GA_API_SECRET;
    const clientId      = session.client_reference_id || session.customer;

    const gaPayload = {
      client_id: clientId,
      events: [{
        name: 'purchase',
        params: {
          currency: session.currency.toUpperCase(),
          value: session.amount_total / 100,
          transaction_id: session.id,
          user_email: session.customer_details?.email,
          user_phone: session.customer_details?.phone
        }
      }]
    };

    // Envia para GA4 via Measurement Protocol
    const endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gaPayload)
      });
      console.log('GA4 response status:', response.status);
    } catch (err) {
      console.error('❌ Error sending to GA4:', err);
    }
  }

  res.status(200).json({ received: true });
}

/*
⚙️ Variáveis de ambiente (configure na Vercel):
  STRIPE_SECRET_KEY       = sk_live_
  STRIPE_WEBHOOK_SECRET   = whsec_
  GA_MEASUREMENT_ID       = G-DYX8LQJZFY
  GA_API_SECRET           = thS3ewEXSw6k1Ed0ZXVmsw
*/
