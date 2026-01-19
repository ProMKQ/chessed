import "reflect-metadata";
import { DataSource } from "typeorm";
import { UserEntity } from "./entities/User.js";
import { GameEntity } from "./entities/Game.js";

const NODE_ENV = process.env.NODE_ENV || "development";
const DATABASE_URL = process.env.DATABASE_URL;

const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true" || process.env.TEST === "true";

function createDataSource(): DataSource
{
    if (isTestEnv)
    {
        return new DataSource({
            type: "better-sqlite3",
            database: "chess-test.sqlite",
            entities: [UserEntity, GameEntity],
            synchronize: true,
            logging: false,
        });
    }

    if (NODE_ENV === "production" && DATABASE_URL)
    {
        return new DataSource({
            type: "postgres",
            url: DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            entities: [UserEntity, GameEntity],
            synchronize: true,
            logging: false,
        });
    }
    else
    {
        return new DataSource({
            type: "better-sqlite3",
            database: "chess.sqlite",
            entities: [UserEntity, GameEntity],
            synchronize: true,
            logging: false,
        });
    }
}

export const AppDataSource = createDataSource();

let initialized = false;

export async function initializeDatabase(): Promise<boolean>
{
    if (initialized) return true;

    await AppDataSource.initialize();

    if (AppDataSource.isInitialized)
    {
        initialized = true;
        return true;
    }

    return false;
}

export function getUserRepository()
{
    return AppDataSource.getRepository(UserEntity);
}

export function getGameRepository()
{
    return AppDataSource.getRepository(GameEntity);
}
