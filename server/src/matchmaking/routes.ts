import { Router, Request, Response } from "express";
import { addToQueue, removeFromQueueByConnection } from "./queue.js";
import { getUserPublicInfo } from "../auth/users.js";
import { requireAuth, type AuthenticatedRequest } from "../auth/middleware.js";

const router = Router();

// uses server sent events to let the server efficiently notify the client about matches, without requiring a full websocket
// an alternative to this is long polling, which does not scale very well
router.get("/stream", requireAuth, (req: Request, res: Response) =>
{
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user!;
    const userId = user.id;
    const userInfo = getUserPublicInfo(user);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const connectionId = addToQueue(userId, userInfo.username, userInfo.elo, (event) =>
    {
        res.write(`data: ${JSON.stringify(event)}\n\n`);

        if (event.type === "matched" || event.type === "timeout" || event.type === "cancelled")
        {
            res.end();
        }
    });

    req.on("close", () =>
    {
        removeFromQueueByConnection(userId, connectionId);
    });
});

export default router;
