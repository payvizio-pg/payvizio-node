# Payvizio Node SDK

Server-side SDK for Payvizio. Zero runtime dependencies — uses Node 18+'s
built-in `fetch` and `crypto`.

## Install

```bash
npm install @payvizio/sdk
```

## Usage

```js
const { Payvizio } = require('@payvizio/sdk');

const pv = new Payvizio({ apiKey: process.env.PAYVIZIO_API_KEY });

// Create a session
const session = await pv.payments.create({
    orderId:  'ord_42',
    amount:   1499.00,
    currency: 'INR',
    customerEmail: 'alice@example.com',
}, { idempotencyKey: 'create-ord_42' });

// Capture (partial allowed)
await pv.payments.capture(session.sessionId, 500.00);

// Refund
await pv.refunds.create({ sessionId: session.sessionId, amount: 200.00, reason: 'requested_by_customer' });

// Verify a webhook
app.post('/webhook', express.raw({ type: '*/*' }), (req, res) => {
    const ok = pv.webhooks.verify(
        req.body,                              // raw bytes — do not re-stringify
        req.headers['x-payvizio-signature'],
        process.env.PAYVIZIO_WEBHOOK_SECRET,
    );
    if (!ok) return res.status(401).end();
    // …handle event
    res.status(200).end();
});
```

## Errors

Network or 4xx/5xx responses throw `PayvizioError` with `status`, `code`, and parsed `body`.
