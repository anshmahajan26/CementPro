import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config({ path: "./.env" });

const run = async () => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            fs.writeFileSync("err.txt", "No GEMINI_API_KEY found in .env");
            return;
        }
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // We can't easily list models via SDK maybe? Wait, GoogleGenerativeAI has no straight listModels?
        // Let's just fetch it via standard JS fetch to see.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        fs.writeFileSync("err.txt", JSON.stringify(data, null, 2));
    } catch (e) {
        fs.writeFileSync("err.txt", e.stack || e.message);
    }
}
run();
