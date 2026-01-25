
import React, { useState, useEffect } from 'react';
import { PodcastEpisode, GenerationStep } from './types';

declare var window: any;

const VERSION = "v0.4.3 (FULL-EPISODE)";

// --- SOURCE FILES DEFINITIONS ---
const packageJSON = `{
  "name": "ai-pulse-podcast",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@google/genai": "^1.38.0",
    "tsx": "^4.7.1",
    "typescript": "^5.3.3"
  }
}`;

const tsconfigJSON = `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "*": ["node_modules/*"] }
  }
}`;

const workflowYAML = `name: Daily Podcast Broadcast
on:
  schedule:
    - cron: '0 5 * * 1-5'
  workflow_dispatch:
    inputs:
      is_test:
        description: 'Diagnostic Test'
        required: false
        default: 'false'
jobs:
  broadcast:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install System Tools
        run: sudo apt-get update && sudo apt-get install -y ffmpeg
      - name: Install Dependencies
        run: npm install
      - name: Run Headless Station
        env:
          API_KEY: \${{ secrets.API_KEY }}
          IS_TEST: \${{ github.event.inputs.is_test || 'false' }}
          GITHUB_REPOSITORY: \${{ github.repository }}
        run: npx tsx headless.ts
      - name: Commit and Push Changes
        run: |
          git config --global user.name "AI Pulse Bot"
          git config --global user.email "bot@sundaramlabs.ai"
          git add .
          git commit -m "Broadcast Update: \$(date +'%Y-%m-%d')" || echo "No changes to commit"
          git push`;

const headlessTS = `import { fetchAINews, generatePodcastScript, generateSegmentAudio } from './services/gemini.js';
import { generateRSSFeed } from './utils/rss.js';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Buffer } from 'buffer';

const IS_TEST = process.env.IS_TEST === 'true';

async function run() {
  console.log('--- AI PULSE BROADCASTER (v0.4.3) ---');
  const id = Date.now().toString();
  const rawFilename = \`episode-\${id}.mp3\`;
  
  if (!fs.existsSync('audio')) fs.mkdirSync('audio');
  const finalPath = \`audio/\${rawFilename}\`;
  const pcmFile = \`temp-\${id}.pcm\`;

  const [owner, repo] = process.env.GITHUB_REPOSITORY!.split('/');
  const baseUrl = \`https://\${owner}.github.io/\${repo}\`;

  try {
    let episodeData: any;

    if (IS_TEST) {
      console.log('MODE: DIAGNOSTIC (30s Signal)');
      execSync(\`ffmpeg -f lavfi -i "sine=frequency=440:duration=30" -acodec libmp3lame -ab 128k \${finalPath}\`);
      episodeData = {
        id,
        date: new Date().toISOString(),
        title: "Diagnostic Signal",
        audioUrl: \`\${baseUrl}/\${finalPath}\`,
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
        console.log(\`Synthesizing Segment \${i+1} of \${segments.length}...\`);
        const chunks = await generateSegmentAudio(segments[i]);
        for (const chunk of chunks) {
          fs.appendFileSync(pcmFile, Buffer.from(chunk, 'base64'));
        }
      }

      console.log('Step 4: Master MP3 Encoding...');
      execSync(\`ffmpeg -f s16le -ar 24000 -ac 1 -i \${pcmFile} -acodec libmp3lame -ab 128k \${finalPath}\`);
      fs.unlinkSync(pcmFile);
      
      episodeData = {
        id,
        date: new Date().toISOString(),
        title: \`AI Pulse: \${news.topStories[0] || 'Daily Intel'}\`,
        audioUrl: \`\${baseUrl}/\${finalPath}\`,
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
run();`;

const typesTS = `export interface PodcastEpisode {
  id: string;
  date: string;
  title: string;
  audioUrl: string;
  mainStories: string[];
}
export enum GenerationStep { IDLE='IDLE', SEARCHING='SEARCHING', REFINING='REFINING', SCRIPTING='SCRIPTING', SPEAKING='SPEAKING', COMPLETED='COMPLETED', ERROR='ERROR' }`;

const geminiTS = `import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const fetchAINews = async (cats: string[], auto: boolean) => {
  const prompt = \`Research today's major AI news in: \${cats.join(', ')}. 
  Focus on: Technical papers, major corporate shifts, and open-source breakthroughs.
  Provide a detailed report.
  At the end, add [METADATA] TOP_STORIES: Story A, Story B, Story C\`;

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
  const prompt = \`You are writing a 15-minute podcast script for "AI Pulse".
  Hosts: Alex (Technical/Skeptic) and Marcus (Optimist/Business).
  
  News Context:
  \${newsText}
  
  Requirements:
  - Dialogue must be conversational, high-energy, and insightful.
  - Break the script into at least 10 sections using [TRANSITION] markers.
  - Total script length should be approximately 2500 words for a 15-minute runtime.
  - Format like this:
    Alex: [Dialogue]
    Marcus: [Dialogue]
    [TRANSITION]
    ...
  \`;

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
};`;

