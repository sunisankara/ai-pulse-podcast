import { GoogleGenAI, Modality } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) throw error;
    console.log(`API Error (${error.status || 'Unknown'}). Retrying in ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

export const fetchAINews = async (cats: string[], auto: boolean) => {
  return await withRetry(async () => {
    const prompt = `Research today's major AI news in: ${cats.join(', ')}. Format for a podcast host. [METADATA] TOP_STORIES: Story 1, Story 2`;
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    const text = res.text || "";
    const topStories = text.match(/TOP_STORIES: (.*)/)?.[1]?.split(',').map(s => s.trim()) || ["Daily Update"];
    return { newsText: text, topStories };
  });
};

export const generatePodcastScript = async (text: string) => {
  return await withRetry(async () => {
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Write a 15-minute 2-speaker podcast script based on: " + text + ". Use [TRANSITION] markers between topics."
    });
    return res.text || "";
  });
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
    if (!chunk.trim()) continue;
    const data = await withRetry(async () => {
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
      return res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    });
    if (data) results.push(data);
    await new Promise(r => setTimeout(r, 500)); // Safety delay between segments
  }
  return results;
};