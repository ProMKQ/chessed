import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { DEFAULT_ELO } from "../elo/elo.js";

export interface User
{
    id: string;
    username: string;
    password: string;
    salt: string;
    elo: number;
}

const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";

function hashPassword(password: string, salt: string): string
{
    return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
}

function generateSalt(): string
{
    return crypto.randomBytes(16).toString("hex");
}

const users: Map<string, User> = new Map();

export async function findUserByUsername(username: string): Promise<User | undefined>
{
    for (const id in users)
    {
        const user = users.get(id);
        if (user && user.username === username)
        {
            return user;
        }
    }
    return undefined;
}

export async function findUserById(id: string): Promise<User | undefined>
{
    return users.get(id);
}

export async function createUser(username: string, plainPassword: string): Promise<User>
{
    const id = uuidv4();
    const salt = generateSalt();
    const password = hashPassword(plainPassword, salt);

    const user: User = {
        id,
        username,
        password,
        salt,
        elo: DEFAULT_ELO,
    };
    users.set(id, user);

    return user;
}

export function verifyPassword(user: User, plainPassword: string): boolean
{
    const hash = hashPassword(plainPassword, user.salt);
    return crypto.timingSafeEqual(Buffer.from(user.password, "hex"), Buffer.from(hash, "hex"));
}

export function getUserPublicInfo(user: User)
{
    return {
        id: user.id,
        username: user.username,
        elo: user.elo,
    };
}

export async function updateUserElo(userId: string, newElo: number): Promise<boolean>
{
    const user = users.get(userId);
    if (!user)
    {
        return false;
    }
    user.elo = newElo;
    users.set(userId, user);
    return true;
}
