import { Request, Response, NextFunction } from "express";

export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.API_KEY;
  if (!expected) return next(); // key not configured — skip in local dev without it

  const provided = req.headers["x-api-key"];
  if (provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
