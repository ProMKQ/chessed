import { createContext, useContext, useState, useCallback, useRef, useMemo } from "react";
import { useGameplay, type MatchPlayer } from "../gameplay";

export interface Match
{
    id: string;
    player1: MatchPlayer;
    player2: MatchPlayer;
    createdAt: string;
}

export interface MatchmakingContextType
{
    isSearching: boolean;
    match: Match | null;
    error: string | null;
    joinMatchmaking: () => void;
    leaveMatchmaking: () => void;
}

export const MatchmakingContext = createContext<MatchmakingContextType | null>(null);

export function useMatchmaking()
{
    const context = useContext(MatchmakingContext);
    if (!context)
    {
        throw new Error("useMatchmaking must be used within a MatchmakingProvider");
    }
    return context;
}

export function useMatchmakingState(): MatchmakingContextType
{
    const [isSearching, setIsSearching] = useState(false);
    const [rawMatch, setRawMatch] = useState<Match | null>(null);
    const [error, setError] = useState<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const { gameState, isConnecting, isConnected, connectToGame, disconnectGame } = useGameplay();

    const match = useMemo(() =>
    {
        if (!rawMatch) return null;
        if (gameState) return rawMatch;
        if (isConnecting || isConnected) return rawMatch;
        return null;
    }, [rawMatch, gameState, isConnecting, isConnected]);

    const joinMatchmaking = useCallback(() =>
    {
        if (eventSourceRef.current)
        {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        disconnectGame();

        setIsSearching(true);
        setError(null);
        setRawMatch(null);

        const eventSource = new EventSource("/api/matchmaking/stream", {
            withCredentials: true,
        });
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) =>
        {
            const data = JSON.parse(event.data);

            switch (data.type)
            {
                case "queued":
                    break;
                case "matched":
                    setRawMatch(data.match);
                    setIsSearching(false);
                    eventSource.close();
                    eventSourceRef.current = null;
                    connectToGame(data.match.id);
                    break;
                case "timeout":
                    setError("Did not find a match in time. Please try again later.");
                    setIsSearching(false);
                    eventSource.close();
                    eventSourceRef.current = null;
                    break;
                case "cancelled":
                    setIsSearching(false);
                    eventSource.close();
                    eventSourceRef.current = null;
                    break;
            }
        };

        eventSource.onerror = () =>
        {
            setError("Could not connect to the server. Please try again later.");
            setIsSearching(false);
            eventSource.close();
            eventSourceRef.current = null;
        };
    }, [connectToGame, disconnectGame]);

    const leaveMatchmaking = useCallback(() =>
    {
        if (eventSourceRef.current)
        {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setIsSearching(false);
        setError(null);
    }, []);

    return {
        isSearching,
        match,
        error,
        joinMatchmaking,
        leaveMatchmaking,
    };
}
