import { GoogleGenAI, Modality } from "@google/genai";
// Always use the specified initialization format with process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
export const fetchAINews = async (cats: string[], auto: boolean) => {
  const res = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: "Find the top 3 AI news stories from today.",
    config: { tools: [{ googleSearch: {} }] }
  });
  // Use .text property to extract response.
  return { newsText: res.text, topStories: ["Daily Intelligence Update"] };
};
export const generatePodcastScript = async (text: string) => {
  const res = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: "Write a short podcast script based on this news: " + text
  });
  return res.text;
};
export const generateSegmentAudio = async (text: string) => {
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text.substring(0, 500) }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
      }
    }
  });
  return [res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || ""];
};