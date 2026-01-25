import { fetchAINews, generatePodcastScript, generateSegmentAudio } from './services/gemini.js';
import { generateRSSFeed } from './utils/rss.js';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Buffer } from 'buffer';

const IS_TEST = process.env.IS_TEST === 'true';

async function run() {
  console.log('--- AI PULSE BROADCASTER STARTING (ESM) ---');
  const id = Date.now().toString();
  const filename = `episode-${id}.mp3`;
  const pcmFile = `temp-${id}.pcm`;

  try {
    let episodeData: any;

    if (IS_TEST) {
      console.log('MODE: DIAGNOSTIC TONE');
      execSync(`ffmpeg -f lavfi -i "sine=frequency=440:duration=300" -acodec libmp3lame -ab 128k ${filename}`);
      episodeData = {
        id,
        date: new Date().toISOString(),
        title: "System Diagnostic Test - 440Hz Tone",
        script: "This is a diagnostic tone broadcast.",
        audioUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/releases/download/v1.0.0/${filename}`,
        topics: ["Diagnostics"],
        mainStories: ["Sine Wave Test"],
        status: 'generated'
      };
    } else {
      console.log('MODE: PRODUCTION AI NEWS');
      const news = await fetchAINews(["AI Breakthroughs", "Market News"], true);
      const script = await generatePodcastScript(news.newsText);
      const segments = script.split('[TRANSITION]').filter(s => s.trim().length > 5);
      
      for (const segment of segments) {
        const chunks = await generateSegmentAudio(segment);
        for (const chunk of chunks) fs.appendFileSync(pcmFile, Buffer.from(chunk, 'base64'));
      }
      execSync(`ffmpeg -f s16le -ar 24000 -ac 1 -i ${pcmFile} -acodec libmp3lame -ab 128k ${filename}`);
      fs.unlinkSync(pcmFile);
      
      episodeData = {
        id,
        date: new Date().toISOString(),
        title: `AI Pulse: ${news.topStories[0] || 'Daily Update'}`,
        script,
        audioUrl: "", 
        topics: news.autoInjectedTopics,
        mainStories: news.topStories,
        status: 'generated'
      };
    }

    let history = [];
    if (fs.existsSync('episodes.json')) {
      history = JSON.parse(fs.readFileSync('episodes.json', 'utf8'));
    }
    history.unshift(episodeData);
    fs.writeFileSync('episodes.json', JSON.stringify(history, null, 2));

    const rss = generateRSSFeed(history);
    fs.writeFileSync('feed.xml', rss);

    console.log('--- BROADCAST COMPLETE ---');
  } catch (error) {
    console.error('CRITICAL ERROR:', error);
    process.exit(1);
  }
}
run();