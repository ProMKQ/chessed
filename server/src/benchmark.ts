import http from "http";
import { URL } from "url";
import WebSocket from "ws";

const MATCHMAKING_TIMEOUT_MS = 2 * 60 * 1000;
const WEBSOCKET_CONNECTION_TIMEOUT_MS = 30 * 1000;
const RESIGN_DELAY_MS = 500;
const SPAWN_INTERVAL_MIN_MS = 1 * 1000;
const SPAWN_INTERVAL_MAX_MS = 5 * 1000;
const MIN_SESSIONS_PER_SPAWN = 2;
const MAX_SESSIONS_PER_SPAWN = 6;

interface BenchmarkConfig
{
    baseUrl: string;
    durationSeconds: number;
}

interface HttpRequestResult
{
    status: number;
    body: unknown;
}

let errorCount = 0;
let gameCount = 0;
let activeSessions = 0;
let totalSessionsSpawned = 0;

function randomUsername(): string
{
    return `bench_${Math.random().toString(36).substring(2, 14)}`;
}

function randomPassword(): string
{
    return Math.random().toString(36).substring(2, 14);
}

class BenchmarkSession
{
    private baseUrl: string;
    private cookie: string | null = null;
    private username: string;
    private password: string;
    private running = true;
    private sessionId: number;

    constructor(baseUrl: string, sessionId: number)
    {
        this.baseUrl = baseUrl;
        this.username = randomUsername();
        this.password = randomPassword();
        this.sessionId = sessionId;
    }

    private async httpRequest(method: string, path: string, body?: object): Promise<HttpRequestResult>
    {
        const url = new URL(path, this.baseUrl);

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.cookie)
        {
            headers["Cookie"] = this.cookie;
        }

