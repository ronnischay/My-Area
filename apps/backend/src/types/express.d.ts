import type { AuthContext } from "../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by the request-id middleware; echoed in X-Request-Id and error bodies. */
      requestId: string;
      /** Set by require-auth from the session cookie. Read it with getAuth()/getSocietyAuth(). */
      auth?: AuthContext;
    }
  }
}

export {};
