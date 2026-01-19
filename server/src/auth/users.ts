import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { DEFAULT_ELO } from "../elo/elo.js";
import { getUserRepository } from "../database/dataSource.js";
import { UserEntity } from "../database/entities/User.js";

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

function entityToUser(entity: UserEntity): User
{
    return {
        id: entity.id,
        username: entity.username,
        password: entity.password,
        salt: entity.salt,
        elo: entity.elo,
    };
}

export async function findUserByUsername(username: string): Promise<User | undefined>
{
    const repo = getUserRepository();
    const entity = await repo.findOne({ where: { username } });
    return entity ? entityToUser(entity) : undefined;
}

export async function findUserById(id: string): Promise<User | undefined>
{
    const repo = getUserRepository();
    const entity = await repo.findOne({ where: { id } });
    return entity ? entityToUser(entity) : undefined;
}

export async function createUser(username: string, plainPassword: string): Promise<User>
{
    const id = uuidv4();
    const salt = generateSalt();
    const password = hashPassword(plainPassword, salt);

    const repo = getUserRepository();
    const entity = repo.create({
        id,
        username,
        password,
        salt,
        elo: DEFAULT_ELO,
    });
    await repo.save(entity);

    return entityToUser(entity);
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
    const repo = getUserRepository();
    const result = await repo.update({ id: userId }, { elo: newElo });
    return result.affected !== undefined && result.affected > 0;
}
