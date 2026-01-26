
/**
 * HEADLESS BROADCASTER (v0.6.9)
 */
import { fetchAINews, generatePodcastScript, generateSegmentAudio } from './services/gemini.js';
import { generateRSSFeed } from './utils/rss.js';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Buffer } from 'buffer';

const IS_TEST = process.env.IS_TEST === 'true';

async function run() {
  console.log('--- AI DAILY PULSE: AUTOMATED CLOUD BROADCAST v0.6.9 ---');
  const id = Date.now().toString();
  const filename = `AI-Pulse-${id}.mp3`;
  const pcmFile = `temp-${id}.pcm`;

  try {
    if (IS_TEST) {
      console.log('DIAGNOSTIC MODE TRIGGERED...');
      execSync(`ffmpeg -f lavfi -i "sine=frequency=440:duration=1" -acodec libmp3lame -ab 128k ${filename}`);
    } else {
      console.log('Step 1: Direct Intelligence Gathering (No Preview Required)...');
      const report = await fetchAINews();
      
      console.log('Step 2: Automated Scripting for Executive Briefing...');
      const script = await generatePodcastScript(report.newsText);
      
      console.log('Step 3: Sequential Multi-Speaker Production...');
      const segments = script.split('[TRANSITION]').filter(s => s.trim().length > 5);
      
      for (let i = 0; i < segments.length; i++) {
        console.log(`Producing Segment ${i+1}/${segments.length}`);
        const chunks = await generateSegmentAudio(segments[i]);
        for (const chunk of chunks) fs.appendFileSync(pcmFile, Buffer.from(chunk, 'base64'));
      }
      
      console.log('Step 4: Final Mastering & MP3 Encoding...');
      execSync(`ffmpeg -f s16le -ar 24000 -ac 1 -i ${pcmFile} -acodec libmp3lame -ab 128k ${filename}`);
      if (fs.existsSync(pcmFile)) fs.unlinkSync(pcmFile);
    }

    const repoPath = process.env.GITHUB_REPOSITORY || 'sunisankara/ai-pulse-podcast';
    const [owner, repoName] = repoPath.split('/');
    const baseUrl = `https://${owner}.github.io/${repoName}`;

    console.log('Step 5: Updating Syndication Feed (feed.xml)...');
    const rssContent = generateRSSFeed([], baseUrl); 
    fs.writeFileSync('feed.xml', rssContent);
    
    console.log('--- BROADCAST SUCCESSFUL ---');
  } catch (error) {
    console.error('CRITICAL ENGINE FAILURE:', error);
    (process as any).exit(1);
  }
}
run();
