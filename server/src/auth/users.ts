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

async function hashPassword(password: string, salt: string): Promise<string>
{
    return new Promise((resolve, reject) =>
    {
        crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, hash) =>
        {
            if (err)
            {
                reject(err);
            }
            else
            {
                resolve(hash.toString("hex"));
            }
        });
    });
}

async function generateSalt(): Promise<string>
{
    return new Promise((resolve, reject) =>
    {
        crypto.randomBytes(16, (err, buf) =>
        {
            if (err)
            {
                reject(err);
            }
            else
            {
                resolve(buf.toString("hex"));
            }
        });
    });
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
    const salt = await generateSalt();
    const password = await hashPassword(plainPassword, salt);

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

export async function verifyPassword(user: User, plainPassword: string): Promise<boolean>
{
    const hash = await hashPassword(plainPassword, user.salt);
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
