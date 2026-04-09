import { GoogleGenerativeAI } from "@google/generative-ai";

export const handleDashboardChat = async (req, res) => {
  try {
    const { question, contextData } = req.body;

    if (!question) {
      return res.status(400).json({ success: false, message: "Question is required." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ 
        success: false, 
        message: "GEMINI_API_KEY is missing in backend .env file. Please add it to enable the AI assistant." 
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use gemini-2.5-flash for maximum efficiency and robust context parsing
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Format the context so the LLM understands it
    const prompt = `
You are an expert AI Supply Chain & Sustainability Assistant for a Ready-Mix Concrete manufacturing plant.
You have been given the following JSON dashboard data which contains:
- KPIs for current and next day demand, cement requirements, emissions, and sustainability score.
- Smart alerts and stakeholder summaries.

Dashboard Data Context:
${JSON.stringify(contextData, null, 2)}

User Question: ${question}

Instructions:
1. Provide a modern, enthusiastic, and highly professional answer based ONLY on the provided dashboard data context.
2. KEEP YOUR ANSWER EXTREMELY SHORT, CONCISE, AND TO THE POINT. Do not ramble. Max 2-3 sentences unless forming a small list.
3. ONLY answer what the user explicitly asks for. Do not provide unprompted explanations or very long answers.
4. Use beautiful Markdown formatting: bold text for insights, and bullet points for lists.
5. Liberally sprinkle relevant and engaging emojis throughout your answer (e.g., 📉, 📊, 🚀, 💡, 🏭, ♻️) to make it look fantastic and modern.
6. Speak directly as the AI Analyst, never referring to yourself as an LLM processing JSON.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return res.json({
      success: true,
      answer: responseText
    });

  } catch (error) {
    console.error(`[API Error] POST /api/dashboard/chat failed:`, error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to communicate with AI Chatbot service. Ensure API Key is valid." 
    });
  }
};
