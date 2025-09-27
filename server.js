// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// simple urgent keywords detector
const URGENT_RE = /\b(chest pain|shortness of breath|difficulty breathing|lost consciousness|severe bleeding|suicidal|suicide|stroke|difficulty speaking)\b/i;

// system prompt — enforce safe behavior (non-diagnostic)
const SYSTEM_PROMPT = `
You are a medical information assistant. You provide general, evidence-based information and safe self-care tips.
You MUST NOT give a medical diagnosis or tell the user to stop other prescribed treatments.
Always include a short disclaimer telling users to consult a licensed healthcare professional and to seek emergency care for severe/urgent symptoms.
Be concise and cite general next steps where appropriate.
`;

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== "string") return res.status(400).json({ error: "message required" });

    // Emergency short-circuit
    if (URGENT_RE.test(message)) {
      return res.json({
        reply:
          "Your message contains symptoms that may be an emergency (e.g., chest pain, severe bleeding, loss of consciousness). Please call your local emergency number or go to the nearest emergency department immediately. I am not a doctor."
      });
    }

    // Build the contents: system + (optional) chat history + user message
    const contents = [];
    contents.push({ role: "system", parts: [{ text: SYSTEM_PROMPT }] });

    if (Array.isArray(history)) {
      // history = [{role:'user'|'assistant', text: '...'}, ...]
      for (const turn of history.slice(-8)) { // send only last 8 turns to limit prompt size
        contents.push({ role: turn.role, parts: [{ text: turn.text }] });
      }
    }

    contents.push({ role: "user", parts: [{ text: message }] });

    // Call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-001", // example — change to the model you have access to
      contents,
      // optional: you can set max output tokens, temperature etc in 'config'
      // config: { temperature: 0.2, maxOutputTokens: 512 }
    });

    // The SDK surfaces `response.text` per examples
    const replyText = response?.text ?? (response?.output?.[0]?.content?.[0]?.text ?? "Sorry, no response.");
    return res.json({ reply: replyText });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server error", details: err?.message });
  }
});

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