        const response = await fetch(url.toString(), {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (response.status === 429)
        {
            throw new Error("Rate limited");
        }

        const setCookie = response.headers.get("set-cookie");
        if (setCookie)
        {
            this.cookie = setCookie.split(";")[0];
        }

        let responseBody: unknown;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json"))
        {
            try
            {
                responseBody = await response.json();
            }
            catch
            {
                responseBody = { error: "Invalid JSON response" };
            }
        }
        else
        {
            responseBody = { error: "No JSON response" };
        }

        return {
            status: response.status,
            body: responseBody,
        };
    }

    async register(): Promise<boolean>
    {
        try
        {
            this.cookie = null;

            const result = await this.httpRequest("POST", "/api/auth/register", {
                username: this.username,
                password: this.password,
            });

            if (result.status === 201)
            {
                return true;
            }
            else if (result.status === 409)
            {
                this.username = randomUsername();
                return this.register();
            }
            else
            {
                errorCount++;
                return false;
            }
        }
        catch (
            error: any // eslint-disable-line @typescript-eslint/no-explicit-any
        )
        {
            errorCount++;
            log(error);
            return false;
        }
    }

    async logout(): Promise<void>
    {
        try
        {
            await this.httpRequest("POST", "/api/auth/logout");

            this.cookie = null;
        }
        catch (
            error: any // eslint-disable-line @typescript-eslint/no-explicit-any
        )
        {
            errorCount++;
            log(error);
        }
    }

    private findGame(): Promise<string>
    {
        return new Promise((resolve, reject) =>
        {
            const url = new URL("/api/matchmaking/stream", this.baseUrl);

            let returned = false;

            const req = http.request(
                {
                    hostname: url.hostname,
                    port: url.port || (url.protocol === "https:" ? 443 : 80),
                    path: url.pathname,
                    method: "GET",
                    headers: {
                        Accept: "text/event-stream",
                        Cookie: this.cookie || "",
                    },
                },
                (res) =>
                {
                    if (res.statusCode !== 200)
                    {
                        if (!returned)
                        {
                            returned = true;
                            errorCount++;
                            reject(new Error(`Matchmaking failed with status ${res.statusCode}`));
                        }
                        return;
                    }

                    res.on("data", (chunk: Buffer) =>
                    {
                        const lines = chunk.toString().split("\n");
                        for (const line of lines)
                        {
                            if (line.startsWith("data: "))
                            {
                                try
                                {
                                    const data = JSON.parse(line.slice(6));

                                    if (data.type === "matched")
                                    {
                                        const match = data.match as { id: string };
                                        returned = true;
                                        resolve(match.id);
                                    }
                                    else if (data.type === "timeout" || data.type === "cancelled")
                                    {
                                        if (!returned)
                                        {
                                            returned = true;
                                            errorCount++;
                                            reject(new Error("Matchmaking timed out or cancelled"));
                                        }
                                    }
                                }
                                catch (
                                    error: any // eslint-disable-line @typescript-eslint/no-explicit-any
                                )
                                {
                                    errorCount++;
                                    log(error);
                                    if (!returned)
                                    {
                                        returned = true;
                                        reject(new Error("Invalid matchmaking stream data"));
                                    }
                                }
                            }
                        }
                    });

                    res.on("end", () =>
                    {
                        if (!returned)
                        {
                            returned = true;
                            errorCount++;
                            reject(new Error("Matchmaking stream ended unexpectedly"));
                        }
                    });

                    res.on("error", () =>
                    {
                        if (!returned)
                        {
                            returned = true;
                            errorCount++;
                            reject(new Error("Matchmaking stream error"));
                        }
                    });
                }
            );

            req.on("error", () =>
            {
                if (!returned)
                {
                    returned = true;
                    errorCount++;
                    reject(new Error("Matchmaking request error"));
                }
            });

            req.end();

            setTimeout(() =>
            {
                req.destroy();
                if (!returned)
                {
                    returned = true;
                    errorCount++;
                    reject(new Error("Matchmaking timeout"));
                }
            }, MATCHMAKING_TIMEOUT_MS);
        });
    }

    private getRandomPawnMove(color: "w" | "b"): { from: string; to: string } | null
    {
        const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
        if (color === "w")
        {
            const file = files[Math.floor(Math.random() * files.length)];
            const from = `${file}2`;
            const to = `${file}3`;
            return { from, to };
        }
        else
        {
            const file = files[Math.floor(Math.random() * files.length)];
            const from = `${file}7`;
            const to = `${file}6`;
            return { from, to };
        }
    }

    async playGame(matchId: string): Promise<void>
    {
        const url = new URL(this.baseUrl);
        const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${url.host}/game?matchId=${matchId}`;

        const ws = new WebSocket(wsUrl, {
            headers: {
                Cookie: this.cookie || "",
            },
        });

        try
        {
            await new Promise<void>((resolve, reject) =>
            {
                let color: "w" | "b" | null = null;
                let gameStarted = false;
                let hasMadeMove = false;

                let resolved = false;
                const tryResolve = () =>
                {
                    if (resolved) return;
                    resolved = true;
                    resolve();
                };

                const connectionTimeoutId = setTimeout(() =>
                {
                    if (ws.readyState === WebSocket.CONNECTING)
                    {
                        ws.close();
                        reject(new Error("WebSocket connection timeout"));
                    }
                }, WEBSOCKET_CONNECTION_TIMEOUT_MS);

                ws.on("open", () =>
                {
                    clearTimeout(connectionTimeoutId);
                });

                const play = () =>
                {
                    const move = this.getRandomPawnMove(color!);
                    if (move && ws.readyState === WebSocket.OPEN)
                    {
                        hasMadeMove = true;
                        ws.send(JSON.stringify({ type: "move", from: move.from, to: move.to }));
                        setTimeout(() =>
                        {
                            if (ws.readyState === WebSocket.OPEN)
                            {
                                ws.send(JSON.stringify({ type: "resign" }));
                            }
                        }, RESIGN_DELAY_MS);
                    }
                };

                ws.on("message", (data: Buffer) =>
                {
                    try
                    {
                        const message = JSON.parse(data.toString());

                        if (message.type === "game_started" && message.color)
                        {
                            color = message.color;
                            gameStarted = true;

                            if (message.turn === color && color)
                            {
                                play();
                            }
                        }
                        else if (message.type === "move" && gameStarted && !hasMadeMove && color)
                        {
                            play();
                        }
                        else if (message.type === "game_over")
                        {
                            gameCount++;
                            tryResolve();
                        }
                    }
                    catch (
                        error: any // eslint-disable-line @typescript-eslint/no-explicit-any
                    )
                    {
                        errorCount++;
                        log(error);
                    }
                });

                ws.on("close", () =>
                {
                    tryResolve();
                });
            });

            await delay(500);
        }
        catch (
            error: any // eslint-disable-line @typescript-eslint/no-explicit-any
        )
        {
            errorCount++;
            log(error);
        }
        finally
        {
            ws.close();
        }
    }

    async run(): Promise<void>
    {
        activeSessions++;
        log(`Session ${this.sessionId}: Started`);

        try
        {
            const registered = await this.register();
            if (!registered)
            {
                activeSessions--;
                log(`Session ${this.sessionId}: Ended (Failed to register)`);
                return;
            }

            while (this.running)
            {
                try
                {
                    await this.playGame(await this.findGame());
                }
                catch (
                    error: any // eslint-disable-line @typescript-eslint/no-explicit-any
                )
                {
                    errorCount++;
                    log(error);
                    break;
                }

                if (Math.random() < 0.5)
                {
                    await delay(1000 + Math.random() * 2000);
                }
                else
                {
                    break;
                }
            }

            await this.logout();
        }
        catch (
            error: any // eslint-disable-line @typescript-eslint/no-explicit-any
        )
        {
            errorCount++;
            log(error);
        }
        finally
        {
            activeSessions--;
            log(`Session ${this.sessionId}: Ended`);
        }
    }

    stop(): void
    {
        this.running = false;
    }
}

async function runBenchmark(config: BenchmarkConfig): Promise<void>
{
    const sessions: BenchmarkSession[] = [];
    const startTime = Date.now();
    const endTime = startTime + config.durationSeconds * 1000;

    while (Date.now() < endTime)
    {
        const spawnCount =
            MIN_SESSIONS_PER_SPAWN + Math.floor(Math.random() * (MAX_SESSIONS_PER_SPAWN - MIN_SESSIONS_PER_SPAWN + 1));

        for (let i = 0; i < spawnCount; i++)
        {
            totalSessionsSpawned++;
            const session = new BenchmarkSession(config.baseUrl, totalSessionsSpawned);
            sessions.push(session);
            session.run().catch((error) =>
            {
                errorCount++;
                log(error);
            });
        }

        const spawnDelay = SPAWN_INTERVAL_MIN_MS + Math.random() * (SPAWN_INTERVAL_MAX_MS - SPAWN_INTERVAL_MIN_MS);
        await delay(spawnDelay);
    }

    for (const session of sessions)
    {
        session.stop();
    }

    const waitStart = Date.now();
    while (activeSessions > 0 && Date.now() - waitStart < 30000)
    {
        await delay(2000);
    }

    log("");
    log("Result");
    log(`Sessions Spawned: ${totalSessionsSpawned}`);
    log(`Games Played: ${gameCount}`);
    log(`Errors: ${errorCount}`);
}

function delay(ms: number): Promise<void>
{
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(): BenchmarkConfig
{
    const args = process.argv.slice(2);
    const config: BenchmarkConfig = {
        baseUrl: "http://localhost:3001",
        durationSeconds: 60,
    };

    for (let i = 0; i < args.length; i++)
    {
        if (args[i] === "--url" && args[i + 1])
        {
            config.baseUrl = args[i + 1];
            i++;
        }
        else if (args[i] === "--duration" && args[i + 1])
        {
            const duration = parseInt(args[i + 1], 10);
            if (!isNaN(duration) && duration > 0)
            {
                config.durationSeconds = duration;
            }
            i++;
        }
    }

    return config;
}

function log(message: string): void
{
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

const config = parseArgs();

await runBenchmark(config);

log("Benchmark completed");
process.exit(0);
