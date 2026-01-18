import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, ServerResponse, Server as HttpServer } from "http";
import { parse as parseUrl } from "url";
import { sessionMiddleware } from "../auth/middleware.js";
import {
    getSession,
    connectPlayer,
    handlePlayerDisconnect,
    isSessionValid,
    processMove,
    processResign,
} from "./sessions.js";

interface GameWebSocket extends WebSocket
{
    matchId?: string;
    userId?: string;
}

interface MoveMessage
{
    type: "move";
    from: string;
    to: string;
    promotion?: "q" | "r" | "b" | "n";
}

interface ResignMessage
{
    type: "resign";
}

type ClientMessage = MoveMessage | ResignMessage;

interface SessionRequest extends IncomingMessage
{
    session?: {
        userId?: string;
    };
}

export function initializeGameplayWebSocket(httpServer: HttpServer): void
{
    const wss = new WebSocketServer({ noServer: true });

    // to create a websocket, a regular http request is upgraded using a special header
    // handle these upgrades to prevent the socket from being created when it is not allowed
    httpServer.on("upgrade", (request: SessionRequest, socket, head) =>
    {
        const parsedUrl = parseUrl(request.url || "", true);
        const pathname = parsedUrl.pathname || "";

        if (pathname !== "/game")
        {
            socket.destroy();
            return;
        }

        const matchId = parsedUrl.query.matchId as string | undefined;
        if (!matchId)
        {
            socket.destroy();
            return;
        }

        const res = new ServerResponse(request);
        (
            sessionMiddleware as unknown as (
                req: SessionRequest,
                res: ServerResponse,
                next: (err?: unknown) => void
            ) => void
        )(request, res, (err) =>
        {
            wss.handleUpgrade(request, socket, head, (ws) =>
            {
                const gameWs = ws as GameWebSocket;
                gameWs.matchId = matchId;
                gameWs.userId = request.session?.userId;

                if (err || !request.session?.userId)
                {
                    gameWs.close(1008, "Unauthorized");
                    return;
                }

                const userId = request.session.userId;
                if (!isSessionValid(matchId))
                {
                    gameWs.close(1008, "Invalid match ID");
                    return;
                }

                const session = getSession(matchId);
                if (!session || (session.player1.userId !== userId && session.player2.userId !== userId))
                {
                    gameWs.close(1008, "Not authorized for this match");
                    return;
                }

                wss.emit("connection", gameWs, request);
            });
        });
    });

    // handle the actual connection, which has been emitted above
    wss.on("connection", (ws: GameWebSocket) =>
    {
        const matchId = ws.matchId!;
        const userId = ws.userId!;

        const connected = connectPlayer(matchId, userId, ws);
        if (!connected)
        {
            ws.close(1008, "Invalid session");
            return;
        }

        ws.on("message", async (data) =>
        {
            let message: ClientMessage;
            try
            {
                message = JSON.parse(data.toString()) as ClientMessage;
            }
            catch
            {
                ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
                return;
            }

            if (message.type === "move")
            {
                const result = await processMove(matchId, userId, message.from, message.to, message.promotion);
                if (!result.success)
                {
                    ws.send(JSON.stringify({ type: "move_error", message: result.error }));
                }
            }
            else if (message.type === "resign")
            {
                const result = await processResign(matchId, userId);
                if (!result.success)
                {
                    ws.send(JSON.stringify({ type: "resign_error", message: result.error }));
                }
            }
        });

        ws.on("close", () =>
        {
            handlePlayerDisconnect(matchId, userId);
        });

        ws.on("error", () =>
        {
            handlePlayerDisconnect(matchId, userId);
        });
    });
}
