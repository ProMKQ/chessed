import { useCallback } from "react";
import { Chessboard } from "react-chessboard";
import type { Square, Piece } from "react-chessboard/dist/chessboard/types";
import { useGameplay, type GameResult } from "../gameplay";
import { useAuth } from "../hooks/useAuth";
import "./ChessBoard.css";

function formatEloChange(change: number | null): string
{
    if (change === null) return "";
    if (change > 0) return `+${change} ELO`;
    return `${change} ELO`;
}

interface FormattedResult
{
    message: string;
    eloChange: string;
}

function formatResult(result: GameResult, playerColor: "w" | "b", eloChange: number | null): FormattedResult
{
    const playerIsWhite = playerColor === "w";
    const eloStr = formatEloChange(eloChange);

    if (result.type === "checkmate")
    {
        const playerWon = (result.winner === "white" && playerIsWhite) || (result.winner === "black" && !playerIsWhite);
        return {
            message: playerWon ? "You won by checkmate!" : "You lost by checkmate.",
            eloChange: eloStr,
        };
    }

    if (result.type === "stalemate")
    {
        return {
            message: "Draw by stalemate.",
            eloChange: eloStr,
        };
    }

    if (result.type === "draw")
    {
        const reasons: Record<string, string> = {
            insufficient: "insufficient material",
            threefold: "threefold repetition",
            "fifty-move": "fifty-move rule",
        };
        return {
            message: `Draw by ${reasons[result.reason]}.`,
            eloChange: eloStr,
        };
    }

    if (result.type === "resign")
    {
        const playerWon = (result.winner === "white" && playerIsWhite) || (result.winner === "black" && !playerIsWhite);
        return {
            message: playerWon ? "You won by resignation!" : "You lost by resignation.",
            eloChange: eloStr,
        };
    }

    return { message: "", eloChange: "" };
}

export default function ChessBoard()
{
    const { gameState, makeMove, resign, leaveGame } = useGameplay();
    const { refreshUser } = useAuth();

    const handleLeaveGame = useCallback(async () =>
    {
        leaveGame();
        await refreshUser();
    }, [leaveGame, refreshUser]);

    const onDrop = useCallback(
        (sourceSquare: Square, targetSquare: Square, piece: Piece): boolean =>
        {
            if (!gameState || gameState.gameOver) return false;

            if (gameState.playerColor !== gameState.chess.turn()) return false;

            if (gameState.playerColor !== piece[0]) return false;

            makeMove(sourceSquare, targetSquare);
            return true;
        },
        [gameState, makeMove]
    );

    if (!gameState)
    {
        return null;
    }

    const isPlayerTurn = gameState.playerColor === gameState.chess.turn();

    const formattedResult =
        gameState.gameOver && gameState.result
            ? formatResult(gameState.result, gameState.playerColor, gameState.eloChange)
            : null;

    return (
        <div className="chess-game">
            <div className="player-name opponent-name">
                {gameState.opponent} ({gameState.opponentElo} ELO)
            </div>

            <div className="chess-board-container">
                <Chessboard
                    position={gameState.chess.fen()}
                    onPieceDrop={onDrop}
                    boardOrientation={gameState.playerColor === "w" ? "white" : "black"}
                    arePiecesDraggable={!gameState.gameOver && isPlayerTurn}
                    boardWidth={480}
                />
            </div>

            <div className="player-name your-name">
                {gameState.username} ({gameState.userElo} ELO)
            </div>

            <div className="game-status">
                {!gameState.gameOver && (
                    <>
                        <p className="turn-indicator">{isPlayerTurn ? "Your turn" : "Opponent's turn"}</p>
                        <button className="btn-resign" onClick={resign}>
                            Resign
                        </button>
                    </>
                )}

                {formattedResult && (
                    <>
                        <div className="game-result">
                            <p className="result-message">{formattedResult.message}</p>
                            {formattedResult.eloChange && <p className="result-elo">{formattedResult.eloChange}</p>}
                        </div>
                        <button className="btn-leave" onClick={handleLeaveGame}>
                            Leave Game
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
