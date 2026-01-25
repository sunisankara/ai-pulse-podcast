import { GoogleGenAI, Modality } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) throw error;
    console.log(`Retrying after ${error.status || 'Error'}...`);
    await new Promise(r => setTimeout(r, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

export const fetchAINews = async (cats: string[], auto: boolean) => {
  return await withRetry(async () => {
    const prompt = `Research today's major AI developments with a heavy focus on BUSINESS and TECHNOLOGY impact.
    Target topics: ${cats.join(', ')}.
    Include: Specific insights on tools like Claude's co-work features, sentiments from Tech CEOs at events like Davos, and journalistic analysis of future impacts.
    Avoid stale or general news. Focus on what happened in the last 24-48 hours.
    [METADATA] TOP_STORIES: Story A, Story B`;
    
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
    const prompt = `Write a 15-minute natural conversational script for "AI Daily Pulse by Sundaram Labs".
    
    Hosts:
    - Alex (Technical Skeptic, Male, Kore voice): Cynical but fair, asks "but how does this actually work?".
    - Marcus (Business Optimist, Male, Puck voice): Energetic, focuses on ROI and market shifts.

    Branding Requirements:
    - INTRO: "Welcome to AI Daily Pulse by Sundaram Labs."
    - OUTRO: "This is a production of Sundaram Labs. Subscribe for your daily AI intelligence."

    Style Requirements:
    - This must sound like a REAL HUMAN CONVERSATION.
    - Include interjections (Alex: "Right", "Exactly", "Hold on").
    - Include emotional cues in brackets like [Alex laughs] or [Marcus sounds surprised].
    - Do not list facts. Debate them. Use [TRANSITION] markers between topics.
    - Total content should be around 2500 words.

    News Context:
    ${text}`;

    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    return res.text || "";
  });
};

export const generateSegmentAudio = async (text: string) => {
  const MAX = 1000;
  let remaining = text.trim();
  const chunks = [];
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
    await new Promise(r => setTimeout(r, 500));
  }
  return results;
};