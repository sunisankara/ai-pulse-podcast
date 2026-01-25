import { fetchAINews, generatePodcastScript, generateSegmentAudio } from './services/gemini.js';
import { generateRSSFeed } from './utils/rss.js';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Buffer } from 'buffer';

const IS_TEST = process.env.IS_TEST === 'true';

async function run() {
  console.log('--- AI PULSE BROADCASTER (v0.4.3) ---');
  const id = Date.now().toString();
  const rawFilename = `episode-${id}.mp3`;
  
  if (!fs.existsSync('audio')) fs.mkdirSync('audio');
  const finalPath = `audio/${rawFilename}`;
  const pcmFile = `temp-${id}.pcm`;

  const [owner, repo] = process.env.GITHUB_REPOSITORY!.split('/');
  const baseUrl = `https://${owner}.github.io/${repo}`;

  try {
    let episodeData: any;

    if (IS_TEST) {
      console.log('MODE: DIAGNOSTIC (30s Signal)');
      execSync(`ffmpeg -f lavfi -i "sine=frequency=440:duration=30" -acodec libmp3lame -ab 128k ${finalPath}`);
      episodeData = {
        id,
        date: new Date().toISOString(),
        title: "Diagnostic Signal",
        audioUrl: `${baseUrl}/${finalPath}`,
        mainStories: ["System Check"]
      };
    } else {
      console.log('MODE: FULL 15-MINUTE BROADCAST');
      
      console.log('Step 1: Deep Research News...');
      const news = await fetchAINews(["LLM Breakthroughs", "AI Hardware", "Corporate AI Deals", "Robotics"], true);
      
      console.log('Step 2: Drafting Long-form Script...');
      const script = await generatePodcastScript(news.newsText);
      
      console.log('Step 3: Multi-Speaker Voice Synthesis...');
      const segments = script.split('[TRANSITION]').filter(s => s.trim().length > 5);
      
      for (let i = 0; i < segments.length; i++) {
        console.log(`Synthesizing Segment ${i+1} of ${segments.length}...`);
        const chunks = await generateSegmentAudio(segments[i]);
        for (const chunk of chunks) {
          fs.appendFileSync(pcmFile, Buffer.from(chunk, 'base64'));
        }
      }

      console.log('Step 4: Master MP3 Encoding...');
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

    console.log('--- BROADCAST COMPLETE (v0.4.3) ---');
  } catch (error) {
    console.error('CRITICAL ENGINE FAILURE:', error);
    process.exit(1);
  }
}
run();