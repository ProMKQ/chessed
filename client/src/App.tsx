import { AuthProvider } from "./context/AuthContext";
import { MatchmakingProvider } from "./context/MatchmakingContext";
import Header from "./components/Header";
import Matchmaking from "./components/Matchmaking";
import "./App.css";

function App()
{
    return (
        <AuthProvider>
            <MatchmakingProvider>
                <Header />
                <main className="main-content">
                    <Matchmaking />
                </main>
            </MatchmakingProvider>
        </AuthProvider>
    );
}

export default App;
