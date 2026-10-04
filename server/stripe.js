import Stripe from 'stripe';

let client;

function configurationError(message) {
  const error = new Error(message);
  error.code = 'STRIPE_NOT_CONFIGURED';
  return error;
}

export function stripeMode() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key) return 'disabled';
  return key.startsWith('sk_live_') ? 'live' : 'test';
}

function getClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw configurationError('Stripe is not configured. Add STRIPE_SECRET_KEY on the server.');
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 });
  return client;
}

function publicBaseUrl() {
  const base = String(process.env.PUBLIC_APP_URL || process.env.CORS_ORIGIN || '').replace(/\/$/, '');
  if (!base || base === '*') throw configurationError('Set PUBLIC_APP_URL or CORS_ORIGIN before creating Stripe Checkout Sessions.');
  if (process.env.NODE_ENV === 'production' && !base.startsWith('https://')) throw configurationError('Production Stripe Checkout requires an HTTPS PUBLIC_APP_URL.');
  return base;
}

export function checkoutUrls() {
  const base = publicBaseUrl();
  return {
    success_url: process.env.STRIPE_SUCCESS_URL || `${base}/?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: process.env.STRIPE_CANCEL_URL || `${base}/?stripe=cancelled`
  };
}

export async function createCheckoutSession({ deal, user }) {
  const stripe = getClient();
  const urls = checkoutUrls();
  return stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: deal.currency.toLowerCase(),
        product_data: {
          name: `Vachan milestone · ${deal.title}`,
          description: String(deal.criteria).slice(0, 500)
        },
        unit_amount: deal.amountMinor
      },
      quantity: 1
    }],
    customer_email: user.email,
    client_reference_id: deal.id,
    metadata: { dealId: deal.id, userId: user.id },
    payment_intent_data: { metadata: { dealId: deal.id, userId: user.id } },
    ...urls
  });
}

export function constructWebhookEvent(rawBody, signature) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw configurationError('Stripe webhook verification is not configured. Add STRIPE_WEBHOOK_SECRET on the server.');
  if (!signature) {
    const error = new Error('Stripe webhook signature is missing.');
    error.code = 'STRIPE_SIGNATURE_INVALID';
    throw error;
  }
  try {
    return getClient().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    error.code = 'STRIPE_SIGNATURE_INVALID';
    throw error;
  }
}
