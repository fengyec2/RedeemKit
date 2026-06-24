// IMPORTANT: The main server file is named app.ts (not server.ts) to avoid
// a naming conflict with the server/ directory (which contains db.ts and
// auth.ts). When both server.ts and server/ exist at the same level, Vercel's
// ESM resolver finds the server/ directory instead of server.ts, causing
// ERR_UNSUPPORTED_DIR_IMPORT. Using app.ts eliminates this ambiguity.
import type { Request, Response } from "express";
import app from "../app";

export default function handler(req: Request, res: Response) {
  return app(req, res);
}