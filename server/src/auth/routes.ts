import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { findUserByUsername, createUser, verifyPassword, getUserPublicInfo } from "./users.js";
import { requireAuth, type AuthenticatedRequest } from "./middleware.js";

const router = Router();

const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true" || process.env.TEST === "true";

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: { error: "Too many attempts. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv,
});

router.post("/register", authLimiter, async (req: Request, res: Response): Promise<void> =>
{
    const { username, password } = req.body;

    if (!username || !password)
    {
        res.status(400).json({ error: "Username and password are required" });
        return;
    }

    if (typeof username !== "string" || typeof password !== "string")
    {
        res.status(400).json({ error: "Invalid input" });
        return;
    }

    if (username.length < 3 || username.length > 20)
    {
        res.status(400).json({ error: "Username must be between 3 and 20 characters" });
        return;
    }

    if (password.length < 6)
    {
        res.status(400).json({ error: "Password must be at least 6 characters long" });
        return;
    }

    const existingUser = await findUserByUsername(username);
    if (existingUser)
    {
        res.status(409).json({ error: "Username already exists" });
        return;
    }

    const user = await createUser(username, password);
    req.session.userId = user.id;

    res.status(201).json({ success: true });
});

router.post("/login", authLimiter, async (req: Request, res: Response): Promise<void> =>
{
    const { username, password } = req.body;

    if (!username || !password)
    {
        res.status(400).json({ error: "Username and password are required" });
        return;
    }

    const user = await findUserByUsername(username);
    if (!user || !verifyPassword(user, password))
    {
        res.status(401).json({ error: "Invalid username or password" });
        return;
    }

    req.session.userId = user.id;

    res.json({ success: true });
});

router.post("/logout", (req: Request, res: Response) =>
{
    req.session.destroy((err) =>
    {
        if (err)
        {
            res.status(500).json({ error: "Failed to logout" });
            return;
        }

        res.clearCookie("connect.sid");

        res.json({ message: "Logged out successfully" });
    });
});

router.get("/me", requireAuth, (req: Request, res: Response) =>
{
    const authReq = req as AuthenticatedRequest;

    res.json({ user: getUserPublicInfo(authReq.user!) });
});

export default router;
