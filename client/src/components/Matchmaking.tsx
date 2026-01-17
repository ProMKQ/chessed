import { useMatchmaking } from "../hooks/useMatchmaking";
import { useAuth } from "../hooks/useAuth";

function Matchmaking()
{
    const { user } = useAuth();
    const { isSearching, match, error, joinMatchmaking, leaveMatchmaking } = useMatchmaking();

    if (!user)
    {
        return (
            <div className="matchmaking">
                <p>Please log in to play.</p>
            </div>
        );
    }

    if (match)
    {
        return <div className="matchmaking">Found match: {match}</div>;
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
