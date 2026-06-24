// Static import ensures Vercel's @vercel/node builder properly bundles
// server.ts and ALL its dependencies (express, pg, nodemailer, etc.)
// Dynamic import("../server") does NOT work reliably on Vercel because
// server.ts is outside the api/ directory and may not be included in the
// serverless function bundle.
import type { Request, Response } from "express";
import app from "../server";

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
