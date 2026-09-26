export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class PaymentDeclinedError extends HttpError {
  constructor(reason: string) {
    super(402, 'payment_declined', `Payment declined: ${reason}`);
    this.name = 'PaymentDeclinedError';
  }
}

export class OutOfStockError extends HttpError {
  constructor(sku: string) {
    super(409, 'out_of_stock', `SKU ${sku} is out of stock`);
    this.name = 'OutOfStockError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Authentication required') {
    super(401, 'unauthorized', message);
    this.name = 'UnauthorizedError';
  }
}
