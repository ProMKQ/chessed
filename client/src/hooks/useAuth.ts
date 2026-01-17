import { createContext, useContext } from "react";

export interface User
{
    id: string;
    username: string;
}

export interface AuthContextType
{
    user: User | null;
    loading: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth()
{
    const context = useContext(AuthContext);
    if (!context)
    {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
