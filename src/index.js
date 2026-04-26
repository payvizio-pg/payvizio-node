'use strict';

/**
 * Payvizio server SDK for Node.js. Zero runtime dependencies — uses the
 * built-in `fetch` (Node 18+) and `crypto` for webhook signature verification.
 *
 * Usage:
 *
 *   const { Payvizio } = require('@payvizio/sdk');
 *   const pv = new Payvizio({ apiKey: process.env.PAYVIZIO_API_KEY });
 *
 *   const session = await pv.payments.create({
 *     orderId: 'ord_42',
 *     amount: 1499.00,
 *     currency: 'INR',
 *   });
 *
 *   const ok = pv.webhooks.verify(rawBody, req.headers['x-payvizio-signature'], secret);
 */

const crypto = require('crypto');

const DEFAULT_BASE_URL = 'https://api.payvizio.com';
const DEFAULT_TIMEOUT_MS = 15000;

class PayvizioError extends Error {
    constructor(message, { status, code, body } = {}) {
        super(message);
        this.name = 'PayvizioError';
        this.status = status;
        this.code = code;
        this.body = body;
    }
}

class Payvizio {
    constructor(options = {}) {
        if (!options.apiKey) throw new PayvizioError('apiKey is required');
        this.apiKey = options.apiKey;
        this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

        this.payments = new PaymentsAPI(this);
        this.refunds  = new RefundsAPI(this);
        this.webhooks = new WebhooksAPI();
    }

    async _request(method, path, { body, idempotencyKey } = {}) {
        const url = this.baseUrl + path;
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
        };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const res = await fetch(url, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            const text = await res.text();
            const parsed = text ? safeJson(text) : null;
            if (!res.ok) {
                throw new PayvizioError(
                    (parsed && (parsed.error || parsed.message)) || `HTTP ${res.status}`,
                    { status: res.status, code: parsed && parsed.code, body: parsed }
                );
            }
            return parsed;
        } finally {
            clearTimeout(timeout);
        }
    }
}

class PaymentsAPI {
    constructor(client) { this._c = client; }

    /** Create a payment session. */
    async create(input, opts = {}) {
        return this._c._request('POST', '/api/payments', { body: input, idempotencyKey: opts.idempotencyKey });
    }

    /** Fetch session status. */
    async get(sessionId) {
        return this._c._request('GET', `/api/payments/${encodeURIComponent(sessionId)}`);
    }

    /** Capture an authorized session. Pass amount for partial; omit for full remaining. */
    async capture(sessionId, amount, opts = {}) {
        const body = amount !== undefined ? { amount } : {};
        return this._c._request('POST', `/api/payments/${encodeURIComponent(sessionId)}/capture`,
            { body, idempotencyKey: opts.idempotencyKey });
    }

    /** Cancel/void an authorized session. */
    async cancel(sessionId) {
        return this._c._request('POST', `/api/payments/${encodeURIComponent(sessionId)}/cancel`, { body: {} });
    }
}

class RefundsAPI {
    constructor(client) { this._c = client; }

    async create(input, opts = {}) {
        return this._c._request('POST', '/api/refunds', { body: input, idempotencyKey: opts.idempotencyKey });
    }

    async get(refundId) {
        return this._c._request('GET', `/api/refunds/${encodeURIComponent(refundId)}`);
    }
}

class WebhooksAPI {
    /**
     * Verify HMAC-SHA256 webhook signatures with constant-time comparison.
     * @param rawBody The exact bytes of the request body — never re-stringify the parsed JSON.
     */
    verify(rawBody, signatureHex, secret) {
        if (!rawBody || !signatureHex || !secret) return false;
        const computed = crypto.createHmac('sha256', secret)
            .update(typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody))
            .digest('hex');
        try {
            return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signatureHex));
        } catch (_e) {
            return false;
        }
    }
}

function safeJson(s) {
    try { return JSON.parse(s); } catch (_e) { return null; }
}

module.exports = { Payvizio, PayvizioError };
