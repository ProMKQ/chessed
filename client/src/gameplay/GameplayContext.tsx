import { type ReactNode } from "react";
import { GameplayContext, useGameplayState } from "./useGameplay";

interface GameplayProviderProps
{
    children: ReactNode;
}

export function GameplayProvider({ children }: GameplayProviderProps)
{
    const gameplayState = useGameplayState();

    return <GameplayContext.Provider value={gameplayState}>{children}</GameplayContext.Provider>;
}
