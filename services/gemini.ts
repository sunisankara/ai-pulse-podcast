import { GoogleGenAI, Modality } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchAINews = async (cats: string[], auto: boolean) => {
  const prompt = `Find 5+ high-signal AI news stories from last 24h (TechCrunch/TLDR style). [METADATA] TOP_STORIES: Story A, Story B`;
  const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { tools: [{ googleSearch: {} }] } });
  return { newsText: res.text || "", topStories: ["Update"] };
};

export const generatePodcastScript = async (text: string) => {
  const prompt = `Write a 2,200 WORD podcast script. Hosts: Alex (Female Skeptic) and Marcus (Male Optimist). Use [TRANSITION] between 5 topics. Branding: Sundaram Labs.`;
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