const rssTS = `export function generateRSSFeed(episodes: any[], baseUrl: string) {
  const items = episodes.map(e => \`
    <item>
      <title>\${e.title}</title>
      <pubDate>\${new Date(e.date).toUTCString()}</pubDate>
      <enclosure url="\${e.audioUrl}" type="audio/mpeg" length="0"/>
      <itunes:summary>\${e.title}</itunes:summary>
      <guid>\${e.id}</guid>
    </item>\`).join('');
  return \`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>AI Daily Pulse</title>
    <link>\${baseUrl}</link>
    <language>en-us</language>
    <itunes:author>Sundaram Labs</itunes:author>
    <itunes:summary>Your daily 15-minute conversational deep dive into latest AI developments.</itunes:summary>
    \${items}
  </channel>
</rss>\`;
}`;

const audioTS = `export const decode = (b: string) => Buffer.from(b, 'base64');`;

const App: React.FC = () => {
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [diagStep, setDiagStep] = useState<number>(0); 
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [githubUser, setGithubUser] = useState((localStorage.getItem('gh_user') || '').trim());
  const [githubRepo, setGithubRepo] = useState((localStorage.getItem('gh_repo') || 'ai-pulse-podcast').trim());
  const [ghToken, setGhToken] = useState((localStorage.getItem('gh_token') || '').trim());

  useEffect(() => {
    localStorage.setItem('gh_user', githubUser.trim());
    localStorage.setItem('gh_repo', githubRepo.trim());
    localStorage.setItem('gh_token', ghToken.trim());
  }, [githubUser, githubRepo, ghToken]);

  const getHeaders = () => {
    const token = ghToken.trim();
    return {
      'Authorization': token.startsWith('github_pat_') ? `Bearer ${token}` : `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  };

  const toBase64 = (str: string) => {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
    }));
  };

  const syncFile = async (path: string, content: string, branch: string) => {
    const headers = getHeaders();
    try {
      const existing = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${path}?ref=${branch}`, { headers });
      let sha = undefined;
      if (existing.ok) {
        const data = await existing.json();
        sha = data.sha;
      }

      const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${path}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `Update ${path} (v0.4.3)`,
          content: toBase64(content),
          branch,
          sha
        })
      });
      return res.ok;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const performFullSync = async () => {
    if (!githubUser || !githubRepo || !ghToken) {
      setError("Please fill in all configuration fields.");
      return;
    }
    
    setIsSyncing(true);
    setError(null);
    setProgress("RESTORE ENGINE (v0.4.3)...");
    
    try {
      const headers = getHeaders();
      const repoRes = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}`, { headers });
      const repoData = await repoRes.json();
      if (!repoRes.ok) throw new Error(`Repo Access Failed: ${repoData.message}`);
      const branch = repoData.default_branch || 'main';

      const filesToSync = [
        { path: 'package.json', content: packageJSON },
        { path: 'tsconfig.json', content: tsconfigJSON },
        { path: '.github/workflows/podcast.yml', content: workflowYAML },
        { path: 'headless.ts', content: headlessTS },
        { path: 'types.ts', content: typesTS },
        { path: 'services/gemini.ts', content: geminiTS },
        { path: 'utils/rss.ts', content: rssTS },
        { path: 'utils/audio.ts', content: audioTS },
        { path: 'episodes.json', content: '[]' }
      ];

      for (const file of filesToSync) {
        setProgress(`SYNC: ${file.path}`);
        const ok = await syncFile(file.path, file.content, branch);
        if (!ok) throw new Error(`Failed to sync ${file.path}`);
      }

      setProgress("ENGINE UPDATED TO FULL LENGTH MODE!");
      setStep(GenerationStep.COMPLETED);
    } catch (err: any) {
      setError(err.message);
      setStep(GenerationStep.ERROR);
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerBroadcast = async () => {
    if (!githubUser || !githubRepo || !ghToken) {
      setError("Configuration Incomplete.");
      return;
    }
    const headers = getHeaders();
    try {
      setError(null);
      setStep(GenerationStep.SEARCHING);
      setDiagStep(1); setProgress("VERIFYING IDENTITY...");
      const userRes = await fetch('https://api.github.com/user', { headers });
      if (!userRes.ok) throw new Error("TOKEN_INVALID");

      setDiagStep(2); setProgress("HANDSHAKING REPO...");
      const repoRes = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}`, { headers });
      const repoData = await repoRes.json();
      if (!repoRes.ok) throw new Error("REPO_NOT_FOUND");

      setDiagStep(4); setProgress("DISPATCHING 15m WORKER...");
      const dispatchRes = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/actions/workflows/podcast.yml/dispatches`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ref: repoData.default_branch || 'main', inputs: { is_test: "false" } })
      });
      
      if (!dispatchRes.ok) throw new Error("TRIGGER_FAILED");

      setStep(GenerationStep.COMPLETED);
      setDiagStep(5);
      setProgress("BROADCAST STARTED. CHECK GITHUB ACTIONS.");
      setTimeout(() => {
        window.open(`https://github.com/${githubUser}/${githubRepo}/actions`, '_blank');
      }, 1500);
    } catch (err: any) {
      setError(err.message);
      setStep(GenerationStep.ERROR);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 font-sans text-gray-100">
      <div className="bg-gray-800 p-10 rounded-[3rem] border border-gray-700 shadow-2xl mb-10 flex flex-wrap justify-between items-center gap-6">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-3xl shadow-lg shadow-blue-500/20">
             <i className="fas fa-tower-broadcast text-white"></i>
           </div>
           <div>
              <h1 className="text-4xl font-black italic text-blue-400 tracking-tighter uppercase leading-none">AI Pulse Console</h1>
              <p className="text-[10px] font-black text-gray-500 tracking-[0.3em] mt-2">{VERSION}</p>
           </div>
        </div>
        <div className="flex gap-4">
          <button onClick={performFullSync} disabled={isSyncing} className="bg-gray-700 hover:bg-gray-600 px-8 py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-50 border border-gray-600">
            {isSyncing ? 'Syncing...' : 'Restore Full Engine'}
          </button>
          <button onClick={triggerBroadcast} disabled={isSyncing} className="bg-blue-600 hover:bg-blue-500 px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-blue-600/30">
            Ignite Full Broadcast
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="bg-gray-800 p-10 rounded-[2.5rem] border border-gray-700">
             <h2 className="text-[10px] font-black uppercase text-gray-500 mb-6 tracking-widest flex items-center gap-2">
               <i className="fas fa-sliders"></i> System Config
             </h2>
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-600 uppercase ml-2">GitHub User</label>
                      <input value={githubUser} onChange={e => setGithubUser(e.target.value)} placeholder="Username" className="w-full bg-black/40 border border-gray-700 rounded-xl px-5 py-4 text-sm font-mono text-blue-400" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-600 uppercase ml-2">GitHub Repo</label>
                      <input value={githubRepo} onChange={e => setGithubRepo(e.target.value)} placeholder="Repository" className="w-full bg-black/40 border border-gray-700 rounded-xl px-5 py-4 text-sm font-mono text-blue-400" />
                   </div>
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-gray-600 uppercase ml-2">Personal Access Token</label>
                   <input type="password" value={ghToken} onChange={e => setGhToken(e.target.value)} placeholder="ghp_..." className="w-full bg-black/40 border border-gray-700 rounded-xl px-5 py-4 text-sm font-mono text-amber-400" />
                </div>
             </div>
          </div>

          <div className="bg-black/60 p-10 rounded-[2.5rem] border border-gray-800 min-h-[200px] font-mono">
             <h3 className="text-[10px] font-black uppercase text-gray-600 mb-6 tracking-widest">Broadcaster Log</h3>
             <div className={`p-4 rounded-xl border ${error ? 'bg-red-500/10 border-red-500/40 text-red-500' : 'bg-blue-500/5 border-blue-500/20 text-blue-400'} text-[11px] leading-relaxed`}>
                {error ? error : (progress || 'Standby for 15-minute mission...')}
             </div>
          </div>
        </div>

        <div className="bg-blue-600 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-4xl font-black italic tracking-tighter mb-12 uppercase">Mission Profile</h2>
            <div className="space-y-6">
              <div className="bg-white/10 p-6 rounded-2xl border border-white/10">
                 <p className="text-[10px] font-black uppercase opacity-60 mb-1">Target Runtime</p>
                 <p className="font-bold">15:00 Minutes (Full Length)</p>
              </div>
              <div className="bg-white/10 p-6 rounded-2xl border border-white/10">
                 <p className="text-[10px] font-black uppercase opacity-60 mb-1">Speaker Logic</p>
                 <p className="font-bold">Kore (Alex) & Puck (Marcus)</p>
              </div>
              <div className="bg-white/10 p-6 rounded-2xl border border-white/10">
                 <p className="text-[10px] font-black uppercase opacity-60 mb-1">Public URL</p>
                 <p className="font-bold truncate">https://{githubUser}.github.io/{githubRepo}/feed.xml</p>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        </div>
      </div>
    </div>
  );
};

export default App;
