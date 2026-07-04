import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import { GoogleGenAI } from "@google/genai";

const app = express();
const upload = multer();
const ai = new GoogleGenAI({
    apiKey: process.env.API_KEY,
});

const GEMINI_MODEL = "gemini-2.5-flash-lite";

app.use (express.json());

const PORT = 3000;
app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/generate-text', async (req, res) => {
    const { prompt } = req.body;
    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
        });
        res.status(200).json({result:response.text });
    } catch (e) {
        console.log(e);
        res.status(500).json({ error: "An error occurred while generating text." });
    }
});
app.post('/generate-from-document', upload.single('file'), async (req, res) =>{
    try{
        const { prompt } = req.body;
        const fileBase64 = req.file.buffer.toString('base64');
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                {
                    text: prompt,
                    type: 'text',
                },
                {
                    inlineData:{
                        data:fileBase64,
                        mimeType:req.file.mimetype,
                    },
                },
            ],
        });
    res.status(200).json({result:response.text});
    } catch (e) {
        console.log(e);
        res.status(500).json({ error: "An error occurred while generating text from document." });
    }
});
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));