
import { GoogleGenAI, Type, Modality } from "@google/genai";

const getAIClient = () => {
  const key = typeof process !== 'undefined' ? process.env.API_KEY : (window as any).process?.env?.API_KEY;
  if (!key) throw new Error("API Key missing.");
  return new GoogleGenAI({ apiKey: key });
};

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

export const fetchAINews = async (categories: string[], autoRefine: boolean, previousStories: string[] = []): Promise<any> => {
  const ai = getAIClient();
  const today = new Date().toLocaleDateString();
  
  const prompt = `Research top AI developments from the last 24-48 hours (${today}) based on these focus areas:
  ${categories.map((c, i) => `${i+1}. ${c}`).join('\n')}

  ${autoRefine ? "CRITICAL: If there are trending AI breakthroughs, major leaks, or significant M&A news NOT in this list, auto-inject them into your search to ensure the most relevant broadcast." : ""}

  EXCLUSION RULES:
  - Do NOT repeat the following stories which were already covered in recent episodes:
    ${previousStories.join(', ')}

  Format your response as a detailed intelligence briefing. 
  At the end of your response, add a section marked [METADATA] with:
  - TOP_STORIES: [List the 3 most unique and significant news stories discovered today, separated by commas.]
  - AUTO_INJECTED: [List any extra areas you searched for because they were trending]
  - SUGGESTIONS: [List 3-5 emerging topics]`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });

  const text = response.text || "";
  const [report, metadata] = text.split('[METADATA]');
  
  const topStories = metadata?.match(/TOP_STORIES: (.*)/)?.[1]?.split(',') || [];
  const autoInjected = metadata?.match(/AUTO_INJECTED: (.*)/)?.[1]?.split(',') || [];
  const suggestions = metadata?.match(/SUGGESTIONS: (.*)/)?.[1]?.split(',') || [];

  return {
    newsText: report.trim(),
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
    topStories: topStories.map(t => t.trim()).filter(t => t),
    autoInjectedTopics: autoInjected.map(t => t.trim()).filter(t => t),
    suggestedTopics: suggestions.map(t => t.trim()).filter(t => t)
  };
};

export const generatePodcastScript = async (newsSummary: string, isPreview: boolean = false) => {
  const ai = getAIClient();
  
  const lengthConstraint = isPreview 
    ? "This is a FAST TEST PREVIEW. Write a maximum of 4 lines of dialogue (approx 15 seconds total)." 
    : "Write a full 15-minute conversational deep dive.";

  const prompt = `Write a conversation for "AI Daily Pulse".
  
  Hosts: 
  - Alex (Technical skeptic, Male, deep voice).
  - Marcus (Business optimist, Male, energetic).

  Constraint: ${lengthConstraint}
  
  Style: Fast-paced, professional.
  MANDATORY SIGN-OFF: The last line must be Marcus saying: "This podcast is a production of Sundaram Labs. Subscribe for more daily AI insights."
  
  Script Format:
  Alex: [Dialogue]
  Marcus: [Dialogue]
  [TRANSITION]
  
  News Content:
  ${newsSummary}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text || "";
};

export const generateSegmentAudio = async (text: string): Promise<string[]> => {
  const ai = getAIClient();
  
  // Phonetic correction for Sundaram Labs
  // Labbz ensures the short 'a' sound to prevent "Lubs"
  const phoneticText = text
    .replace(/Sundaram/gi, 'Suun-duh-ruhm')
    .replace(/Labs/gi, 'Labbz');
  
  const cleanText = phoneticText.replace(/\[.*?\]/g, '').trim();
  if (!cleanText) return [];

  const MAX_CHUNK_LENGTH = 1000;
  const chunks: string[] = [];
  let remaining = cleanText;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK_LENGTH) {
      chunks.push(remaining);
      break;
    }
    let endIdx = remaining.lastIndexOf('.', MAX_CHUNK_LENGTH);
    if (endIdx === -1) endIdx = remaining.lastIndexOf(' ', MAX_CHUNK_LENGTH);
    if (endIdx === -1) endIdx = MAX_CHUNK_LENGTH;
    
    chunks.push(remaining.substring(0, endIdx + 1).trim());
    remaining = remaining.substring(endIdx + 1).trim();
  }

  const results: string[] = [];

  for (const chunk of chunks) {
    const b64 = await withRetry(async () => {
      const response = await ai.models.generateContent({
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

      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) throw new Error("No audio data returned from Gemini TTS.");
      return data;
    });
    
    results.push(b64);
    await new Promise(r => setTimeout(r, 200));
  }

  return results;
};
