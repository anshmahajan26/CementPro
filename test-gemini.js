import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

const run = async () => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.log("No GEMINI_API_KEY found in .env");
            return;
        }
        console.log("Found key starting with:", process.env.GEMINI_API_KEY.substring(0, 8));
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Say hello!");
        console.log("Success! Response:", result.response.text());
    } catch (e) {
        console.error("Failed!", e.message);
    }
}
run();
