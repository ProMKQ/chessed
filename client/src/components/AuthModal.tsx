import { useState, type FormEvent, type MouseEvent } from "react";
import { useAuth } from "../hooks/useAuth";

interface AuthModalProps
{
    mode: "login" | "register";
    onClose: () => void;
}

function AuthModal({ mode, onClose }: AuthModalProps)
{
    const { login, register } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: FormEvent) =>
    {
        e.preventDefault();

        setError("");
        setIsSubmitting(true);

        try
        {
            if (mode === "login")
            {
                await login(username, password);
            }
            else
            {
                await register(username, password);
            }
            onClose();
        }
        catch (err)
        {
            setError(err instanceof Error ? err.message : "An error occurred");
        }
        finally
        {
            setIsSubmitting(false);
        }
    };

    const handleOverlayClick = (e: MouseEvent) =>
    {
        if (e.target === e.currentTarget)
        {
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal">
                <h2>{mode === "login" ? "Login" : "Register"}</h2>
                <form className="modal-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete={mode === "login" ? "current-password" : "new-password"}
                        />
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    <div className="modal-actions">
                        <button type="button" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? "Loading..." : mode === "login" ? "Login" : "Register"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AuthModal;
