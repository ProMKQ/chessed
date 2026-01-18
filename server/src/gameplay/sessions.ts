import { WebSocket } from "ws";
import { Chess, type Move } from "chess.js";
import { findUserById, updateUserElo } from "../auth/users.js";
import { calculateEloChanges, DEFAULT_ELO } from "../elo/elo.js";

export type GameResult =
    | { type: "checkmate"; winner: "white" | "black" }
    | { type: "stalemate" }
    | { type: "draw"; reason: "insufficient" | "threefold" | "fifty-move" }
    | { type: "resign"; winner: "white" | "black" };

export interface GameSession
{
    matchId: string;
    player1: { userId: string; username: string; elo: number };
    player2: { userId: string; username: string; elo: number };
    player1Socket: WebSocket | null;
    player2Socket: WebSocket | null;
    createdAt: number;
    timeoutId: NodeJS.Timeout | null;
    started: boolean;
    chess: Chess;
    gameEnded: boolean;
    result: GameResult | null;
}

const sessions: Map<string, GameSession> = new Map();

const CONNECTION_TIMEOUT_MS = 60 * 1000;

export async function createSession(
    matchId: string,
    player1: { userId: string; username: string },
    player2: { userId: string; username: string }
): Promise<void>
{
    const existingSession = sessions.get(matchId);
    if (existingSession)
    {
        destroySession(matchId);
    }

    const user1 = await findUserById(player1.userId);
    const user2 = await findUserById(player2.userId);
    const player1Elo = user1?.elo ?? DEFAULT_ELO;
    const player2Elo = user2?.elo ?? DEFAULT_ELO;

    const session: GameSession = {
        matchId,
        player1: { ...player1, elo: player1Elo },
        player2: { ...player2, elo: player2Elo },
        player1Socket: null,
        player2Socket: null,
        createdAt: Date.now(),
        timeoutId: null,
        started: false,
        chess: new Chess(),
        gameEnded: false,
        result: null,
    };

    session.timeoutId = setTimeout(() =>
    {
        cancelSession(matchId);
    }, CONNECTION_TIMEOUT_MS);

    sessions.set(matchId, session);
}

export function getSession(matchId: string): GameSession | undefined
{
    return sessions.get(matchId);
}

export function isSessionValid(matchId: string): boolean
{
    return sessions.has(matchId);
}

export function connectPlayer(matchId: string, userId: string, socket: WebSocket): boolean
{
    const session = sessions.get(matchId);
    if (!session)
    {
        return false;
    }

    if (session.player1.userId === userId)
    {
        if (session.player1Socket)
        {
            session.player1Socket.close();
        }
        session.player1Socket = socket;
    }
    else if (session.player2.userId === userId)
    {
        if (session.player2Socket)
        {
            session.player2Socket.close();
        }
        session.player2Socket = socket;
    }
    else
    {
        return false;
    }

    if (session.player1Socket && session.player2Socket && !session.started)
    {
        session.started = true;

        if (session.timeoutId)
        {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }

        const baseMessage = {
            type: "game_started",
            matchId: session.matchId,
            fen: session.chess.fen(),
            turn: session.chess.turn(),
        };

        session.player1Socket.send(
            JSON.stringify({
                ...baseMessage,
                color: "w" as const,
                username: session.player1.username,
                userElo: session.player1.elo,
                opponent: session.player2.username,
                opponentElo: session.player2.elo,
            })
        );
        session.player2Socket.send(
            JSON.stringify({
                ...baseMessage,
                color: "b" as const,
                username: session.player2.username,
                userElo: session.player2.elo,
                opponent: session.player1.username,
                opponentElo: session.player1.elo,
            })
        );
    }

    return true;
}

export function handlePlayerDisconnect(matchId: string, userId: string): void
{
    const session = sessions.get(matchId);
    if (!session)
    {
        return;
    }

    if (session.gameEnded)
    {
        if (session.player1.userId === userId)
        {
            session.player1Socket = null;
        }
        else if (session.player2.userId === userId)
        {
            session.player2Socket = null;
        }
        if (!session.player1Socket && !session.player2Socket)
        {
            sessions.delete(matchId);
        }
        return;
    }

    let otherSocket: WebSocket | null = null;
    if (session.player1.userId === userId)
    {
        session.player1Socket = null;
        otherSocket = session.player2Socket;
    }
    else if (session.player2.userId === userId)
    {
        session.player2Socket = null;
        otherSocket = session.player1Socket;
    }

    if (otherSocket && otherSocket.readyState === WebSocket.OPEN)
    {
        const errorMessage = JSON.stringify({
            type: "session_error",
            message: "Your opponent disconnected, and the game was cancelled.",
        });
        otherSocket.send(errorMessage);
        otherSocket.close();
    }

    // Destroy the session
    destroySession(matchId);
}

function cancelSession(matchId: string): void
{
    const session = sessions.get(matchId);
    if (!session)
    {
        return;
    }

    const timeoutMessage = JSON.stringify({
        type: "session_error",
        message: "Your opponent failed to connect in time, and the game was cancelled.",
    });

    if (session.player1Socket && session.player1Socket.readyState === WebSocket.OPEN)
    {
        session.player1Socket.send(timeoutMessage);
        session.player1Socket.close();
    }
    if (session.player2Socket && session.player2Socket.readyState === WebSocket.OPEN)
    {
        session.player2Socket.send(timeoutMessage);
        session.player2Socket.close();
    }

    if (session.timeoutId)
    {
        clearTimeout(session.timeoutId);
    }
    sessions.delete(matchId);
}

