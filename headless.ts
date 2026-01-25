import { fetchAINews, generatePodcastScript, generateSegmentAudio } from './services/gemini.js';
import { generateRSSFeed } from './utils/rss.js';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Buffer } from 'buffer';

const IS_TEST = process.env.IS_TEST === 'true';

async function run() {
  console.log('--- AI DAILY PULSE BROADCASTER (v0.6.0) ---');
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
      console.log('MODE: DIAGNOSTIC (1s Beep)');
      execSync(`ffmpeg -f lavfi -i "sine=frequency=1000:duration=1" -acodec libmp3lame ${finalPath}`);
      episodeData = {
        id,
        date: new Date().toISOString(),
        title: "Station Health Check (v0.6.0)",
        audioUrl: `${baseUrl}/${finalPath}`,
        mainStories: ["System Verification"]
      };
    } else {
      console.log('Step 1: Deep Research (Technical & Business focus)...');
      const news = await fetchAINews(["Claude for Teams/Co-work", "Davos AI Sentiment", "Journalistic AI Insights", "GPU Supply Chains"], true);
      
      console.log('Step 2: Script Synthesis (Conversational Mode)...');
      const script = await generatePodcastScript(news.newsText);
      
      console.log('Step 3: Multi-Speaker Voice Production...');
      const segments = script.split('[TRANSITION]').filter(s => s.trim().length > 5);
      
      for (let i = 0; i < segments.length; i++) {
        console.log(`Generating Audio Segment ${i+1} of ${segments.length}...`);
        const chunks = await generateSegmentAudio(segments[i]);
        for (const chunk of chunks) fs.appendFileSync(pcmFile, Buffer.from(chunk, 'base64'));
      }
      
      console.log('Step 4: Final Master Encoding...');
      execSync(`ffmpeg -f s16le -ar 24000 -ac 1 -i ${pcmFile} -acodec libmp3lame -ab 128k ${finalPath}`);
      if (fs.existsSync(pcmFile)) fs.unlinkSync(pcmFile);
      
      episodeData = {
        id,
        date: new Date().toISOString(),
        title: `AI Daily Pulse: ${news.topStories[0] || 'Daily Report'}`,
        audioUrl: `${baseUrl}/${finalPath}`,
        mainStories: news.topStories
      };
    }

    let history = [];
    if (fs.existsSync('episodes.json')) {
      history = JSON.parse(fs.readFileSync('episodes.json', 'utf8'));
    }
    history.unshift(episodeData);
    fs.writeFileSync('episodes.json', JSON.stringify(history.slice(0, 50), null, 2));

    const rss = generateRSSFeed(history, baseUrl);
    fs.writeFileSync('feed.xml', rss);

    console.log('--- BROADCAST SUCCESSFUL ---');
  } catch (error) {
    console.error('ENGINE CRITICAL FAILURE:', error);
    process.exit(1);
  }
}
run();