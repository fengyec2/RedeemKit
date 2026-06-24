let app: any = null;
let initError: any = null;

async function bootstrap() {
  if (app) return app;
  try {
    // Dynamically import server.ts/js
    const module = await import("../server");
    app = module.default;
    return app;
  } catch (err: any) {
    console.error("Vercel Serverless Bootstrap Error:", err);
    initError = err;
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  try {
    const expressApp = await bootstrap();
    return expressApp(req, res);
  } catch (err: any) {
    console.error("Vercel Request Handler Error:", err);
    res.status(500).json({
      error: "Vercel Serverless Function Bootstrap Error (Vercel Serverless 函数启动失败)",
      message: err.message,
      stack: err.stack,
      initError: initError ? { message: initError.message, stack: initError.stack } : null,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        HAS_DATABASE_URL: !!process.env.DATABASE_URL
      }
    });
  }
}

