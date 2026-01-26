
import React, { useState, useEffect } from 'react';
import { fetchAINews, generatePodcastScript } from './services/gemini';

declare var window: any;

const VERSION = "v0.6.9 (HEADLESS OPTIMIZED)";

// --- CRYPTO UTILS ---
const ENCRYPTION_KEY_ALGO = { name: 'AES-GCM', length: 256 };
async function deriveKey(password: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  return window.crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, ENCRYPTION_KEY_ALGO, false, ['encrypt', 'decrypt']);
}
async function encryptData(data: string, password: string) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(data));
  return { encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))), salt: btoa(String.fromCharCode(...salt)), iv: btoa(String.fromCharCode(...iv)) };
}
async function decryptData(vault: any, password: string) {
  const salt = new Uint8Array(atob(vault.salt).split('').map(c => c.charCodeAt(0)));
  const iv = new Uint8Array(atob(vault.iv).split('').map(c => c.charCodeAt(0)));
  const encrypted = new Uint8Array(atob(vault.encrypted).split('').map(c => c.charCodeAt(0)));
  const key = await deriveKey(password, salt);
  const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

const App: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewScript, setPreviewScript] = useState<string>('');
  const [masterPassword, setMasterPassword] = useState('');
  const [isVaultLocked, setIsVaultLocked] = useState(() => !!localStorage.getItem('gh_vault'));
  const [activePat, setActivePat] = useState('');
  
  // Defaulting to user's specific credentials
  const [githubUser, setGithubUser] = useState((localStorage.getItem('gh_user') || 'sunisankara').trim());
  const [githubRepo, setGithubRepo] = useState((localStorage.getItem('gh_repo') || 'ai-pulse-podcast').trim());

  const handleLockVault = async () => {
    if (!activePat || !masterPassword || !githubUser || !githubRepo) { 
      setError("Setup incomplete: Check PAT, Repository, and Password."); 
      return; 
    }
    try {
      const vault = await encryptData(activePat, masterPassword);
      localStorage.setItem('gh_vault', JSON.stringify(vault));
      localStorage.setItem('gh_user', githubUser);
      localStorage.setItem('gh_repo', githubRepo);
      setIsVaultLocked(true);
      setActivePat('');
      setMasterPassword('');
      setError(null);
      setProgress("STATION SECURED");
    } catch (e) { setError("Encryption logic failed. Browser support issue?"); }
  };

  const handleUnlockVault = async () => {
    const vaultStr = localStorage.getItem('gh_vault');
    if (!vaultStr) { setError("No station data found."); return; }
    try {
      const vault = JSON.parse(vaultStr);
      const pat = await decryptData(vault, masterPassword);
      setActivePat(pat);
      setIsVaultLocked(false);
      setError(null);
      setProgress("STATION UNLOCKED");
    } catch (e) { setError("Decryption failed: Incorrect password."); }
  };

  const resetStation = () => {
    if (window.confirm("WARNING: This will wipe all station credentials from this browser. Proceed?")) {
      localStorage.removeItem('gh_vault');
      localStorage.removeItem('gh_user');
      localStorage.removeItem('gh_repo');
      setIsVaultLocked(false);
      setActivePat('');
      setGithubUser('sunisankara');
      setGithubRepo('ai-pulse-podcast');
      setError(null);
      setProgress("STATION RESET");
    }
  };

  const generatePreview = async () => {
    setIsPreviewing(true);
    setError(null);
    setProgress("RESEARCHING LATEST QUANTITATIVE DATA...");
    try {
      const news = await fetchAINews();
      setProgress("COMPILING 15-MINUTE BYTE-SIZED SCRIPT...");
      const script = await generatePodcastScript(news.newsText);
      setPreviewScript(script);
      setProgress("TRANSCRIPTION PREVIEW READY");
    } catch (err: any) { 
      setError(`Preview Failed: ${err.message}. Check your network or API connection.`); 
    } finally { setIsPreviewing(false); }
  };

  const triggerBroadcast = async () => {
    if (isVaultLocked || !activePat) { setError("Station is locked. Please enter your master password below."); return; }
    setProgress("DISPATCHING CLOUD BROADCAST WORKFLOW...");
    try {
      const headers = { 'Authorization': `token ${activePat}`, 'Accept': 'application/vnd.github.v3+json' };
      const res = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/actions/workflows/podcast.yml/dispatches`, {
        method: 'POST', headers, body: JSON.stringify({ ref: 'main', inputs: { is_test: "false" } })
      });
      if (!res.ok) {
        const detail = await res.json();
        throw new Error(`Dispatch Refused: ${detail.message || res.statusText}`);
      }
      setProgress("BROADCAST COMMAND ACCEPTED");
      setTimeout(() => window.open(`https://github.com/${githubUser}/${githubRepo}/actions`, '_blank'), 1000);
    } catch (err: any) { setError(err.message); }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 font-sans text-gray-100 selection:bg-blue-500/40">
      
      {/* GLOBAL HEADER */}
      <div className="bg-gray-800 p-8 md:p-12 rounded-[3rem] border border-gray-700 shadow-2xl mb-12 flex flex-wrap justify-between items-center gap-10">
        <div className="flex items-center gap-8">
           <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center text-5xl shadow-2xl transition-all duration-500 ${isVaultLocked ? 'bg-gray-700 text-gray-500' : 'bg-blue-600 text-white shadow-blue-600/30'}`}>
             <i className={`fas ${isVaultLocked ? 'fa-shield' : 'fa-signal'}`}></i>
           </div>
           <div>
              <h1 className="text-6xl font-black italic text-blue-400 tracking-tighter uppercase leading-none mb-2">AI Daily Pulse</h1>
              <p className="text-[11px] font-black text-gray-500 tracking-[0.5em] uppercase">Sundaram Labs | Station Control {VERSION}</p>
           </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={generatePreview} 
            disabled={isPreviewing} 
            className="bg-gray-900 border border-gray-700 hover:border-blue-500 px-8 py-6 rounded-2xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-30"
          >
             {isPreviewing ? <i className="fas fa-spinner fa-spin mr-3"></i> : <i className="fas fa-file-lines mr-3"></i>}
             {isPreviewing ? 'Analyzing...' : 'Generate Newscast Preview'}
          </button>
          <button 
            onClick={triggerBroadcast} 
            disabled={isVaultLocked} 
            className="bg-blue-600 hover:bg-blue-500 px-12 py-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-blue-600/50 disabled:bg-gray-700 disabled:shadow-none transition-all active:scale-95"
          >
            <i className="fas fa-paper-plane mr-3"></i>
            Start Cloud Broadcast
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* TRANSCRIPTION VIEW */}
        <div className="lg:col-span-2 space-y-12">
          <div className="bg-black/60 p-12 rounded-[3.5rem] border border-gray-800 shadow-2xl h-full flex flex-col min-h-[650px]">
             <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <h3 className="text-[11px] font-black uppercase text-gray-500 tracking-[0.4em]">Live Intelligence Feed</h3>
                </div>
                {previewScript && (
                  <button onClick={() => { navigator.clipboard.writeText(previewScript); setProgress("COPIED TO CLIPBOARD"); }} className="text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-all">
                    <i className="fas fa-copy mr-2"></i> Copy
                  </button>
                )}
             </div>
             
             <div className="flex-1 bg-gray-950/80 rounded-[2.5rem] border border-gray-800 p-10 overflow-y-auto max-h-[600px] custom-scrollbar border-dashed">
                {previewScript ? (
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-mono text-gray-300 leading-relaxed text-sm">
                      {previewScript}
                    </pre>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                    <i className="fas fa-microchip text-7xl mb-8"></i>
                    <p className="text-lg font-black uppercase tracking-widest">Station Idle</p>
                    <p className="text-xs mt-4 max-w-xs mx-auto leading-relaxed">Run a preview to fetch today's 7-pillar intelligence and generate the 15-minute byte-sized newscast script.</p>
                  </div>
                )}
             </div>

             <div className="mt-10 flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="flex -space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-gray-900 flex items-center justify-center text-[10px] font-bold">A</div>
                      <div className="w-8 h-8 rounded-full bg-amber-500 border-2 border-gray-900 flex items-center justify-center text-[10px] font-bold">M</div>
                   </div>
                   <p className="text-[11px] font-black uppercase text-gray-500 tracking-widest">Alex & Marcus: Active</p>
                </div>
                <p className="text-[11px] font-black uppercase text-blue-500 tracking-widest">{progress || 'Standby'}</p>
             </div>
          </div>
        </div>

        {/* SECURITY & CONTROL */}
        <div className="space-y-12">
           <div className="bg-gray-800 p-10 rounded-[3rem] border border-gray-700 shadow-xl overflow-hidden relative">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-[11px] font-black uppercase text-gray-400 tracking-[0.3em]">Station Control</h3>
                <i className={`fas ${isVaultLocked ? 'fa-lock text-red-500' : 'fa-unlock text-green-500'}`}></i>
              </div>
              
              {!localStorage.getItem('gh_vault') ? (
                <div className="space-y-5">
                  <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Cloud Configuration Required:</p>
                  <input value={githubUser} onChange={e => setGithubUser(e.target.value)} placeholder="GitHub User" className="w-full bg-black/40 border border-gray-700 rounded-2xl px-6 py-5 text-xs font-mono text-blue-400 outline-none focus:border-blue-500 transition-all" />
                  <input value={githubRepo} onChange={e => setGithubRepo(e.target.value)} placeholder="Repository Name" className="w-full bg-black/40 border border-gray-700 rounded-2xl px-6 py-5 text-xs font-mono text-blue-400 outline-none focus:border-blue-500 transition-all" />
                  <input type="password" value={activePat} onChange={e => setActivePat(e.target.value)} placeholder="GitHub PAT (token)" className="w-full bg-black/40 border border-gray-700 rounded-2xl px-6 py-5 text-xs font-mono text-amber-400 outline-none focus:border-amber-500 transition-all" />
                  <input type="password" value={masterPassword} onChange={e => setMasterPassword(e.target.value)} placeholder="Station Password" className="w-full bg-black/40 border border-gray-700 rounded-2xl px-6 py-5 text-xs font-mono text-white outline-none focus:border-gray-500 transition-all" />
                  <button onClick={handleLockVault} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-blue-500 transition-all">Secure & Lock Station</button>
                </div>
              ) : isVaultLocked ? (
                <div className="space-y-8 py-6 flex flex-col items-center">
                  <div className="w-20 h-20 bg-gray-900 border border-gray-700 rounded-full flex items-center justify-center text-red-500 text-2xl shadow-inner mb-2">
                    <i className="fas fa-shield-halved"></i>
                  </div>
                  <div className="w-full space-y-4 text-center">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Station Locked</p>
                    <input 
                      type="password" 
                      value={masterPassword} 
                      onChange={e => setMasterPassword(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && handleUnlockVault()}
                      placeholder="Enter Master Password" 
                      className="w-full bg-black/50 border border-gray-700 rounded-2xl px-6 py-5 text-center font-mono text-blue-400 outline-none focus:border-blue-500" 
                    />
                    <button onClick={handleUnlockVault} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-blue-600/30 hover:bg-blue-500 transition-all">Unlock Dashboard</button>
                  </div>
                  <button onClick={resetStation} className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] hover:text-red-500 transition-colors pt-6">Clear All Settings</button>
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="flex items-center gap-5 p-6 bg-green-500/10 border border-green-500/20 rounded-3xl">
                      <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center text-green-500">
                        <i className="fas fa-check"></i>
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase text-green-500">Station Active</p>
                        <p className="text-[10px] font-mono text-gray-500 truncate max-w-[140px]">{githubUser}/{githubRepo}</p>
                      </div>
                   </div>
                   <button onClick={() => setIsVaultLocked(true)} className="w-full bg-gray-900 border border-gray-700 py-5 rounded-2xl font-black uppercase text-[9px] tracking-widest text-gray-500 hover:text-white transition-all">Relock Station Control</button>
                   <button onClick={resetStation} className="w-full text-[8px] font-black text-gray-700 uppercase tracking-widest hover:text-red-500 transition-colors text-center">Wipe Credentials</button>
                </div>
              )}
           </div>

           <div className="bg-gray-800 p-8 rounded-[3rem] border border-gray-700 shadow-xl opacity-60">
              <p className="text-[10px] font-black text-center text-gray-500 uppercase tracking-[0.2em]">Automated cron schedule active at 05:00 UTC</p>
           </div>
        </div>

      </div>
      
      {error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-600 text-white px-10 py-7 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(220,38,38,0.5)] flex items-center gap-8 animate-in fade-in slide-in-from-bottom-10 duration-300 z-50">
           <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">
             <i className="fas fa-triangle-exclamation"></i>
           </div>
           <div>
             <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">System Fault</p>
             <p className="font-bold text-sm leading-tight max-w-lg">{error}</p>
           </div>
           <button onClick={() => setError(null)} className="ml-4 hover:scale-110 transition-transform"><i className="fas fa-xmark text-xl"></i></button>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #444; }
      `}</style>
    </div>
  );
};

export default App;
