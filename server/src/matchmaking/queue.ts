import { v4 as uuidv4 } from "uuid";
import { createSession } from "../gameplay/sessions.js";

export interface QueuedPlayer
{
    id: string;
    connectionId: string;
    userId: string;
    username: string;
    elo: number;
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
const INITIAL_ELO_RANGE = 50;
const ELO_RANGE_EXPANSION_RATE = 10;
const MAX_ELO_RANGE = 500;

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
        const matchedPlayerIds = new Set<string>();

        activePlayers.sort((a, b) => a.joinedAt - b.joinedAt);

        for (const player of activePlayers)
        {
            if (matchedPlayerIds.has(player.id)) continue;

            const waitTime = (now - player.joinedAt) / 1000;
            const currentEloRange = Math.min(INITIAL_ELO_RANGE + waitTime * ELO_RANGE_EXPANSION_RATE, MAX_ELO_RANGE);

            let bestMatch: QueuedPlayer | null = null;
            let bestEloDiff = Infinity;

            for (const opponent of activePlayers)
            {
                if (opponent.id === player.id) continue;
                if (matchedPlayerIds.has(opponent.id)) continue;

                const eloDiff = Math.abs(player.elo - opponent.elo);

                if (eloDiff <= currentEloRange)
                {
                    const opponentWaitTime = (now - opponent.joinedAt) / 1000;
                    const opponentEloRange = Math.min(
                        INITIAL_ELO_RANGE + opponentWaitTime * ELO_RANGE_EXPANSION_RATE,
                        MAX_ELO_RANGE
                    );

                    if (eloDiff <= opponentEloRange && eloDiff < bestEloDiff)
                    {
                        bestMatch = opponent;
                        bestEloDiff = eloDiff;
                    }
                }
            }

            if (bestMatch)
            {
                matchedPlayerIds.add(player.id);
                matchedPlayerIds.add(bestMatch.id);

                const match: Match = {
                    id: uuidv4(),
                    player1: { userId: player.userId, username: player.username },
                    player2: { userId: bestMatch.userId, username: bestMatch.username },
                    createdAt: new Date().toISOString(),
                };

                await createSession(match.id, match.player1, match.player2);

                const callback1 = callbacks.get(player.userId);
                const callback2 = callbacks.get(bestMatch.userId);

                if (callback1)
                {
                    callback1({ type: "matched", match });
                    callbacks.delete(player.userId);
                }
                if (callback2)
                {
                    callback2({ type: "matched", match });
                    callbacks.delete(bestMatch.userId);
                }

                queue.delete(player.id);
                queue.delete(bestMatch.id);
            }
        }

        if (queue.size === 0 && loopInterval)
        {
            clearInterval(loopInterval);
            loopInterval = null;
        }
    }, CHECK_INTERVAL_MS);
}

export function addToQueue(userId: string, username: string, elo: number, onEvent: EventCallback): string
{
    const connectionId = uuidv4();

    removeFromQueueByUserId(userId);

    const queueEntry: QueuedPlayer = {
        id: uuidv4(),
        connectionId,
        userId,
        username,
        elo,
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
