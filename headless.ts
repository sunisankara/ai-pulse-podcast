
/**
 * HEADLESS BROADCASTER (v0.3)
 * Designed to run in GitHub Actions.
 * Pronunciation: Suun-duh-ruhm Labbz.
 */
import { fetchAINews, generatePodcastScript, generateSegmentAudio } from './services/gemini';
import { generateRSSFeed } from './utils/rss';
import * as fs from 'fs';
import { execSync } from 'child_process';
// Fix: Import Buffer explicitly to resolve compile-time error in Node.js environments
import { Buffer } from 'buffer';

const IS_TEST = process.env.IS_TEST === 'true';

async function run() {
  console.log('--- STARTING HEADLESS BROADCAST (v0.3) ---');
  
  const id = Date.now().toString();
  const filename = `AI-Pulse-${id}.mp3`;
  const pcmFile = `temp-${id}.pcm`;

  try {
    if (IS_TEST) {
      console.log('DIAGNOSTIC MODE: Generating 5-minute monotone signal...');
      // Use ffmpeg to generate a 5-minute 440Hz sine wave directly to MP3
      // f=lavfi creates a virtual source
      execSync(`ffmpeg -f lavfi -i "sine=frequency=440:duration=300" -acodec libmp3lame -ab 128k ${filename}`);
      console.log(`Diagnostic MP3 generated: ${filename}`);
    } else {
      const categories = [
        "Significant AI breakthroughs",
        "Cutting edge AI technology & models",
        "Market advances, M&A, and business deals",
        "New startups in the AI space"
      ];

      console.log('Gathering Intelligence...');
      const report = await fetchAINews(categories, true);
      
      console.log('Drafting Script...');
      const script = await generatePodcastScript(report.newsText);
      
      console.log('Synthesizing Voices ( Alex & Marcus )...');
      const segments = script.split('[TRANSITION]').filter(s => s.trim().length > 5);
      
      // We write segments to a raw PCM file first
      for (let i = 0; i < segments.length; i++) {
        console.log(`Processing Segment ${i+1}/${segments.length}`);
        const chunks = await generateSegmentAudio(segments[i]);
        for (const chunk of chunks) {
          // Fix: Using imported Buffer to convert base64 audio chunks to raw bytes
          fs.appendFileSync(pcmFile, Buffer.from(chunk, 'base64'));
        }
      }

      // Convert raw PCM (16-bit, 24kHz) to MP3 using ffmpeg
      console.log('Encoding to MP3 via ffmpeg...');
      execSync(`ffmpeg -f s16le -ar 24000 -ac 1 -i ${pcmFile} -acodec libmp3lame -ab 128k ${filename}`);
      fs.unlinkSync(pcmFile); // Cleanup temp PCM
    }

    // 5. Update RSS Feed
    console.log('Updating Stream Registry...');
    // In actual use, we would read existing episodes from a JSON manifest in the repo
    const rssContent = generateRSSFeed([]); 
    fs.writeFileSync('feed.xml', rssContent);

    console.log('--- BROADCAST COMPLETE ---');
  } catch (error) {
    console.error('CRITICAL BROADCAST ERROR:', error);
    // Fix: Cast process to any to access the exit method which might not be defined on the global Process type in some environments
    (process as any).exit(1);
  }
}

run();
