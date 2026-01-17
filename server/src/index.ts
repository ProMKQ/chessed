import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import authRoutes from "./auth/routes.js";
import { sessionMiddleware } from "./auth/middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";

if (NODE_ENV === "production")
{
    // app may run behind something like cloudflare
    app.set("trust proxy", 1);
}

if (NODE_ENV === "development")
{
    app.use(
        cors({
            origin: "http://localhost:5173",
            credentials: true,
        })
    );
}

app.use(express.json());

app.use(sessionMiddleware);

app.use("/api/auth", authRoutes);

// for testing
app.get("/api/hello", (_req, res) =>
{
    res.json({ message: "Hello World" });
});

if (NODE_ENV === "production")
{
    const clientDistPath = path.join(__dirname, "../../client/dist");
    app.use(express.static(clientDistPath));

    app.get("/{*splat}", (_req, res) =>
    {
        res.sendFile(path.join(clientDistPath, "index.html"));
    });
}

const httpServer = createServer(app);

httpServer.listen(PORT, () =>
{
    console.log(`Server is running on port ${PORT} in ${NODE_ENV} mode`);
});
