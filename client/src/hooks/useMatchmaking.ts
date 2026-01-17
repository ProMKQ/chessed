import { createContext, useContext, useState, useCallback, useRef } from "react";

export interface MatchmakingContextType
{
    isSearching: boolean;
    match: string | null;
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
    const [match, setMatch] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    const joinMatchmaking = useCallback(() =>
    {
        if (eventSourceRef.current)
        {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        setIsSearching(true);
        setError(null);

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
                    setIsSearching(false);
                    eventSource.close();
                    eventSourceRef.current = null;
                    setMatch(data.match.id);
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
    }, []);

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
