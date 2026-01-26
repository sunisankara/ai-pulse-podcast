import { fetchAINews, generatePodcastScript, generateSegmentAudio } from './services/gemini.js';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Buffer } from 'buffer';

async function run() {
  console.log('--- AI DAILY PULSE: PILLAR BROADCAST ENGINE v0.6.6 ---');
  const id = Date.now().toString();
  const rawFilename = `episode-${id}.mp3`;
  if (!fs.existsSync('audio')) fs.mkdirSync('audio');
  const finalPath = `audio/${rawFilename}`;

  try {
    console.log('Step 1: Researching 7 Core AI Pillars...');
    const news = await fetchAINews([], true);
    
    console.log('Step 2: Scripting 15-Minute Deep Dive (2200 words)...');
    const script = await generatePodcastScript(news.newsText);
    
    console.log('Step 3: Multi-Speaker Production Sequence...');
    const segments = script.split('[TRANSITION]').filter(s => s.trim().length > 5);
    const pcmFile = `temp-${id}.pcm`;
    for (let i = 0; i < segments.length; i++) {
      console.log(`Segment ${i+1}/${segments.length} Processing...`);
      const chunks = await generateSegmentAudio(segments[i]);
      for (const chunk of chunks) fs.appendFileSync(pcmFile, Buffer.from(chunk, 'base64'));
    }
    
    console.log('Step 4: Master Compression & LAME Encoding...');
    execSync(`ffmpeg -f s16le -ar 24000 -ac 1 -i ${pcmFile} -acodec libmp3lame -ab 128k ${finalPath}`);
    if (fs.existsSync(pcmFile)) fs.unlinkSync(pcmFile);
    console.log('Broadcast Complete.');
  } catch (error) {
    console.error('ENGINE CRITICAL FAILURE:', error);
    (process as any).exit(1);
  }
}
run();