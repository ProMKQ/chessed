import { spawn, ChildProcess } from "child_process";
import http from "http";
import WebSocket from "ws";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_PORT = 3099;
const DELAY_MS = 100;
const SERVER_STARTUP_TIMEOUT = 10000;
const FORCE_KILL_TIMEOUT_MS = 5000;
const TEST_DB_PATH = path.join(__dirname, "..", "chess-test.sqlite");

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function log(message: string): void
{
    console.log(`[E2E] ${message}`);
}

function logError(message: string): void
{
    console.error(`[E2E ERROR] ${message}`);
}

function delay(ms: number): Promise<void>
{
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomUsername(prefix: string): string
{
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `${prefix.substring(0, 5)}${randomPart}`.substring(0, 20);
}

async function startServer(): Promise<ChildProcess>
{
    const serverPath = path.join(__dirname, "..", "index.ts");

    log(`Starting server from ${serverPath} on port ${SERVER_PORT}...`);

    const serverProcess = spawn(`npx tsx "${serverPath}"`, [], {
        env: {
            ...process.env,
            TEST: "true",
            PORT: String(SERVER_PORT),
            NODE_ENV: "development",
        },
        stdio: ["pipe", "pipe", "pipe"],
        cwd: path.join(__dirname, ".."),
        shell: true,
    });

    serverProcess.stdout?.on("data", (data) =>
    {
        const output = data.toString().trim();
        if (output)
        {
            console.log(`[SERVER] ${output}`);
        }
    });

    serverProcess.stderr?.on("data", (data) =>
    {
        const output = data.toString().trim();
        if (output)
        {
            console.error(`[SERVER ERROR] ${output}`);
        }
    });

    const startTime = Date.now();
    while (Date.now() - startTime < SERVER_STARTUP_TIMEOUT)
    {
        try
        {
            const response = await fetch(`http://localhost:${SERVER_PORT}/api/hello`);
            if (response.ok)
            {
                log("Server is ready");
                return serverProcess;
            }
        }
        catch
        {
            // ignore
        }
        await delay(100);
    }

    serverProcess.kill();
    throw new Error("Server failed to start within timeout");
}

function stopServer(serverProcess: ChildProcess): Promise<void>
{
    return new Promise((resolve) =>
    {
        if (serverProcess.killed)
        {
            resolve();
            return;
        }

        serverProcess.on("exit", () =>
        {
            resolve();
        });

        serverProcess.kill("SIGTERM");

        setTimeout(() =>
        {
            if (!serverProcess.killed)
            {
                serverProcess.kill("SIGKILL");
            }
            resolve();
        }, FORCE_KILL_TIMEOUT_MS);
    });
}

class TestClient
{
    private readonly baseUrl: string;
    private cookie: string | null = null;

    constructor(port: number)
    {
        this.baseUrl = `http://localhost:${port}`;
    }

    async register(username: string, password: string): Promise<{ status: number; body: unknown }>
    {
        const res = await fetch(`${this.baseUrl}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        const setCookie = res.headers.get("set-cookie");
        if (setCookie)
        {
            this.cookie = setCookie.split(";")[0];
        }

        const body = await res.json();
        return { status: res.status, body };
    }

    async login(username: string, password: string): Promise<{ status: number; body: unknown }>
    {
        const res = await fetch(`${this.baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        const setCookie = res.headers.get("set-cookie");
        if (setCookie)
        {
            this.cookie = setCookie.split(";")[0];
        }

        const body = await res.json();
        return { status: res.status, body };
    }

    async logout(): Promise<{ status: number; body: unknown }>
    {
        const headers: Record<string, string> = {};
        if (this.cookie)
        {
            headers.Cookie = this.cookie;
        }

        const res = await fetch(`${this.baseUrl}/api/auth/logout`, {
            method: "POST",
            headers,
        });

        const body = await res.json();
        this.cookie = null;
        return { status: res.status, body };
    }

    async getMe(): Promise<{ status: number; body: unknown }>
    {
        const headers: Record<string, string> = {};
        if (this.cookie)
        {
            headers.Cookie = this.cookie;
        }

        const res = await fetch(`${this.baseUrl}/api/auth/me`, {
            method: "GET",
            headers,
        });

        const body = await res.json();
        return { status: res.status, body };
    }

    startMatchmaking(): Promise<{
        events: Array<{ type: string; [key: string]: unknown }>;
        close: () => void;
    }>
    {
        return new Promise((resolve, reject) =>
        {
            const events: Array<{ type: string; [key: string]: unknown }> = [];
            let resolved = false;

            const url = new URL(`${this.baseUrl}/api/matchmaking/stream`);

            const req = http.request(
                {
                    hostname: url.hostname,
                    port: url.port,
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
                        reject(new Error(`SSE request failed with status ${res.statusCode}`));
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
                                    events.push(data);

                                    if (
                                        !resolved &&
                                        (data.type === "matched" ||
                                            data.type === "timeout" ||
                                            data.type === "cancelled")
                                    )
                                    {
                                        resolved = true;
                                        resolve({
                                            events,
                                            close: () => req.destroy(),
                                        });
                                    }
                                }
                                catch
                                {
                                    // ignore
                                }
                            }
                        }
                    });

                    res.on("end", () =>
                    {
                        if (!resolved)
                        {
                            resolve({ events, close: () =>
                            {} });
                        }
                    });
                }
            );

            req.on("error", (err: Error) =>
            {
                if (!resolved)
                {
                    reject(err);
                }
            });

            req.end();

            setTimeout(() =>
            {
                if (!resolved)
                {
                    resolved = true;
                    resolve({ events, close: () => req.destroy() });
                }
            }, 10000);
        });
    }

    connectToGame(
        port: number,
        matchId: string
    ): Promise<{
        ws: WebSocket;
        messages: Array<{ type: string; [key: string]: unknown }>;
        waitForMessage: (type: string, timeout?: number) => Promise<{ type: string; [key: string]: unknown }>;
        send: (message: object) => void;
        close: () => void;
    }>
    {
        return new Promise((resolve, reject) =>
        {
            const messages: Array<{ type: string; [key: string]: unknown }> = [];
            const messageListeners: Array<{
                type: string;
                resolve: (msg: { type: string; [key: string]: unknown }) => void;
                reject: (err: Error) => void;
            }> = [];

            const ws = new WebSocket(`ws://localhost:${port}/game?matchId=${matchId}`, {
                headers: {
                    Cookie: this.cookie || "",
                },
            });

            ws.on("open", () =>
            {
                resolve({
                    ws,
                    messages,
                    waitForMessage: (type: string, timeout = 5000) =>
                    {
                        const existing = messages.find((m) => m.type === type);
                        if (existing)
                        {
                            return Promise.resolve(existing);
                        }

                        return new Promise((res, rej) =>
                        {
                            const timeoutId = setTimeout(() =>
                            {
                                rej(new Error(`Timeout waiting for message type: ${type}`));
                            }, timeout);

                            messageListeners.push({
                                type,
                                resolve: (msg) =>
                                {
                                    clearTimeout(timeoutId);
                                    res(msg);
                                },
                                reject: rej,
                            });
                        });
                    },
                    send: (message: object) => ws.send(JSON.stringify(message)),
                    close: () => ws.close(),
                });
            });

            ws.on("message", (data: Buffer) =>
            {
                try
                {
                    const msg = JSON.parse(data.toString());
                    messages.push(msg);

                    for (let i = messageListeners.length - 1; i >= 0; i--)
                    {
                        if (messageListeners[i].type === msg.type)
                        {
                            messageListeners[i].resolve(msg);
                            messageListeners.splice(i, 1);
                        }
                    }
                }
                catch
                {
                    // ignore
                }
            });

            ws.on("error", (err) =>
            {
                reject(err);
            });
        });
    }

    getCookie(): string | null
    {
        return this.cookie;
    }
}

