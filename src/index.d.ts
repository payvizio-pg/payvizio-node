export interface PayvizioOptions {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
}

export interface PaymentSessionRequest {
    merchantId?: string;
    orderId: string;
    amount: number | string;
    currency: string;
    idempotencyKey?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    productDescription?: string;
    successUrl?: string;
    failureUrl?: string;
}

export interface PaymentSession {
    sessionId: string;
    merchantId?: string;
    orderId?: string;
    amount?: string;
    currency?: string;
    status?: string;
    acquirer?: string;
    gatewayReference?: string;
    redirectUrl?: string;
}

export interface CallOptions { idempotencyKey?: string; }

export interface RefundRequest {
    sessionId: string;
    amount: number | string;
    reason?: string;
    idempotencyKey?: string;
}

export class PayvizioError extends Error {
    status?: number;
    code?: string;
    body?: unknown;
}

export class Payvizio {
    constructor(options: PayvizioOptions);
    payments: {
        create(input: PaymentSessionRequest, opts?: CallOptions): Promise<PaymentSession>;
        get(sessionId: string): Promise<PaymentSession>;
        capture(sessionId: string, amount?: number | string, opts?: CallOptions): Promise<unknown>;
        cancel(sessionId: string): Promise<unknown>;
    };
    refunds: {
        create(input: RefundRequest, opts?: CallOptions): Promise<unknown>;
        get(refundId: string): Promise<unknown>;
    };
    webhooks: {
        verify(rawBody: string | Buffer, signatureHex: string, secret: string): boolean;
    };
}
