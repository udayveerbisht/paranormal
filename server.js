import express from "express";
import path from "path";
import fs from "node:fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable("x-powered-by");

const PORT = Number(process.env.PORT || 6969);

// Use KEY= in .env
const GEMINI_KEY = process.env.KEY;

if (!GEMINI_KEY) {
    throw new Error("Missing KEY in .env file");
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Load system prompt from prompt.txt
const promptPath = path.join(process.cwd(), "prompt.txt");
if (!fs.existsSync(promptPath)) {
    throw new Error(`Missing prompt.txt in current directory: ${promptPath}`);
}
const systemPrompt = fs.readFileSync(promptPath, "utf8").trim();

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-preview",
    systemInstruction: systemPrompt,
});

function clampText(s, max = 12000) {
    if (typeof s !== "string") return "";
    const t = s.trim();
    if (!t) return "";
    return t.slice(0, max);
}

app.post("/rewrite", async (req, res) => {
    try {
        const text = clampText(req.body?.text);
        if (!text) return res.status(400).json({ error: "text required" });

        const prompt =
            `Rewrite the text below following your editing rules.\n\n` +
            `TEXT:\n${text}`;

        const contents = [{ role: "user", parts: [{ text: prompt }] }];
        const result = await model.generateContent({ contents });
        const out = (result?.response?.text?.() || "").trim();

        if (!out) return res.status(500).json({ error: "empty model response" });
        res.json({ text: out });
    } catch (e) {
        res.status(500).json({ error: String(e?.message || e || "error") });
    }
});

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
