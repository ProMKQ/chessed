import type { GameResult } from "../gameplay/sessions.js";
import { getGameRepository } from "../database/dataSource.js";
import { GameEntity } from "../database/entities/Game.js";

export interface StoredGame
{
    whiteUserId: string;
    blackUserId: string;
    result: GameResult;
}

function entityToStoredGame(entity: GameEntity): StoredGame
{
    return {
        whiteUserId: entity.whiteUserId,
        blackUserId: entity.blackUserId,
        result: JSON.parse(entity.result) as GameResult,
    };
}

export async function storeGame(game: StoredGame): Promise<void>
{
    const repo = getGameRepository();
    const entity = repo.create({
        whiteUserId: game.whiteUserId,
        blackUserId: game.blackUserId,
        result: JSON.stringify(game.result),
    });
    await repo.save(entity);
}

export async function getAllGames(): Promise<StoredGame[]>
{
    const repo = getGameRepository();
    const entities = await repo.find();
    return entities.map(entityToStoredGame);
}

export async function getGamesForUser(userId: string): Promise<StoredGame[]>
{
    const repo = getGameRepository();
    const entities = await repo.find({
        where: [{ whiteUserId: userId }, { blackUserId: userId }],
    });
    return entities.map(entityToStoredGame);
}
