import { type ReactNode } from "react";
import { MatchmakingContext, useMatchmakingState } from "../hooks/useMatchmaking";

interface MatchmakingProviderProps
{
    children: ReactNode;
}

export function MatchmakingProvider({ children }: MatchmakingProviderProps)
{
    const matchmakingState = useMatchmakingState();

    return <MatchmakingContext.Provider value={matchmakingState}>{children}</MatchmakingContext.Provider>;
}
