declare global {
  namespace Express {
    interface Request {
      /** Set by the request-id middleware; echoed in X-Request-Id and error bodies. */
      requestId: string;
    }
  }
}

export {};
