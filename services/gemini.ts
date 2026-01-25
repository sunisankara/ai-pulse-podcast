import { GoogleGenAI, Modality } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchAINews = async (cats: string[], auto: boolean) => {
  const prompt = `Find latest news in: ${cats.join(', ')}. Format for a podcast host. [METADATA] TOP_STORIES: Story 1, Story 2`;
  const res = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] }
  });
  const text = res.text || "";
  const topStories = text.match(/TOP_STORIES: (.*)/)?.[1]?.split(',').map(s => s.trim()) || ["Daily Update"];
  return { newsText: text, topStories };
};

export const generatePodcastScript = async (text: string) => {
  const res = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: "Write a 15-minute 2-speaker podcast script based on: " + text + ". Use [TRANSITION] markers."
  });
  return res.text || "";
};

export const generateSegmentAudio = async (text: string) => {
  const chunks = [];
  const MAX = 1000;
  let remaining = text.trim();
  while(remaining.length > 0) {
    const end = remaining.lastIndexOf('.', MAX) > 0 ? remaining.lastIndexOf('.', MAX) + 1 : MAX;
    chunks.push(remaining.substring(0, end));
    remaining = remaining.substring(end).trim();
  }
  const results = [];
  for (const chunk of chunks) {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: chunk }] }],
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
    const data = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (data) results.push(data);
  }
  return results;
};