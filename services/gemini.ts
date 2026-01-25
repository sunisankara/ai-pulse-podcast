import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const fetchAINews = async (cats: string[], auto: boolean) => {
  const prompt = `Research today's major AI news in: ${cats.join(', ')}. 
  Focus on: Technical papers, major corporate shifts, and open-source breakthroughs.
  Provide a detailed report.
  At the end, add [METADATA] TOP_STORIES: Story A, Story B, Story C`;

  const res = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] }
  });
  
  const text = res.text || "";
  const topStories = text.match(/TOP_STORIES: (.*)/)?.[1]?.split(',').map(s => s.trim()) || ["Daily AI Intelligence"];
  
  return { newsText: text, topStories };
};

export const generatePodcastScript = async (newsText: string) => {
  const prompt = `You are writing a 15-minute podcast script for "AI Pulse".
  Hosts: Alex (Technical/Skeptic) and Marcus (Optimist/Business).
  
  News Context:
  ${newsText}
  
  Requirements:
  - Dialogue must be conversational, high-energy, and insightful.
  - Break the script into at least 10 sections using [TRANSITION] markers.
  - Total script length should be approximately 2500 words for a 15-minute runtime.
  - Format like this:
    Alex: [Dialogue]
    Marcus: [Dialogue]
    [TRANSITION]
    ...
  `;

  const res = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt
  });
  return res.text || "";
};

export const generateSegmentAudio = async (text: string) => {
  // Phonetic corrections
  const cleanText = text.replace(/Sundaram/gi, 'Suun-duh-ruhm').replace(/Labs/gi, 'Labbz').trim();
  
  // Intelligent Chunking (Gemini TTS limit is roughly 1000-1500 chars)
  const MAX_CHUNK = 1000;
  const chunks = [];
  let remaining = cleanText;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf('.', MAX_CHUNK);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf(' ', MAX_CHUNK);
    if (splitIdx === -1) splitIdx = MAX_CHUNK;
    
    chunks.push(remaining.substring(0, splitIdx + 1));
    remaining = remaining.substring(splitIdx + 1).trim();
  }

  const results = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
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
    const audioData = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (audioData) results.push(audioData);
  }
  return results;
};