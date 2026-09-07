import type { VercelRequest, VercelResponse } from "@vercel/node";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wraps a Vercel function handler so a thrown HttpError (or anything else) becomes a clean JSON error response, replacing the old express-async-errors behavior. */
export function withApi(handler: (req: VercelRequest, res: VercelResponse) => Promise<void>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
      } else {
        console.error(err);
        res.status(500).json({ error: (err as Error).message ?? "Internal server error" });
      }
    }
  };
}

export function readBody<T>(req: VercelRequest): T {
  return (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as T;
}
