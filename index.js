import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const app = express();
const upload = multer();
const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
});

const systemInstruction = `Kamu adalah asisten AI yang membantu UMKM Lazadis@Net yang beralamat di Jl. Malaka III, RT.1/RW.6, Rorotan, Kec. Cilincing, Jkt Utara, Daerah Khusus Ibukota Jakarta 14140, 
dalam menjawab pertanyaan terkait produk, layanan, dan informasi yang relevan. Jawaban harus jelas, ringkas, dan sesuai dengan konteks pertanyaan. Jika pertanyaan tidak relevan atau tidak dapat dijawab, berikan jawaban yang sopan dan informatif. Harus menjawab dengan Bahasa Indonesia, tidak boleh menggunakan bahasa lain. Jika pertanyaan tidak relevan, jawab dengan sopan dan informatif. Jangan menambahkan informasi yang tidak diminta. Gunakan format teks yang jelas dan mudah dipahami.
Juga untuk Fotocopy dan Scanning jawab dengan jelas dan ringkas, misalnya: "Layanan Fotocopy tersedia dengan harga Rp. 500 per lembar untuk hitam putih dan Rp. 1.000 per lembar untuk warna. Layanan Scanning tersedia dengan harga Rp. 2.000 per dokumen."`;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function normalizeHistory(input) {
  if (Array.isArray(input)) {
    return input.filter((item) => item && typeof item.text === 'string');
  }

  if (typeof input === 'string' && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && typeof item.text === 'string');
      }
    } catch {
      return [{ role: 'user', text: input }];
    }
  }

  return [];
}

function toGeminiContents(history) {
  return history.map(({ role, text }) => ({
    role: role === 'model' ? 'model' : 'user',
    parts: [{ text: String(text || '') }],
  }));
}

app.post('/api/chat', async (req, res) => {
  try {
    const history = normalizeHistory(req.body?.conversation ?? req.body?.prompt ?? req.body?.messages);

    if (!history.length) {
      return res.status(400).json({ error: 'Body harus berisi array percakapan.' });
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: toGeminiContents(history),
      config: {
        temperature: 0.9,
        systemInstruction,
      },
    });

    const text = response.text ?? response?.candidates?.[0]?.content?.[0]?.text ?? '';
    res.status(200).json({ result: text.trim() });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: error?.message || 'Terjadi kesalahan saat memproses permintaan.' });
  }
});

app.post('/api/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File tidak ditemukan dalam request.' });
    }

    const history = normalizeHistory(req.body?.promptHistory);
    const promptText = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';

    const fileDescription = `File diterima: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes).`;
    const messages = [...history];

    if (promptText) {
      messages.push({ role: 'user', text: `${promptText} ${fileDescription}` });
    } else {
      messages.push({ role: 'user', text: fileDescription });
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: toGeminiContents(messages),
      config: {
        temperature: 0.9,
        systemInstruction,
      },
    });

    const text = response.text ?? response?.candidates?.[0]?.content?.[0]?.text ?? '';
    res.status(200).json({ result: text.trim() });
  } catch (error) {
    console.error('File API error:', error);
    res.status(500).json({ error: error?.message || 'Terjadi kesalahan saat mengunggah file.' });
  }
});

app.listen(PORT, () => {
  console.log(`Lazadis@Net Listening on Port ${PORT}`);
});