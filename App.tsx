
import React, { useState, useEffect, useRef } from 'react';
import { fetchAINews, generatePodcastScript, generateSegmentAudio } from './services/gemini';
import { PodcastEpisode, GenerationStep, IntelligenceReport, ScheduleConfig } from './types';
import { decode, decodeAudioData, audioBufferToWav, generateTechJingle, generateFiveMinuteTone } from './utils/audio';
import { generateRSSFeed } from './utils/rss';

declare var window: any;

const VERSION = "v0.3 (MP3 STABLE)";

const App: React.FC = () => {
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Partial<PodcastEpisode>>({});
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  
  const [githubUser, setGithubUser] = useState(localStorage.getItem('gh_user') || '');
  const [githubRepo, setGithubRepo] = useState(localStorage.getItem('gh_repo') || 'ai-pulse-podcast');
  const [ghToken, setGhToken] = useState(localStorage.getItem('gh_token') || '');
  const [ownerEmail, setOwnerEmail] = useState(localStorage.getItem('owner_email') || '');

  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    localStorage.setItem('gh_user', githubUser);
    localStorage.setItem('gh_repo', githubRepo);
    localStorage.setItem('gh_token', ghToken);
    localStorage.setItem('owner_email', ownerEmail);
  }, [githubUser, githubRepo, ghToken, ownerEmail]);

  useEffect(() => {
    const saved = localStorage.getItem('ai_pulse_episodes');
    if (saved) setEpisodes(JSON.parse(saved));
  }, []);

  const handleTestConnection = async () => {
    if (!githubUser || !githubRepo || !ghToken) {
      setError("Please provide GitHub Username, Repo, and Token to test the connection.");
      return;
    }
    
    try {
      setStep(GenerationStep.SPEAKING);
      setProgress('INITIATING REMOTE DIAGNOSTIC TEST...');
      
      // We trigger the GitHub Action via API to prove the connection
      const response = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/actions/workflows/podcast.yml/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { is_test: "true" }
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(`GitHub API Error: ${data.message}`);
      }

      setStep(GenerationStep.COMPLETED);
      setProgress('Diagnostic workflow triggered on GitHub. Checking logs in 5 seconds...');
      setTimeout(() => {
        window.open(`https://github.com/${githubUser}/${githubRepo}/actions`, '_blank');
      }, 5000);
    } catch (err: any) {
      setError(err.message);
      setStep(GenerationStep.ERROR);
    }
  };

  const rssLink = githubUser ? `https://${githubUser}.github.io/${githubRepo}/feed.xml` : 'Configure GitHub Settings';

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-6 mb-12 bg-gray-800 p-8 rounded-[3rem] border border-gray-700 shadow-2xl">
        <div>
          <h1 className="text-5xl font-black italic tracking-tighter text-blue-400 mb-2">AI PULSE CLOUD</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">Sundaram Labs | {VERSION}</p>
        </div>
        <div className="text-right flex items-center gap-4">
           <button onClick={handleTestConnection} className="bg-amber-500 hover:bg-amber-400 text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-900/20">
             <i className="fas fa-plug-circle-bolt mr-2"></i> Test Connection
           </button>
          <span className="text-[10px] font-black bg-blue-500/10 text-blue-400 px-4 py-3 rounded-2xl border border-blue-500/20">
            HEADLESS MODE ACTIVE
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Setup & Configuration */}
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-gray-800 rounded-[3rem] p-12 border border-gray-700 shadow-xl">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-8 flex items-center gap-3">
              <i className="fab fa-github text-3xl"></i> Cloud Infrastructure Setup
            </h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">GitHub Username</label>
                  <input value={githubUser} onChange={(e) => setGithubUser(e.target.value)} placeholder="e.g. sundaram-labs" className="w-full bg-black/40 border border-gray-700 rounded-2xl px-5 py-4 text-sm text-blue-400 font-mono outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">Repository Name</label>
                  <input value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} className="w-full bg-black/40 border border-gray-700 rounded-2xl px-5 py-4 text-sm text-blue-400 font-mono outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-2">GitHub Access Token (PAT)</label>
                <input type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxx" className="w-full bg-black/40 border border-gray-700 rounded-2xl px-5 py-4 text-sm text-amber-400 font-mono outline-none focus:border-blue-500" />
                <p className="text-[9px] text-gray-500 mt-2 px-2 italic">Required only for triggering diagnostic tests from this dashboard.</p>
              </div>

              <div className="bg-blue-600/10 p-8 rounded-[2rem] border border-blue-500/20">
                <h3 className="text-sm font-black text-blue-400 uppercase mb-4">Your Broadcast Feed (RSS)</h3>
                <div className="flex gap-4">
                  <input readOnly value={rssLink} className="flex-1 bg-black/40 border border-gray-700 rounded-xl px-5 py-3 text-xs font-mono text-gray-400" />
                  <button onClick={() => navigator.clipboard.writeText(rssLink)} className="bg-blue-600 px-6 rounded-xl hover:bg-blue-500 transition-all font-black uppercase text-[10px]">Copy</button>
                </div>
                <p className="mt-4 text-[10px] text-gray-500 italic">Submit this link to Spotify Podcasts / Apple Podcasts once GitHub Pages is enabled.</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-[3rem] p-12 border border-gray-700">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6">Cloud Manual Controls</h2>
            <div className="flex gap-4">
              <button onClick={() => window.open(`https://github.com/${githubUser}/${githubRepo}/actions/workflows/podcast.yml`, '_blank')} className="flex-1 bg-blue-600 hover:bg-blue-500 py-6 rounded-3xl text-xs font-black uppercase tracking-widest transition-all">
                Trigger Daily Broadcast
              </button>
              <button onClick={() => window.open(`https://github.com/${githubUser}/${githubRepo}/actions`, '_blank')} className="flex-1 bg-gray-700 hover:bg-gray-600 py-6 rounded-3xl text-xs font-black uppercase tracking-widest transition-all">
                View Server Logs
              </button>
            </div>
            {(step !== GenerationStep.IDLE || error) && (
               <div className={`mt-8 p-6 rounded-3xl border ${error ? 'bg-red-500/10 border-red-500/40' : 'bg-black/40 border-blue-500/20 animate-pulse'}`}>
                  <p className={`text-[10px] font-black uppercase ${error ? 'text-red-500' : 'text-blue-400'}`}>{error ? 'System Fault' : step}</p>
                  <p className="text-xs italic text-gray-400">{error || progress}</p>
               </div>
            )}
          </div>
        </div>

        {/* Right: Headless Instructions */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-blue-600 rounded-[3rem] p-10 border border-blue-400 shadow-2xl text-white">
            <h2 className="text-3xl font-black italic tracking-tighter mb-6 uppercase">Cloud Setup</h2>
            <div className="space-y-6 text-sm">
              <div className="flex gap-4">
                <span className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center font-black flex-shrink-0">1</span>
                <p>Create a <b>GitHub</b> repository named <code>{githubRepo}</code>.</p>
              </div>
              <div className="flex gap-4">
                <span className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center font-black flex-shrink-0">2</span>
                <p>Go to <b>Settings &gt; Secrets</b>. Add <code>API_KEY</code> and <code>GH_TOKEN</code>.</p>
              </div>
              <div className="flex gap-4">
                <span className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center font-black flex-shrink-0">3</span>
                <p>Push <code>headless.ts</code>, <code>types.ts</code>, and <code>podcast.yml</code> to your repo.</p>
              </div>
              <div className="flex gap-4">
                <span className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center font-black flex-shrink-0">4</span>
                <p>Click "Test Connection" to verify the MP3 vault is online.</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-[2.5rem] p-10 border border-gray-700 h-[450px] flex flex-col shadow-lg overflow-hidden">
            <h3 className="text-xl font-black uppercase tracking-tighter mb-8 pb-4 border-b border-gray-700 flex justify-between">
              Cloud Archives <i className="fas fa-server text-gray-700"></i>
            </h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
              {episodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-30 italic text-[10px]">
                   <i className="fas fa-folder-open text-4xl mb-4"></i>
                   <p>No episodes logged in this session.</p>
                </div>
              ) : (
                episodes.map(e => (
                  <div key={e.id} className="p-5 rounded-2xl bg-gray-900 border border-gray-700 group flex items-center justify-between hover:border-blue-500/40 transition-all">
                    <div>
                      <span className="text-[9px] font-black text-blue-500 uppercase mb-1 block">{new Date(e.date).toLocaleDateString()}</span>
                      <p className="text-xs font-black text-gray-300 leading-tight">{e.title}</p>
                    </div>
                    <button onClick={() => window.open(e.audioUrl, '_blank')} className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-800 hover:bg-blue-600 transition-all">
                      <i className="fas fa-play text-xs"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
