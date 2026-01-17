import { AuthProvider } from "./context/AuthContext";
import Header from "./components/Header";
import "./App.css";

function App()
{
    return (
        <AuthProvider>
            <Header />
            <main className="main-content"></main>
        </AuthProvider>
    );
}

export default App;
