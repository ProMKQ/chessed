import { createContext, useContext, useState, useCallback, useRef } from "react";
import { Chess } from "chess.js";

export interface MatchPlayer
{
    userId: string;
    username: string;
}

export type GameResult =
    | { type: "checkmate"; winner: "white" | "black" }
    | { type: "stalemate" }
    | { type: "draw"; reason: "insufficient" | "threefold" | "fifty-move" }
    | { type: "resign"; winner: "white" | "black" };

export interface ChessGameState
{
    chess: Chess;
    playerColor: "w" | "b";
    username: string;
    userElo: number;
    opponent: string;
    opponentElo: number;
    gameOver: boolean;
    result: GameResult | null;
    eloChange: number | null;
    opponentEloChange: number | null;
}

export interface GameplayContextType
{
    gameState: ChessGameState | null;
    isConnecting: boolean;
    isConnected: boolean;
    gameError: string | null;
    connectToGame: (matchId: string) => void;
    disconnectGame: () => void;
    clearGameError: () => void;
    makeMove: (from: string, to: string) => void;
    resign: () => void;
    leaveGame: () => void;
}

export const GameplayContext = createContext<GameplayContextType | null>(null);

export function useGameplay()
{
    const context = useContext(GameplayContext);
    if (!context)
    {
        throw new Error("useGameplay must be used within a GameplayProvider");
    }
    return context;
}

export function useGameplayState(): GameplayContextType
{
    const [gameState, setGameState] = useState<ChessGameState | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [gameError, setGameError] = useState<string | null>(null);
    const websocketRef = useRef<WebSocket | null>(null);

    const connectToGame = useCallback((matchId: string) =>
    {
        if (websocketRef.current)
        {
            websocketRef.current.close();
            websocketRef.current = null;
        }

        setIsConnecting(true);
        setGameState(null);
        setGameError(null);

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/game?matchId=${encodeURIComponent(matchId)}`;

        const ws = new WebSocket(wsUrl);
        websocketRef.current = ws;

        ws.onopen = () =>
        {
            setIsConnecting(false);
            setIsConnected(true);
        };

        ws.onmessage = (event) =>
        {
            const data = JSON.parse(event.data);

            if (data.type === "game_started")
            {
                const chess = new Chess(data.fen);
                setGameState({
                    chess,
                    playerColor: data.color,
                    username: data.username,
                    userElo: data.userElo,
                    opponent: data.opponent,
                    opponentElo: data.opponentElo,
                    gameOver: false,
                    result: null,
                    eloChange: null,
                    opponentEloChange: null,
                });
            }
            else if (data.type === "move")
            {
                setGameState((prev) =>
                {
                    if (!prev) return prev;
                    prev.chess.load(data.fen);
                    return {
                        ...prev,
                    };
                });
            }
            else if (data.type === "game_over")
            {
                setGameState((prev) =>
                {
                    if (!prev) return prev;
                    prev.chess.load(data.fen);
                    return {
                        ...prev,
                        gameOver: true,
                        result: data.result,
                        eloChange: data.eloChange,
                        opponentEloChange: data.opponentEloChange,
                    };
                });
            }
            else if (data.type === "move_error")
            {
                setGameState((prev) =>
                {
                    if (!prev) return prev;
                    if (data.fen)
                    {
                        prev.chess.load(data.fen);
                    }
                    return {
                        ...prev,
                    };
                });
            }
            else if (data.type === "session_error")
            {
                setGameError(data.message);
                setIsConnected(false);
                ws.close();
                websocketRef.current = null;
            }
        };

        ws.onerror = () =>
        {
            setGameError("Failed to connect to game session");
            setIsConnecting(false);
            setIsConnected(false);
            websocketRef.current = null;
        };

        ws.onclose = () =>
        {
            setIsConnecting(false);
            setIsConnected(false);
            websocketRef.current = null;
        };
    }, []);

    const disconnectGame = useCallback(() =>
    {
        if (websocketRef.current)
        {
            websocketRef.current.close();
            websocketRef.current = null;
        }
        setIsConnecting(false);
        setIsConnected(false);
        setGameState(null);
    }, []);

    const clearGameError = useCallback(() =>
    {
        setGameError(null);
    }, []);

    const makeMove = useCallback(
        (from: string, to: string) =>
        {
            if (!websocketRef.current || !gameState) return;

            try
            {
                gameState.chess.move({ from, to, promotion: "q" });
            }
            catch
            {
                return;
            }

            setGameState((prev) =>
            {
                if (!prev) return prev;
                return { ...prev };
            });

            websocketRef.current.send(
                JSON.stringify({
                    type: "move",
                    from,
                    to,
                    promotion: "q",
                })
            );
        },
        [gameState]
    );

    const resign = useCallback(() =>
    {
        if (!websocketRef.current) return;
        websocketRef.current.send(JSON.stringify({ type: "resign" }));
    }, []);

    const leaveGame = useCallback(() =>
    {
        if (websocketRef.current)
        {
            websocketRef.current.close();
            websocketRef.current = null;
        }
        setIsConnecting(false);
        setIsConnected(false);
        setGameState(null);
        setGameError(null);
    }, []);

    return {
        gameState,
        isConnecting,
        isConnected,
        gameError,
        connectToGame,
        disconnectGame,
        clearGameError,
        makeMove,
        resign,
        leaveGame,
    };
}
