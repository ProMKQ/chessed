export const DEFAULT_ELO = 100;
const K_FACTOR = 32;

function expectedScore(playerRating: number, opponentRating: number): number
{
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

export function calculateNewRating(playerRating: number, opponentRating: number, actualScore: number): number
{
    const expected = expectedScore(playerRating, opponentRating);
    const newRating = playerRating + K_FACTOR * (actualScore - expected);
    return Math.round(newRating);
}

export function calculateEloChanges(
    whiteRating: number,
    blackRating: number,
    result: "white" | "black" | "draw"
): {
    whiteNewRating: number;
    blackNewRating: number;
    whiteChange: number;
    blackChange: number;
}
{
    let whiteScore: number;
    let blackScore: number;

    switch (result)
    {
        case "white":
            whiteScore = 1;
            blackScore = 0;
            break;
        case "black":
            whiteScore = 0;
            blackScore = 1;
            break;
        case "draw":
            whiteScore = 0.5;
            blackScore = 0.5;
            break;
    }

    const whiteNewRating = calculateNewRating(whiteRating, blackRating, whiteScore);
    const blackNewRating = calculateNewRating(blackRating, whiteRating, blackScore);

    return {
        whiteNewRating,
        blackNewRating,
        whiteChange: whiteNewRating - whiteRating,
        blackChange: blackNewRating - blackRating,
    };
}