function assert(condition: boolean, message: string): void
{
    if (!condition)
    {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function assertEqual<T>(actual: T, expected: T, message: string): void
{
    if (actual !== expected)
    {
        throw new Error(
            `Assertion failed: ${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`
        );
    }
}

function assertDeepEqual<T>(actual: T, expected: T, message: string): void
{
    if (JSON.stringify(actual) !== JSON.stringify(expected))
    {
        throw new Error(
            `Assertion failed: ${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`
        );
    }
}

async function testFullGameFlow(): Promise<void>
{
    log("Testing: Full game flow (register, matchmake, resign, logout)");

    const client1 = new TestClient(SERVER_PORT);
    const client2 = new TestClient(SERVER_PORT);
    const username1 = randomUsername("player1");
    const username2 = randomUsername("player2");

    await delay(DELAY_MS);
    const reg1 = await client1.register(username1, "password123");
    assertEqual(reg1.status, 201, "Client 1 registration status");
    assertDeepEqual(reg1.body, { success: true }, "Client 1 registration body");

    await delay(DELAY_MS);
    const reg2 = await client2.register(username2, "password123");
    assertEqual(reg2.status, 201, "Client 2 registration status");
    assertDeepEqual(reg2.body, { success: true }, "Client 2 registration body");

    await delay(DELAY_MS);
    const me1 = await client1.getMe();
    assertEqual(me1.status, 200, "Client 1 getMe status");
    assertEqual((me1.body as { user: { username: string } }).user.username, username1, "Client 1 username");

    const me2 = await client2.getMe();
    assertEqual(me2.status, 200, "Client 2 getMe status");
    assertEqual((me2.body as { user: { username: string } }).user.username, username2, "Client 2 username");

    await delay(DELAY_MS);
    const [matchResult1, matchResult2] = await Promise.all([client1.startMatchmaking(), client2.startMatchmaking()]);

    assert(
        matchResult1.events.some((e) => e.type === "queued"),
        "Client 1 received queued event"
    );
    assert(
        matchResult1.events.some((e) => e.type === "matched"),
        "Client 1 received matched event"
    );
    assert(
        matchResult2.events.some((e) => e.type === "queued"),
        "Client 2 received queued event"
    );
    assert(
        matchResult2.events.some((e) => e.type === "matched"),
        "Client 2 received matched event"
    );

    const matchEvent1 = matchResult1.events.find((e) => e.type === "matched")!;
    const matchEvent2 = matchResult2.events.find((e) => e.type === "matched")!;
    const match1 = matchEvent1.match as { id: string };
    const match2 = matchEvent2.match as { id: string };

    assertEqual(match1.id, match2.id, "Both clients have same match ID");
    const matchId = match1.id;

    await delay(DELAY_MS);
    const [game1, game2] = await Promise.all([
        client1.connectToGame(SERVER_PORT, matchId),
        client2.connectToGame(SERVER_PORT, matchId),
    ]);

    const gameStarted1 = await game1.waitForMessage("game_started");
    const gameStarted2 = await game2.waitForMessage("game_started");

    assertEqual(gameStarted1.type, "game_started", "Game 1 started");
    assertEqual(gameStarted2.type, "game_started", "Game 2 started");
    assertEqual(gameStarted1.matchId, matchId, "Game 1 match ID");
    assertEqual(gameStarted2.matchId, matchId, "Game 2 match ID");

    const colors = [gameStarted1.color, gameStarted2.color].sort();
    assertDeepEqual(colors, ["b", "w"], "One player is white and one is black");

    assertEqual(gameStarted1.fen, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "Initial FEN");
    assertEqual(gameStarted1.turn, "w", "White to move");

    await delay(DELAY_MS);
    const whiteGame = gameStarted1.color === "w" ? game1 : game2;
    const blackGame = gameStarted1.color === "w" ? game2 : game1;

    whiteGame.send({ type: "resign" });

    const gameOver1 = await whiteGame.waitForMessage("game_over");
    const gameOver2 = await blackGame.waitForMessage("game_over");

    assertEqual(gameOver1.type, "game_over", "White received game_over");
    assertEqual(gameOver2.type, "game_over", "Black received game_over");

    const result1 = gameOver1.result as { type: string; winner: string };
    const result2 = gameOver2.result as { type: string; winner: string };
    assertEqual(result1.type, "resign", "Result type is resign");
    assertEqual(result1.winner, "black", "Black wins");
    assertEqual(result2.type, "resign", "Result type is resign");
    assertEqual(result2.winner, "black", "Black wins");

    assert(gameOver1.eloChange !== undefined, "ELO change sent to white");
    assert(gameOver2.eloChange !== undefined, "ELO change sent to black");

    const whiteEloChange = gameStarted1.color === "w" ? gameOver1.eloChange : gameOver2.eloChange;
    const blackEloChange = gameStarted1.color === "w" ? gameOver2.eloChange : gameOver1.eloChange;
    assert((whiteEloChange as number) < 0, "White lost ELO");
    assert((blackEloChange as number) > 0, "Black gained ELO");

    await delay(DELAY_MS);
    game1.close();
    game2.close();

    await delay(DELAY_MS);
    const logout1 = await client1.logout();
    assertEqual(logout1.status, 200, "Client 1 logout status");
    assertDeepEqual(logout1.body, { message: "Logged out successfully" }, "Client 1 logout body");

    const logout2 = await client2.logout();
    assertEqual(logout2.status, 200, "Client 2 logout status");

    await delay(DELAY_MS);
    const meAfter1 = await client1.getMe();
    assertEqual(meAfter1.status, 401, "Client 1 no longer authenticated");

    const meAfter2 = await client2.getMe();
    assertEqual(meAfter2.status, 401, "Client 2 no longer authenticated");

    log("Full game flow test passed");
}

async function testDuplicateUsername(): Promise<void>
{
    log("Testing: Duplicate username rejection");

    const client1 = new TestClient(SERVER_PORT);
    const client2 = new TestClient(SERVER_PORT);
    const uniqueUsername = randomUsername("unique");

    await delay(DELAY_MS);
    const reg1 = await client1.register(uniqueUsername, "password123");
    assertEqual(reg1.status, 201, "First registration succeeds");

    await delay(DELAY_MS);
    const reg2 = await client2.register(uniqueUsername, "password123");
    assertEqual(reg2.status, 409, "Duplicate registration rejected");
    assertEqual((reg2.body as { error: string }).error, "Username already exists", "Correct error message");

    log("Duplicate username test passed");
}

async function testUnauthorizedAccess(): Promise<void>
{
    log("Testing: Unauthorized access rejection");

    const client = new TestClient(SERVER_PORT);

    const me = await client.getMe();
    assertEqual(me.status, 401, "Unauthorized request rejected");
    assertEqual((me.body as { error: string }).error, "Not authenticated", "Correct error message");

    log("Unauthorized access test passed");
}

async function testLoginAfterRegistration(): Promise<void>
{
    log("Testing: Login after registration");

    const client1 = new TestClient(SERVER_PORT);
    const client2 = new TestClient(SERVER_PORT);
    const loginUsername = randomUsername("login");

    await delay(DELAY_MS);
    const reg = await client1.register(loginUsername, "password123");
    assertEqual(reg.status, 201, "Registration succeeds");

    await delay(DELAY_MS);
    const logout = await client1.logout();
    assertEqual(logout.status, 200, "Logout succeeds");

    await delay(DELAY_MS);
    const login = await client2.login(loginUsername, "password123");
    assertEqual(login.status, 200, "Login succeeds");
    assertDeepEqual(login.body, { success: true }, "Login response");

    const me = await client2.getMe();
    assertEqual(me.status, 200, "Authenticated after login");
    assertEqual((me.body as { user: { username: string } }).user.username, loginUsername, "Correct username");

    log("Login after registration test passed");
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void>
{
    testsRun++;
    try
    {
        await testFn();
        testsPassed++;
    }
    catch (error)
    {
        testsFailed++;
        logError(`Test "${name}" failed:`);
        console.error(error);
    }
}

async function main(): Promise<void>
{
    log("Starting E2E tests..");

    if (fs.existsSync(TEST_DB_PATH))
    {
        fs.unlinkSync(TEST_DB_PATH);
    }

    let serverProcess: ChildProcess | null = null;

    try
    {
        log("Starting server..");
        serverProcess = await startServer();
        log("Server started");

        log("Running tests..");

        await runTest("Full game flow", testFullGameFlow);
        await runTest("Duplicate username rejection", testDuplicateUsername);
        await runTest("Unauthorized access rejection", testUnauthorizedAccess);
        await runTest("Login after registration", testLoginAfterRegistration);

        log(`Tests completed: ${testsRun} run, ${testsPassed} passed, ${testsFailed} failed`);

        if (testsFailed > 0)
        {
            process.exitCode = 1;
        }
    }
    catch (error)
    {
        logError("E2E tests failed with error:");
        console.error(error);
        process.exitCode = 1;
    }
    finally
    {
        if (serverProcess)
        {
            log("Stopping server..");
            await stopServer(serverProcess);
            log("Server stopped");
        }
    }

    if (fs.existsSync(TEST_DB_PATH))
    {
        fs.unlinkSync(TEST_DB_PATH);
    }

    process.exit();
}

main();
