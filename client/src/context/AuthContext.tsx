import { useState, useEffect, type ReactNode } from "react";
import { AuthContext, type User } from "../hooks/useAuth";

interface AuthProviderProps
{
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps)
{
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async () =>
    {
        try
        {
            const response = await fetch("/api/auth/me", {
                credentials: "include",
            });
            if (response.ok)
            {
                const data = await response.json();
                setUser(data.user);
            }
            else
            {
                setUser(null);
            }
        }
        catch
        {
            setUser(null);
        }
        finally
        {
            setLoading(false);
        }
    };

    useEffect(() =>
    {
        refreshUser();
    }, []);

    const login = async (username: string, password: string) =>
    {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
            credentials: "include",
        });
        if (!response.ok)
        {
            const data = await response.json();
            throw new Error(data.error || "Login failed");
        }
        await refreshUser();
    };

    const register = async (username: string, password: string) =>
    {
        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
            credentials: "include",
        });
        if (!response.ok)
        {
            const data = await response.json();
            throw new Error(data.error || "Registration failed");
        }
        await refreshUser();
    };

    const logout = async () =>
    {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}
