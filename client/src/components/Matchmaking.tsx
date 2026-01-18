import { useMatchmaking } from "../hooks/useMatchmaking";
import { useAuth } from "../hooks/useAuth";
import { useGameplay } from "../gameplay";
import ChessBoard from "./ChessBoard";

function Matchmaking()
{
    const { user } = useAuth();
    const { isSearching, match, error, joinMatchmaking, leaveMatchmaking } = useMatchmaking();
    const { gameState, gameError } = useGameplay();

    if (!user)
    {
        return (
            <div className="matchmaking">
                <p>Please log in to play.</p>
            </div>
        );
    }

    if (gameState)
    {
        return (
            <div className="matchmaking">
                <ChessBoard />
            </div>
        );
    }

    if (match)
    {
        return (
            <div className="matchmaking">
                <div className="connecting">
                    <p>Connecting to game...</p>
                    <div className="loading-spinner"></div>
                    {(error || gameError) && <p className="error-message">{error || gameError}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="matchmaking">
            {error && <p className="error-message">{error}</p>}
            {isSearching ? (
                <div className="searching">
                    <p>Searching for opponent...</p>
                    <div className="loading-spinner"></div>
                    <button onClick={leaveMatchmaking}>Cancel</button>
                </div>
            ) : (
                <button className="btn-primary btn-large" onClick={joinMatchmaking}>
                    Find Game
                </button>
            )}
        </div>
    );
}

export default Matchmaking;
