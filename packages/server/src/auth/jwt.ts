import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface SessionTokenPayload {
  userId: string;
  campaignId: string;
  isAdmin: boolean;
  name: string;
}

export function signSessionToken(payload: SessionTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "12h" });
}

export function verifySessionToken(token: string): SessionTokenPayload {
  return jwt.verify(token, env.jwtSecret) as SessionTokenPayload;
}
