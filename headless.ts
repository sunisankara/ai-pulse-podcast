import { fetchAINews, generatePodcastScript, generateSegmentAudio } from './services/gemini.js';
import { generateRSSFeed } from './utils/rss.js';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Buffer } from 'buffer';

const IS_TEST = process.env.IS_TEST === 'true';

async function run() {
  console.log('--- AI PULSE BROADCASTER (v0.5.0) ---');
  const id = Date.now().toString();
  const rawFilename = `episode-${id}.mp3`;
  
  if (!fs.existsSync('audio')) fs.mkdirSync('audio');
  const finalPath = `audio/${rawFilename}`;
  const pcmFile = `temp-${id}.pcm`;

  // Determine Public URL for GitHub Pages
  const [owner, repo] = process.env.GITHUB_REPOSITORY!.split('/');
  // Standard GitHub Pages URL pattern
  const baseUrl = `https://${owner}.github.io/${repo}`;

  try {
    let episodeData: any;

    if (IS_TEST) {
      console.log('MODE: DIAGNOSTIC');
      execSync(`ffmpeg -f lavfi -i "sine=frequency=440:duration=30" -acodec libmp3lame -ab 128k ${finalPath}`);
      episodeData = {
        id,
        date: new Date().toISOString(),
        title: "Diagnostic Signal (v0.5.0)",
        audioUrl: `${baseUrl}/${finalPath}`,
        mainStories: ["System Handshake"]
      };
    } else {
      console.log('MODE: FULL 15m PRODUCTION');
      const news = await fetchAINews(["LLM Breakthroughs", "AI Agents", "Hardware", "Startup Funding"], true);
      const script = await generatePodcastScript(news.newsText);
      const segments = script.split('[TRANSITION]').filter(s => s.trim().length > 5);
      
      for (const segment of segments) {
        const chunks = await generateSegmentAudio(segment);
        for (const chunk of chunks) fs.appendFileSync(pcmFile, Buffer.from(chunk, 'base64'));
      }
      execSync(`ffmpeg -f s16le -ar 24000 -ac 1 -i ${pcmFile} -acodec libmp3lame -ab 128k ${finalPath}`);
      fs.unlinkSync(pcmFile);
      
      episodeData = {
        id,
        date: new Date().toISOString(),
        title: `AI Pulse: ${news.topStories[0] || 'Daily Intel'}`,
        audioUrl: `${baseUrl}/${finalPath}`,
        mainStories: news.topStories
      };
    }

    let history = [];
    if (fs.existsSync('episodes.json')) {
      history = JSON.parse(fs.readFileSync('episodes.json', 'utf8'));
    }
    history.unshift(episodeData);
    fs.writeFileSync('episodes.json', JSON.stringify(history, null, 2));

    const rss = generateRSSFeed(history, baseUrl);
    fs.writeFileSync('feed.xml', rss);

    console.log('--- PUBLIC DEPLOY READY ---');
  } catch (error) {
    console.error('ENGINE CRASH:', error);
    process.exit(1);
  }
}
run();