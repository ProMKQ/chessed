import { describe, it, expect } from "vitest";
import { DEFAULT_ELO, calculateNewRating, calculateEloChanges } from "./elo.js";

describe("ELO Module", () =>
{
    describe("DEFAULT_ELO", () =>
    {
        it("should be 100", () =>
        {
            expect(DEFAULT_ELO).toBe(100);
        });
    });

    describe("calculateNewRating", () =>
    {
        describe("with equal ratings", () =>
        {
            it("should gain rating on win (1500 vs 1500)", () =>
            {
                // Expected score = 0.5, actual = 1
                // Change = 32 * (1 - 0.5) = 16
                const newRating = calculateNewRating(1500, 1500, 1);
                expect(newRating).toBe(1516);
            });

            it("should lose rating on loss (1500 vs 1500)", () =>
            {
                // Expected score = 0.5, actual = 0
                // Change = 32 * (0 - 0.5) = -16
                const newRating = calculateNewRating(1500, 1500, 0);
                expect(newRating).toBe(1484);
            });

            it("should have no change on draw (1500 vs 1500)", () =>
            {
                // Expected score = 0.5, actual = 0.5
                // Change = 32 * (0.5 - 0.5) = 0
                const newRating = calculateNewRating(1500, 1500, 0.5);
                expect(newRating).toBe(1500);
            });
        });

        describe("with higher rated player winning", () =>
        {
            it("should gain minimal rating when higher player wins (2000 vs 1600)", () =>
            {
                // Higher rated player expected to win
                // Expected score = 0.909
                // Change = 32 * (1 - 0.909) = 2.9 => rounds to 3
                const newRating = calculateNewRating(2000, 1600, 1);
                expect(newRating).toBe(2003);
            });

            it("should lose minimal rating when higher player loses (2000 vs 1600)", () =>
            {
                // Higher rated player expected to win but lost
                // Expected score = 0.909
                // Change = 32 * (0 - 0.909) = -29.1 => rounds to -29
                const newRating = calculateNewRating(2000, 1600, 0);
                expect(newRating).toBe(1971);
            });
        });

        describe("with lower rated player winning (upset)", () =>
        {
            it("should gain maximum rating when lower player wins (1200 vs 1800)", () =>
            {
                // Lower rated player has very low expected score
                // Expected score = 0.031
                // Change = 32 * (1 - 0.031) = 31 => rounds to 31
                const newRating = calculateNewRating(1200, 1800, 1);
                expect(newRating).toBe(1231);
            });

            it("should lose minimal rating when lower player loses (1200 vs 1800)", () =>
            {
                // Lower rated player expected to lose
                // Expected score = 0.031
                // Change = 32 * (0 - 0.031) = -1
                const newRating = calculateNewRating(1200, 1800, 0);
                expect(newRating).toBe(1199);
            });
        });

        describe("with moderate rating difference", () =>
        {
            it("should calculate correctly for 200 point difference on win (1600 vs 1400)", () =>
            {
                // Expected score = 0.76
                // Change = 32 * (1 - 0.76) = 7.7 => rounds to 8
                const newRating = calculateNewRating(1600, 1400, 1);
                expect(newRating).toBe(1608);
            });

            it("should calculate correctly for 200 point difference on loss (1600 vs 1400)", () =>
            {
                // Expected score = 0.76
                // Change = 32 * (0 - 0.76) = -24.3 => rounds to -24
                const newRating = calculateNewRating(1600, 1400, 0);
                expect(newRating).toBe(1576);
            });

            it("should calculate correctly for draw with 200 point difference", () =>
            {
                // Higher rated player drawing with lower rated loses rating
                // Expected score = 0.76
                // Change = 32 * (0.5 - 0.76) = -8.3 => rounds to -8
                const newRating = calculateNewRating(1600, 1400, 0.5);
                expect(newRating).toBe(1592);
            });
        });

        describe("edge cases", () =>
        {
            it("should handle very low ratings (100 vs 100)", () =>
            {
                const newRating = calculateNewRating(100, 100, 1);
                expect(newRating).toBe(116);
            });

            it("should handle very high ratings (2800 vs 2800)", () =>
            {
                const newRating = calculateNewRating(2800, 2800, 1);
                expect(newRating).toBe(2816);
            });

            it("should handle large rating difference (1000 vs 2000)", () =>
            {
                // Expected score for lower player = 0.0032
                // Win: Change = 32 * (1 - 0.0032) = 32
                const newRating = calculateNewRating(1000, 2000, 1);
                expect(newRating).toBe(1032);
            });
        });
    });

    describe("calculateEloChanges", () =>
    {
        describe("white wins", () =>
        {
            it("should calculate changes for equal ratings (1500 vs 1500)", () =>
            {
                const result = calculateEloChanges(1500, 1500, "white");
                expect(result.whiteNewRating).toBe(1516);
                expect(result.blackNewRating).toBe(1484);
                expect(result.whiteChange).toBe(16);
                expect(result.blackChange).toBe(-16);
            });

            it("should calculate changes for higher rated white winning (1800 vs 1400)", () =>
            {
                const result = calculateEloChanges(1800, 1400, "white");
                // White expected to win, minimal gain
                expect(result.whiteChange).toBeGreaterThan(0);
                expect(result.whiteChange).toBeLessThan(10);
                // Black loses similar amount
                expect(result.blackChange).toBeLessThan(0);
                expect(result.blackChange).toBeGreaterThan(-10);
            });

            it("should calculate changes for lower rated white winning (upset) (1200 vs 1800)", () =>
            {
                const result = calculateEloChanges(1200, 1800, "white");
                // White gained a lot
                expect(result.whiteChange).toBeGreaterThan(25);
                // Black lost a lot
                expect(result.blackChange).toBeLessThan(-25);
            });
        });

        describe("black wins", () =>
        {
            it("should calculate changes for equal ratings (1500 vs 1500)", () =>
            {
                const result = calculateEloChanges(1500, 1500, "black");
                expect(result.whiteNewRating).toBe(1484);
                expect(result.blackNewRating).toBe(1516);
                expect(result.whiteChange).toBe(-16);
                expect(result.blackChange).toBe(16);
            });

            it("should calculate changes for higher rated black winning (1200 vs 1800)", () =>
            {
                const result = calculateEloChanges(1200, 1800, "black");
                // Black expected to win, minimal gain
                expect(result.blackChange).toBeGreaterThan(0);
                expect(result.blackChange).toBeLessThan(5);
                // White loses minimal amount
                expect(result.whiteChange).toBeLessThan(0);
                expect(result.whiteChange).toBeGreaterThan(-5);
            });

            it("should calculate changes for lower rated black winning (upset) (1800 vs 1200)", () =>
            {
                const result = calculateEloChanges(1800, 1200, "black");
                // Black gained a lot
                expect(result.blackChange).toBeGreaterThan(25);
                // White lost a lot
                expect(result.whiteChange).toBeLessThan(-25);
            });
        });

        describe("draw", () =>
        {
            it("should calculate changes for equal ratings (1500 vs 1500)", () =>
            {
                const result = calculateEloChanges(1500, 1500, "draw");
                expect(result.whiteNewRating).toBe(1500);
                expect(result.blackNewRating).toBe(1500);
                expect(result.whiteChange).toBe(0);
                expect(result.blackChange).toBe(0);
            });

            it("should favor lower rated player in draw (1800 vs 1400)", () =>
            {
                const result = calculateEloChanges(1800, 1400, "draw");
                // Higher rated white loses rating on draw
                expect(result.whiteChange).toBeLessThan(0);
                // Lower rated black gains rating on draw
                expect(result.blackChange).toBeGreaterThan(0);
                // Changes should be symmetric (opposite)
                expect(result.whiteChange).toBe(-result.blackChange);
            });

            it("should favor lower rated player in draw (1200 vs 1800)", () =>
            {
                const result = calculateEloChanges(1200, 1800, "draw");
                // Lower rated white gains rating on draw
                expect(result.whiteChange).toBeGreaterThan(0);
                // Higher rated black loses rating on draw
                expect(result.blackChange).toBeLessThan(0);
            });
        });

        describe("symmetry", () =>
        {
            it("should have symmetric ELO changes (zero sum game)", () =>
            {
                const result = calculateEloChanges(1500, 1500, "white");
                expect(result.whiteChange + result.blackChange).toBe(0);
            });

            it("should have symmetric changes with rating difference", () =>
            {
                const result = calculateEloChanges(1600, 1400, "white");
                expect(result.whiteChange + result.blackChange).toBe(0);
            });

            it("should have symmetric changes on draw", () =>
            {
                const result = calculateEloChanges(1800, 1200, "draw");
                expect(result.whiteChange + result.blackChange).toBe(0);
            });
        });

        describe("consistency with DEFAULT_ELO", () =>
        {
            it("should work correctly with DEFAULT_ELO values", () =>
            {
                const result = calculateEloChanges(DEFAULT_ELO, DEFAULT_ELO, "white");
                expect(result.whiteNewRating).toBe(116);
                expect(result.blackNewRating).toBe(84);
                expect(result.whiteChange).toBe(16);
                expect(result.blackChange).toBe(-16);
            });
        });
    });
});
