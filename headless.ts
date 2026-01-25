import { fetchAINews, generatePodcastScript, generateSegmentAudio } from './services/gemini.js';
import { generateRSSFeed } from './utils/rss.js';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Buffer } from 'buffer';

const IS_TEST = process.env.IS_TEST === 'true';

async function run() {
  console.log('--- AI PULSE BROADCASTER (v0.5.1) ---');
  const id = Date.now().toString();
  const rawFilename = `episode-${id}.mp3`;
  
  if (!fs.existsSync('audio')) fs.mkdirSync('audio');
  const finalPath = `audio/${rawFilename}`;
  const pcmFile = `temp-${id}.pcm`;

  const repoFullName = process.env.GITHUB_REPOSITORY || 'sunisankara/ai-pulse-podcast';
  const [owner, repo] = repoFullName.split('/');
  const baseUrl = `https://${owner}.github.io/${repo}`;

  try {
    let episodeData: any;

    if (IS_TEST) {
      console.log('MODE: DIAGNOSTIC (Short Signal)');
      execSync(`ffmpeg -f lavfi -i "sine=frequency=440:duration=10" -acodec libmp3lame -ab 128k ${finalPath}`);
      episodeData = {
        id,
        date: new Date().toISOString(),
        title: "Diagnostic Signal (v0.5.1)",
        audioUrl: `${baseUrl}/${finalPath}`,
        mainStories: ["System Handshake"]
      };
    } else {
      console.log('Step 1: Intelligence Gathering...');
      const news = await fetchAINews(["LLM Breakthroughs", "AI Agents", "Hardware", "Startup Funding"], true);
      
      console.log('Step 2: Script Synthesis...');
      const script = await generatePodcastScript(news.newsText);
      
      console.log('Step 3: Neural Voice Generation...');
      const segments = script.split('[TRANSITION]').filter(s => s.trim().length > 5);
      
      for (let i = 0; i < segments.length; i++) {
        console.log(`Synthesizing segment ${i+1} of ${segments.length}...`);
        const chunks = await generateSegmentAudio(segments[i]);
        for (const chunk of chunks) fs.appendFileSync(pcmFile, Buffer.from(chunk, 'base64'));
      }
      
      console.log('Step 4: Master Encoding...');
      execSync(`ffmpeg -f s16le -ar 24000 -ac 1 -i ${pcmFile} -acodec libmp3lame -ab 128k ${finalPath}`);
      if (fs.existsSync(pcmFile)) fs.unlinkSync(pcmFile);
      
      episodeData = {
        id,
        date: new Date().toISOString(),
        title: `AI Pulse: ${news.topStories[0] || 'Daily Intel'}`,
        audioUrl: `${baseUrl}/${finalPath}`,
        mainStories: news.topStories
      };
    }

    console.log('Step 5: Updating Local Database...');
    let history = [];
    if (fs.existsSync('episodes.json')) {
      history = JSON.parse(fs.readFileSync('episodes.json', 'utf8'));
    }
    history.unshift(episodeData);
    history = history.slice(0, 50); // Keep last 50
    fs.writeFileSync('episodes.json', JSON.stringify(history, null, 2));

    console.log('Step 6: Regenerating Public Feed...');
    const rss = generateRSSFeed(history, baseUrl);
    fs.writeFileSync('feed.xml', rss);

    console.log('--- BROADCAST COMPLETE ---');
    console.log(`Feed URL: ${baseUrl}/feed.xml`);
  } catch (error) {
    console.error('CRITICAL ENGINE FAILURE:', error);
    process.exit(1);
  }
}
run();