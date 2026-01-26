import { GoogleGenAI, Modality } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchAINews = async (cats: string[], auto: boolean) => {
  const prompt = `Research AI: (1) Cutting-edge tech, (2) Market/M&A, (3) User tools, (4) New services, (5) Startups, (6) US Legislature, (7) Academic Research. [METADATA] TOP_STORIES: S1, S2, S3`;
  const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { tools: [{ googleSearch: {} }] } });
  return { newsText: res.text || "", topStories: ["Daily Intelligence"] };
};

export const generatePodcastScript = async (text: string) => {
  const prompt = `Write 2,200 words for "AI Daily Pulse by Sundaram Labs". Hosts: Alex (Female Tech Skeptic) & Marcus (Male Biz Optimist). Cover the 7 pillars of AI. End with: Subscribe to Sundaram Labs.`;
  const res = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
  return res.text || "";
};

export const generateSegmentAudio = async (text: string) => {
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text.replace(/Sundaram/gi, 'Suun-duh-ruhm').replace(/\[.*?\]/g, '').trim() }] }],
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