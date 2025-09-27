// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config({ path: path.resolve("./.env") });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

console.log("API Key loaded:", process.env.GEMINI_API_KEY?.slice(0, 8) + "...");

// ✅ Initialize with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🚨 emergency regex
const URGENT_RE = /\b(chest pain|shortness of breath|difficulty breathing|lost consciousness|severe bleeding|suicidal|suicide|stroke|difficulty speaking)\b/i;

const SYSTEM_PROMPT = `
You are a medical information assistant. 
- Only answer medical-related questions.
- If the question is NOT related to health/medicine, reply with: "Please ask a medically realted question, Thanks."
- You provide general, evidence-based information and safe self-care tips.
- You MUST NOT give a medical diagnosis or tell the user to stop prescribed treatments.
- Always include a short disclaimer telling users to consult a licensed healthcare professional and to seek emergency care for severe/urgent symptoms.
- Be concise and suggest safe next steps when appropriate.
`;


app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message required" });
    }

    // 🚨 urgent symptoms
    if (URGENT_RE.test(message)) {
      return res.json({
        reply:
          "Your message contains symptoms that may be an emergency. Please call your local emergency number or go to the nearest emergency department immediately. I am not a doctor."
      });
    }

    // ✅ get the model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // ✅ build chat input
    const chatHistory = [
  { role: "user", parts: [{ text: SYSTEM_PROMPT }] }, // ✅ treat system as user message
  ...(Array.isArray(history)
    ? history.slice(-8).map(turn => ({
        role: turn.role === "assistant" ? "model" : "user", // map roles
        parts: [{ text: turn.text }]
      }))
    : []),
  { role: "user", parts: [{ text: message }] }
];


    // ✅ call model
    const result = await model.generateContent({ contents: chatHistory });

    // ✅ safer text extraction
    const replyText = result.response.text();

    return res.json({ reply: replyText });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "server error", details: err?.message });
  }
});

app.use(express.static("public"));

app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
