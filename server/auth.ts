import { Request, Response, NextFunction } from "express";
import * as crypto from "crypto";
import { db, User } from "./db";

// Use a secret key from environment or fallback to a stable random one
const JWT_SECRET = process.env.JWT_SECRET || "f9a2e8c4b1d7f6c5a3e201b2a3c4f5e6";

// Extend Express Request type to include user details
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

/**
 * Generate a secure, lightweight cryptographic token (JWT-like) with expiration.
 */
export function generateToken(payload: object, expiryHours = 24): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiryHours * 60 * 60,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verify a cryptographic token and return the payload if valid, otherwise null.
 */
export function verifyToken(token: string): any {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signature] = parts;

  // Verify signature
  const expectedSignature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  if (signature !== expectedSignature) {
    return null; // Signature mismatch
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && now > payload.exp) {
      return null; // Token expired
    }

    return payload;
  } catch (err) {
    return null; // Invalid JSON
  }
}

/**
 * Express middleware to authenticate and populate the user session.
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token = "";

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    res.status(401).json({ error: "未提供身份验证令牌，请登录" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "令牌已过期或无效，请重新登录" });
    return;
  }

  req.user = {
    id: payload.id,
    username: payload.username,
    role: payload.role,
  };

  next();
}

/**
 * Express middleware to enforce admin privileges.
 */
export function adminRequired(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  authMiddleware(req, res, () => {
    if (req.user && req.user.role === "admin") {
      next();
    } else {
      res.status(403).json({ error: "越权操作：只有管理员拥有此权限" });
    }
  });
}
