import { Request, Response, NextFunction, RequestHandler } from "express";
import session from "express-session";
import { findUserById, type User } from "./users.js";

declare module "express-session"
{
    interface SessionData
    {
        userId?: string;
    }
}

export interface AuthenticatedRequest extends Request
{
    user?: User;
}

const NODE_ENV = process.env.NODE_ENV || "development";
const SESSION_SECRET = process.env.SESSION_SECRET || "d6a951aee1615378e83d66d0d5cb9ea5";

export const sessionMiddleware: RequestHandler = session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: NODE_ENV === "production" ? "strict" : "lax",
    },
});

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>
{
    const userId = req.session.userId;
    if (!userId)
    {
        res.status(401).json({ error: "Not authenticated" });
    }

    const user = await findUserById(userId);
    if (!user)
    {
        res.status(401).json({ error: "User not found" });
        return;
    }

    (req as AuthenticatedRequest).user = user;
    next();
}
