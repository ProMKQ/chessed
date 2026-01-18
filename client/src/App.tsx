import { AuthProvider } from "./context/AuthContext";
import { MatchmakingProvider } from "./context/MatchmakingContext";
import { GameplayProvider } from "./gameplay";
import Header from "./components/Header";
import Matchmaking from "./components/Matchmaking";
import "./App.css";

function App()
{
    return (
        <AuthProvider>
            <GameplayProvider>
                <MatchmakingProvider>
                    <Header />
                    <main className="main-content">
                        <Matchmaking />
                    </main>
                </MatchmakingProvider>
            </GameplayProvider>
        </AuthProvider>
    );
}

export default App;
