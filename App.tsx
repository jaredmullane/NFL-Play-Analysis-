import React, { useState, useRef, useEffect } from 'react';
import { analyzeVideoClip } from './services/geminiService';
import { Field } from './components/Field';
import { AnalysisResult, AppState, Keyframe } from './types';
import { Play, Pause, Upload, Video, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);

  // Helper to get interpolated frame based on time
  const getCurrentInterpolatedFrame = (time: number, result: AnalysisResult): Keyframe | null => {
    if (!result || result.keyframes.length === 0) return null;
    
    // Find the keyframe just before and just after current time
    const frames = result.keyframes;
    
    if (time <= frames[0].timeOffset) return frames[0];
    if (time >= frames[frames.length - 1].timeOffset) return frames[frames.length - 1];

    const nextIndex = frames.findIndex(f => f.timeOffset > time);
    if (nextIndex === -1) return frames[frames.length - 1];
    
    const prevFrame = frames[nextIndex - 1];
    const nextFrame = frames[nextIndex];
    
    // Calculate interpolation factor (0 to 1)
    const duration = nextFrame.timeOffset - prevFrame.timeOffset;
    const elapsed = time - prevFrame.timeOffset;
    const t = duration === 0 ? 0 : elapsed / duration;

    // Interpolate helper
    const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

    // Interpolate Ball
    const ball = {
        x: lerp(prevFrame.ball.x, nextFrame.ball.x, t),
        y: lerp(prevFrame.ball.y, nextFrame.ball.y, t)
    };

    // Interpolate Players (Match by ID)
    // Note: This assumes simple matching. Complex tracking requires better ID persistence from Gemini.
    const teamRed = prevFrame.teamRed.map(p1 => {
        const p2 = nextFrame.teamRed.find(p => p.id === p1.id);
        if (!p2) return p1; // Should fade out in a real app
        return {
            id: p1.id,
            x: lerp(p1.x, p2.x, t),
            y: lerp(p1.y, p2.y, t)
        };
    });

    const teamBlue = prevFrame.teamBlue.map(p1 => {
        const p2 = nextFrame.teamBlue.find(p => p.id === p1.id);
        if (!p2) return p1;
        return {
            id: p1.id,
            x: lerp(p1.x, p2.x, t),
            y: lerp(p1.y, p2.y, t)
        };
    });

    return {
        timeOffset: time,
        ball,
        teamRed,
        teamBlue
    };
  };

  const currentFrame = analysisResult ? getCurrentInterpolatedFrame(currentTime, analysisResult) : null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Limit file size approx 20MB for base64 stability in browser
      if (file.size > 20 * 1024 * 1024) {
          setErrorMsg("Video file is too large. Please upload a clip under 20MB.");
          setAppState(AppState.ERROR);
          return;
      }
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setAppState(AppState.UPLOADING);
      setErrorMsg("");
    }
  };

  const handleAnalyze = async () => {
    if (!videoFile) return;
    setAppState(AppState.ANALYZING);
    try {
      const apiKey = process.env.API_KEY || "";
      if(!apiKey) {
          throw new Error("Missing API Key environment variable.");
      }
      const result = await analyzeVideoClip(videoFile, apiKey);
      setAnalysisResult(result);
      setAppState(AppState.PLAYBACK);
      setCurrentTime(0);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to analyze video. Gemini API might be busy or the video format is unsupported.");
      setAppState(AppState.ERROR);
    }
  };

  // Animation Loop
  useEffect(() => {
    const loop = (timestamp: number) => {
      if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp;
      const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = timestamp;

      if (isPlaying && analysisResult) {
        setCurrentTime(prev => {
            const maxTime = analysisResult.keyframes[analysisResult.keyframes.length - 1].timeOffset;
            const nextTime = prev + deltaTime * playbackSpeed;
            
            // Sync video element if it exists
            if (videoRef.current && Math.abs(videoRef.current.currentTime - nextTime) > 0.5) {
                videoRef.current.currentTime = nextTime;
            }
            
            if (nextTime >= maxTime) {
                setIsPlaying(false);
                return maxTime;
            }
            return nextTime;
        });
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(loop);
    } else {
        lastFrameTimeRef.current = 0;
    }

    return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, analysisResult, playbackSpeed]);

  // Sync video seeking when slider moves (manual scrub)
  const handleSeek = (val: number) => {
      setCurrentTime(val);
      if (videoRef.current) {
          videoRef.current.currentTime = val;
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center px-6 justify-between backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Video className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Gridiron Vision AI
          </h1>
        </div>
        <div className="text-xs text-slate-500 font-mono">
            Powered by Gemini 2.5 Multimodal
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Panel: Video Input & Player */}
        <div className="lg:w-1/3 border-r border-slate-800 flex flex-col bg-slate-900/20 relative">
           
           {/* Upload State */}
           {appState === AppState.IDLE && (
             <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="border-2 border-dashed border-slate-700 rounded-2xl p-12 hover:border-blue-500 transition-colors group cursor-pointer relative">
                    <input 
                        type="file" 
                        accept="video/mp4,video/mov,video/webm"
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="w-12 h-12 text-slate-600 mb-4 group-hover:text-blue-400 transition-colors mx-auto" />
                    <h3 className="text-lg font-semibold text-slate-300">Upload Game Clip</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-xs">
                        Drag & drop or click to select an NFL play clip (MP4, MOV). Max 20MB.
                    </p>
                </div>
             </div>
           )}

           {/* Preview / Playback State */}
           {(appState === AppState.UPLOADING || appState === AppState.ANALYZING || appState === AppState.PLAYBACK || appState === AppState.ERROR) && videoUrl && (
             <div className="flex-1 flex flex-col bg-black relative justify-center">
                <video 
                    ref={videoRef}
                    src={videoUrl} 
                    className="max-h-full w-full object-contain opacity-80"
                    muted
                    playsInline
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                />
                
                {/* Overlays */}
                {appState === AppState.UPLOADING && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm">
                        <button 
                            onClick={handleAnalyze}
                            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
                        >
                            <Video className="w-4 h-4" />
                            Analyze Play with Gemini
                        </button>
                    </div>
                )}

                {appState === AppState.ANALYZING && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm z-20">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                        <h3 className="text-xl font-bold text-white">Analyzing Tactics...</h3>
                        <p className="text-slate-400 mt-2">Extracting player trajectories and ball physics</p>
                    </div>
                )}
             </div>
           )}

           {/* Error Message */}
           {appState === AppState.ERROR && (
               <div className="p-4 bg-red-900/20 border-t border-red-900 flex items-start gap-3">
                   <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                   <div>
                       <h4 className="text-red-400 font-semibold text-sm">Analysis Failed</h4>
                       <p className="text-red-300/70 text-xs mt-1">{errorMsg}</p>
                       <button 
                        onClick={() => setAppState(AppState.IDLE)}
                        className="mt-2 text-xs text-white underline decoration-red-500/50 hover:decoration-red-500"
                       >
                           Try another video
                       </button>
                   </div>
               </div>
           )}
        </div>

        {/* Right Panel: Visualization */}
        <div className="flex-1 bg-slate-950 flex flex-col relative overflow-y-auto">
            {appState === AppState.PLAYBACK && analysisResult ? (
                <>
                    {/* Top Stats Bar */}
                    <div className="p-6 border-b border-slate-800 bg-slate-900/20">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">{analysisResult.playType}</h2>
                                <div className="flex items-center gap-4 text-sm text-slate-400 font-mono">
                                    <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-300">{analysisResult.formation}</span>
                                </div>
                            </div>
                            <div className="text-right max-w-md">
                                <p className="text-sm text-slate-400 leading-relaxed">{analysisResult.summary}</p>
                            </div>
                        </div>
                    </div>

                    {/* Field Visualization Area */}
                    <div className="flex-1 flex items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950">
                        <div className="w-full max-w-4xl">
                            <Field currentFrame={currentFrame} width={800} />
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="h-24 border-t border-slate-800 bg-slate-900/50 backdrop-blur p-4 flex flex-col justify-center">
                        {/* Scrubber */}
                        <div className="flex items-center gap-4 mb-2">
                             <span className="text-xs font-mono text-slate-500 w-10 text-right">{currentTime.toFixed(1)}s</span>
                             <input 
                                type="range" 
                                min={0} 
                                max={analysisResult.keyframes[analysisResult.keyframes.length - 1].timeOffset} 
                                step={0.1}
                                value={currentTime}
                                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                                className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                             />
                             <span className="text-xs font-mono text-slate-500 w-10">
                                {analysisResult.keyframes[analysisResult.keyframes.length - 1].timeOffset.toFixed(1)}s
                             </span>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center justify-center gap-4">
                            <button 
                                onClick={() => setIsPlaying(!isPlaying)}
                                className="p-2 rounded-full bg-white text-slate-900 hover:bg-blue-50 transition-colors"
                            >
                                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                            </button>

                            <div className="flex bg-slate-800 rounded-lg p-0.5">
                                {[0.5, 1, 2].map(speed => (
                                    <button
                                        key={speed}
                                        onClick={() => setPlaybackSpeed(speed)}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${playbackSpeed === speed ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        {speed}x
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                // Empty State for Right Panel
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-8">
                    <div className="w-full max-w-lg aspect-[2/1] border border-slate-800 rounded-xl bg-slate-900/30 mb-6 relative overflow-hidden group">
                         <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.03)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite]"></div>
                         <div className="absolute inset-0 flex items-center justify-center">
                             <ChevronRight className="w-12 h-12 text-slate-800" />
                         </div>
                    </div>
                    <h3 className="text-lg font-medium text-slate-400">Ready to Simulate</h3>
                    <p className="text-sm text-slate-600 max-w-xs text-center mt-2">
                        Upload a video on the left to generate a 2D tactical reconstruction.
                    </p>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}