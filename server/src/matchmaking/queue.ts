import { v4 as uuidv4 } from "uuid";

export interface QueuedPlayer
{
    id: string;
    connectionId: string;
    userId: string;
    username: string;
    joinedAt: number;
}

export interface Match
{
    id: string;
    player1: { userId: string; username: string };
    player2: { userId: string; username: string };
    createdAt: string;
}

export type MatchmakingEvent =
    | { type: "queued" }
    | { type: "matched"; match: Match }
    | { type: "timeout" }
    | { type: "cancelled" };

type EventCallback = (event: MatchmakingEvent) => void;

const queue: Map<string, QueuedPlayer> = new Map();

const callbacks: Map<string, EventCallback> = new Map();

const MATCHMAKING_TIMEOUT_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 1000;

let loopInterval: NodeJS.Timeout | null = null;

// lazy loop that is only started when needed
function startMatchmakingLoop(): void
{
    if (loopInterval) return;

    loopInterval = setInterval(async () =>
    {
        const now = Date.now();
        const players = Array.from(queue.values());

        for (const player of players)
        {
            if (now - player.joinedAt >= MATCHMAKING_TIMEOUT_MS)
            {
                const callback = callbacks.get(player.userId);
                if (callback)
                {
                    callback({ type: "timeout" });
                    callbacks.delete(player.userId);
                }
                queue.delete(player.id);
            }
        }

        const activePlayers = Array.from(queue.values());
        while (activePlayers.length >= 2)
        {
            const player1 = activePlayers.shift()!;
            const player2 = activePlayers.shift()!;

            const match: Match = {
                id: uuidv4(),
                player1: { userId: player1.userId, username: player1.username },
                player2: { userId: player2.userId, username: player2.username },
                createdAt: new Date().toISOString(),
            };

            const callback1 = callbacks.get(player1.userId);
            const callback2 = callbacks.get(player2.userId);

            if (callback1)
            {
                callback1({ type: "matched", match });
                callbacks.delete(player1.userId);
            }
            if (callback2)
            {
                callback2({ type: "matched", match });
                callbacks.delete(player2.userId);
            }

            queue.delete(player1.id);
            queue.delete(player2.id);
        }

        if (queue.size === 0 && loopInterval)
        {
            clearInterval(loopInterval);
            loopInterval = null;
        }
    }, CHECK_INTERVAL_MS);
}

export function addToQueue(userId: string, username: string, onEvent: EventCallback): string
{
    const connectionId = uuidv4();

    removeFromQueueByUserId(userId);

    const queueEntry: QueuedPlayer = {
        id: uuidv4(),
        connectionId,
        userId,
        username,
        joinedAt: Date.now(),
    };

    queue.set(queueEntry.id, queueEntry);
    callbacks.set(userId, onEvent);

    onEvent({ type: "queued" });

    startMatchmakingLoop();

    return connectionId;
}

export function removeFromQueueByUserId(userId: string): boolean
{
    for (const [key, player] of queue.entries())
    {
        if (player.userId === userId)
        {
            queue.delete(key);
            const callback = callbacks.get(userId);
            if (callback)
            {
                callback({ type: "cancelled" });
                callbacks.delete(userId);
            }
            return true;
        }
    }
    callbacks.delete(userId);
    return false;
}

export function removeFromQueueByConnection(userId: string, connectionId: string): boolean
{
    for (const [key, player] of queue.entries())
    {
        if (player.userId === userId)
        {
            if (player.connectionId === connectionId)
            {
                queue.delete(key);
                const callback = callbacks.get(userId);
                if (callback)
                {
                    callback({ type: "cancelled" });
                    callbacks.delete(userId);
                }
                return true;
            }
            return false;
        }
    }
    return false;
}

export function isUserInQueue(userId: string): boolean
{
    for (const player of queue.values())
    {
        if (player.userId === userId)
        {
            return true;
        }
    }
    return false;
}
