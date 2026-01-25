import { GoogleGenAI, Modality } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
export const fetchAINews = async (cats: string[], auto: boolean) => {
  const res = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Research AI news for ${cats.join(', ')}. [METADATA] TOP_STORIES: Story 1, Story 2`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return { newsText: res.text, topStories: ["Daily Intelligence"], autoInjectedTopics: [] };
};
export const generatePodcastScript = async (text: string) => {
  const res = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Write a podcast script for AI Daily Pulse based on: ${text}`
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