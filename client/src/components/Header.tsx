import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import AuthModal from "./AuthModal";

function Header()
{
    const { user, loading, logout } = useAuth();
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showRegisterModal, setShowRegisterModal] = useState(false);

    const handleLogout = async () =>
    {
        await logout();
    };

    if (loading)
    {
        return (
            <header className="header">
                <h1 className="header-title">Chessed</h1>
                <div className="header-actions">Loading...</div>
            </header>
        );
    }

    return (
        <>
            <header className="header">
                <h1 className="header-title">Chessed</h1>
                <div className="header-actions">
                    {user ? (
                        <div className="account-info">
                            <span className="account-username">
                                {user.username} ({user.elo} ELO)
                            </span>
                            <button onClick={handleLogout}>Logout</button>
                        </div>
                    ) : (
                        <>
                            <button onClick={() => setShowLoginModal(true)}>Login</button>
                            <button className="btn-primary" onClick={() => setShowRegisterModal(true)}>
                                Register
                            </button>
                        </>
                    )}
                </div>
            </header>

            {showLoginModal && <AuthModal mode="login" onClose={() => setShowLoginModal(false)} />}

            {showRegisterModal && <AuthModal mode="register" onClose={() => setShowRegisterModal(false)} />}
        </>
    );
}

export default Header;
