import { fetchAINews, generatePodcastScript, generateSegmentAudio } from './services/gemini.js';
import { generateRSSFeed } from './utils/rss.js';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Buffer } from 'buffer';

const IS_TEST = process.env.IS_TEST === 'true';

async function run() {
  console.log('--- AI DAILY PULSE BROADCASTER (v0.6.5) ---');
  const id = Date.now().toString();
  const rawFilename = `episode-${id}.mp3`;
  if (!fs.existsSync('audio')) fs.mkdirSync('audio');
  const finalPath = `audio/${rawFilename}`;

  try {
    if (IS_TEST) {
      console.log('MODE: DIAGNOSTIC (Short 1s signal)');
      execSync(`ffmpeg -f lavfi -i "sine=frequency=1000:duration=1" -acodec libmp3lame ${finalPath}`);
    } else {
      console.log('Step 1: Deep Research (Multi-story search)...');
      const news = await fetchAINews(["LLM Systems", "AI Funding", "Dev Tooling"], true);
      
      console.log('Step 2: 2000+ Word Natural Conversation Scripting...');
      const script = await generatePodcastScript(news.newsText);
      
      console.log('Step 3: Multi-Speaker Production (Large Batch)...');
      const segments = script.split('[TRANSITION]').filter(s => s.trim().length > 5);
      const pcmFile = `temp-${id}.pcm`;
      for (let i = 0; i < segments.length; i++) {
        console.log(`Segment ${i+1}/${segments.length}`);
        const chunks = await generateSegmentAudio(segments[i]);
        for (const chunk of chunks) fs.appendFileSync(pcmFile, Buffer.from(chunk, 'base64'));
      }
      
      console.log('Step 4: Master MP3 Mastering...');
      execSync(`ffmpeg -f s16le -ar 24000 -ac 1 -i ${pcmFile} -acodec libmp3lame -ab 128k ${finalPath}`);
      if (fs.existsSync(pcmFile)) fs.unlinkSync(pcmFile);
    }
    console.log('Broadcast ready.');
  } catch (error) {
    console.error('ENGINE FAILURE:', error);
    (process as any).exit(1);
  }
}
run();