export function destroySession(matchId: string): void
{
    const session = sessions.get(matchId);
    if (!session)
    {
        return;
    }

    if (session.timeoutId)
    {
        clearTimeout(session.timeoutId);
    }

    if (session.player1Socket && session.player1Socket.readyState === WebSocket.OPEN)
    {
        session.player1Socket.close();
    }
    if (session.player2Socket && session.player2Socket.readyState === WebSocket.OPEN)
    {
        session.player2Socket.close();
    }

    sessions.delete(matchId);
}

export function getPlayerColor(session: GameSession, userId: string): "w" | "b" | null
{
    if (session.player1.userId === userId) return "w";
    if (session.player2.userId === userId) return "b";
    return null;
}

export function isPlayerTurn(session: GameSession, userId: string): boolean
{
    const playerColor = getPlayerColor(session, userId);
    return playerColor === session.chess.turn();
}

function broadcastToPlayers(session: GameSession, message: object): void
{
    const msgStr = JSON.stringify(message);
    if (session.player1Socket && session.player1Socket.readyState === WebSocket.OPEN)
    {
        session.player1Socket.send(msgStr);
    }
    if (session.player2Socket && session.player2Socket.readyState === WebSocket.OPEN)
    {
        session.player2Socket.send(msgStr);
    }
}

function checkGameOver(session: GameSession): GameResult | null
{
    const chess = session.chess;

    if (chess.isCheckmate())
    {
        const winner = chess.turn() === "w" ? "black" : "white";
        return { type: "checkmate", winner };
    }

    if (chess.isStalemate())
    {
        return { type: "stalemate" };
    }

    if (chess.isInsufficientMaterial())
    {
        return { type: "draw", reason: "insufficient" };
    }

    if (chess.isThreefoldRepetition())
    {
        return { type: "draw", reason: "threefold" };
    }

    if (chess.isDraw())
    {
        return { type: "draw", reason: "fifty-move" };
    }

    return null;
}

function getGameOutcome(result: GameResult): "white" | "black" | "draw"
{
    if (result.type === "checkmate" || result.type === "resign")
    {
        return result.winner;
    }
    return "draw";
}

async function endGame(session: GameSession, result: GameResult): Promise<void>
{
    session.gameEnded = true;
    session.result = result;

    const outcome = getGameOutcome(result);
    const eloChanges = calculateEloChanges(session.player1.elo, session.player2.elo, outcome);

    await updateUserElo(session.player1.userId, eloChanges.whiteNewRating);
    await updateUserElo(session.player2.userId, eloChanges.blackNewRating);

    const baseMessage = {
        type: "game_over",
        result,
        fen: session.chess.fen(),
    };

    if (session.player1Socket && session.player1Socket.readyState === WebSocket.OPEN)
    {
        session.player1Socket.send(
            JSON.stringify({
                ...baseMessage,
                eloChange: eloChanges.whiteChange,
                opponentEloChange: eloChanges.blackChange,
            })
        );
    }
    if (session.player2Socket && session.player2Socket.readyState === WebSocket.OPEN)
    {
        session.player2Socket.send(
            JSON.stringify({
                ...baseMessage,
                eloChange: eloChanges.blackChange,
                opponentEloChange: eloChanges.whiteChange,
            })
        );
    }

    if (session.player1Socket && session.player1Socket.readyState === WebSocket.OPEN)
    {
        session.player1Socket.close();
    }
    if (session.player2Socket && session.player2Socket.readyState === WebSocket.OPEN)
    {
        session.player2Socket.close();
    }
}

export async function processMove(
    matchId: string,
    userId: string,
    from: string,
    to: string,
    promotion?: "q" | "r" | "b" | "n"
): Promise<{ success: boolean; error?: string }>
{
    const session = sessions.get(matchId);
    if (!session || !session.started || session.gameEnded)
    {
        return { success: false, error: "Invalid session" };
    }

    if (!isPlayerTurn(session, userId))
    {
        return { success: false, error: "Invalid turn" };
    }

    let move: Move | null;
    try
    {
        move = session.chess.move({ from, to, promotion });
    }
    catch
    {
        move = null;
    }

    if (!move)
    {
        return { success: false, error: "Invalid move" };
    }

    const moveMessage = {
        type: "move",
        from: move.from,
        to: move.to,
        promotion: move.promotion,
        fen: session.chess.fen(),
        turn: session.chess.turn(),
        isCheck: session.chess.isCheck(),
    };

    broadcastToPlayers(session, moveMessage);

    const result = checkGameOver(session);
    if (result)
    {
        await endGame(session, result);
    }

    return { success: true };
}

export async function processResign(matchId: string, userId: string): Promise<{ success: boolean; error?: string }>
{
    const session = sessions.get(matchId);
    if (!session || !session.started || session.gameEnded)
    {
        return { success: false, error: "Invalid session" };
    }

    const playerColor = getPlayerColor(session, userId);
    if (!playerColor)
    {
        return { success: false, error: "Invalid player" };
    }

    const winner = playerColor === "w" ? "black" : "white";
    const result: GameResult = { type: "resign", winner };

    await endGame(session, result);

    return { success: true };
}
