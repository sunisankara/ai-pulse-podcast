import { GoogleGenAI, Modality } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchAINews = async (cats: string[], auto: boolean) => {
  const prompt = `Research major AI developments from the last 24 hours. Focus on technical shifts and business ROI. [METADATA] TOP_STORIES: Story A, Story B`;
  const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { tools: [{ googleSearch: {} }] } });
  const text = res.text || "";
  const topStories = text.match(/TOP_STORIES: (.*)/)?.[1]?.split(',') || ["Daily Update"];
  return { newsText: text, topStories };
};

export const generatePodcastScript = async (text: string) => {
  const prompt = `Write a natural conversational script for AI Daily Pulse. Hosts: Alex (Skeptic) and Marcus (Optimist). News: ${text}`;
  const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
  return res.text || "";
};

export const generateSegmentAudio = async (text: string) => {
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text.replace(/\[.*?\]/g, '').trim() }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            { speaker: 'Alex', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            { speaker: 'Marcus', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
          ]
        }
      }
    }
  });
  return [res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data];
};