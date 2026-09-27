import { useState, useEffect, useRef, useMemo } from "react";
import type { ComponentType } from "react";
import {
  Play, Pause, Square, RefreshCw, SkipBack, SkipForward, Waves, Activity, Radio, Cpu, Antenna,
  BookOpen, ChevronRight, SlidersHorizontal, MessageSquare, Binary,
  CheckCircle, Eye, EyeOff, TrendingDown, FlaskConical, Zap,
  GitBranch, Grid3x3, BarChart2, FileText, Info, X, Maximize2,
} from "lucide-react";
import { getExplanations, openLiveSimulation, runSimulation, type ComplexTracePreview, type GridTracePreview, type ExplanationMap, type LiveSimulationEvent, type SimulationRunResponse } from "./api/wavecore";
import { getChannelCoefficientTrace, getResourceGridTrace, getTraceVisualization, getWaveformTraces } from "./api/traceData.js";
import { getEncodingPreview } from "./api/encodingPreview.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type StageId =
  | "message" | "binary" | "modulation" | "ofdm"
  | "channel" | "reception" | "demodulation" | "output";

type ModScheme = "BPSK" | "QPSK" | "16-QAM" | "64-QAM";
type VisTab =
  | "waveform" | "constellation" | "spectrum" | "ber"
  | "transform" | "multipath" | "ofdm-grid" | "recovered" | "performance";

interface IQPoint { i: number; q: number; sym: number }

const BACKEND_STAGE: Record<StageId, string> = {
  message: "message",
  binary: "binary_encoding",
  modulation: "modulation",
  ofdm: "ofdm",
  channel: "wireless_channel",
  reception: "receiver",
  demodulation: "demodulation",
  output: "decoding",
};

// ─── Stage Configuration ──────────────────────────────────────────────────────

const STAGES: {
  id: StageId; label: string; short: string;
  icon: ComponentType<{ size?: number }>; color: string; glow: string; bg: string; desc: string;
}[] = [
  { id: "message",      label: "Message Input",    short: "MSG",   icon: MessageSquare, color: "#00e5b4", glow: "#00e5b420", bg: "rgba(0,229,180,0.07)",   desc: "Source payload" },
  { id: "binary",       label: "Binary Encoding",  short: "BIN",   icon: Binary,        color: "#818cf8", glow: "#818cf820", bg: "rgba(129,140,248,0.07)", desc: "Bit stream encoding" },
  { id: "modulation",   label: "Modulation",       short: "MOD",   icon: Waves,         color: "#38bdf8", glow: "#38bdf820", bg: "rgba(56,189,248,0.07)",  desc: "IQ symbol mapping" },
  { id: "ofdm",         label: "OFDM",             short: "OFDM",  icon: Activity,      color: "#fbbf24", glow: "#fbbf2420", bg: "rgba(251,191,36,0.07)",  desc: "Multi-carrier IFFT" },
  { id: "channel",      label: "Wireless Channel", short: "CH",    icon: Radio,         color: "#f87171", glow: "#f8717120", bg: "rgba(248,113,113,0.07)", desc: "Propagation & noise" },
  { id: "reception",    label: "Reception",        short: "RX",    icon: Antenna,       color: "#38bdf8", glow: "#38bdf820", bg: "rgba(56,189,248,0.07)",  desc: "ADC & sync & FFT" },
  { id: "demodulation", label: "Demodulation",     short: "DEMOD", icon: Cpu,           color: "#c084fc", glow: "#c084fc20", bg: "rgba(192,132,252,0.07)", desc: "Symbol decisions" },
  { id: "output",       label: "Recovered Data",   short: "OUT",   icon: CheckCircle,   color: "#00e5b4", glow: "#00e5b420", bg: "rgba(0,229,180,0.07)",   desc: "Reconstructed message" },
];

const ALL_TABS: { id: VisTab; label: string; stages?: StageId[] }[] = [
  { id: "transform",   label: "Transform" },
  { id: "waveform",    label: "Waveform" },
  { id: "constellation", label: "Constellation" },
  { id: "spectrum",    label: "Spectrum" },
  { id: "ber",         label: "BER Curve" },
  { id: "ofdm-grid",  label: "OFDM Grid",   stages: ["ofdm", "reception"] },
  { id: "multipath",  label: "Wireless Channel", stages: ["channel", "ofdm", "reception"] },
  { id: "performance", label: "Performance" },
  { id: "recovered",  label: "Recovery",    stages: ["demodulation", "output"] },
];

const STAGE_DEFAULT_TAB: Record<StageId, VisTab> = {
  message: "transform", binary: "transform", modulation: "constellation",
  ofdm: "ofdm-grid", channel: "multipath", reception: "spectrum",
  demodulation: "constellation", output: "recovered",
};

const EDUCATION: Record<StageId, { what: string; why: string; industry: string; tip: string }> = {
  message: {
    what: "The source message is raw data — text, audio, sensor readings — waiting for transmission through the wireless pipeline.",
    why: "All system design begins with the source. Payload type governs compression, latency constraints, and required link reliability.",
    industry: "5G NR carries voice (AMR-WB), video (H.265), and IoT sensor data through the same physical layer, distinguished by QoS class identifiers.",
    tip: "Longer messages increase frame occupancy. Real systems segment payloads with RLC/MAC layers and reassemble at the receiver.",
  },
  binary: {
    what: "Text is mapped to UTF-8 bytes then serialized into a bit stream. Channel coding (LDPC, Polar) adds redundancy for error correction.",
    why: "Digital signal processing operates on bits. LDPC and Polar codes achieve within 0.1 dB of the Shannon capacity limit.",
    industry: "5G NR uses LDPC for data channels (throughput-optimized) and Polar codes for control channels (latency-optimized).",
    tip: "Code rate ½ doubles the bit count but allows the receiver to correct errors at 3 dB lower SNR — a powerful cell-edge trade-off.",
  },
  modulation: {
    what: "Bit groups are mapped to IQ-plane symbols. Carrier multiplication places each complex symbol at its RF frequency for transmission.",
    why: "Higher-order QAM packs more bits per Hz but demands higher SNR. BPSK = 1 bit/sym; 64-QAM = 6 bits/sym — a 6× spectral efficiency gain.",
    industry: "5G NR AMC adapts modulation and code rate dynamically in real time based on CQI feedback from the mobile terminal.",
    tip: "Drag SNR below 12 dB with 16-QAM and observe the constellation cloud expand until symbol regions merge — that is the BER cliff.",
  },
  ofdm: {
    what: "The IFFT maps N frequency-domain symbols onto N orthogonal time-domain subcarriers. A cyclic prefix (CP) is prepended to absorb multipath delay spread.",
    why: "OFDM converts one wideband frequency-selective channel into N flat narrowband sub-channels. Each requires only one complex multiply to equalize.",
    industry: "LTE, 5G NR, Wi-Fi 4–7, DVB-T2, and ADSL all deploy OFDM. 5G NR supports 15–480 kHz subcarrier spacing across its five numerologies.",
    tip: "The CP must exceed the channel delay spread. If not, ISI degrades all subcarriers simultaneously — watch the spectrum lose flatness.",
  },
  channel: {
    what: "The signal experiences path loss, multipath reflections (delay spread), Doppler shifts from mobility, and additive thermal noise.",
    why: "The channel model is the foundation of link budget engineering. SNR at the receiver determines which modulation order is feasible.",
    industry: "5G mmWave (>24 GHz) suffers severe path loss but delivers 400 MHz+ bandwidth. Massive MIMO and beamforming restore link margin.",
    tip: "Drop SNR below 10 dB with 64-QAM and observe the BER cliff — a small SNR drop causes catastrophic error rate collapse.",
  },
  reception: {
    what: "After ADC, the receiver removes the cyclic prefix, applies the FFT to recover subcarrier symbols, and performs channel equalization.",
    why: "Carrier frequency offset causes inter-carrier interference across all subcarriers simultaneously. Precise synchronization is non-negotiable.",
    industry: "LTE uses PSS/SSS for cell acquisition within 20 ms. 5G NR achieves synchronization in under 5 ms with improved reference signal design.",
    tip: "Each equalized subcarrier output is Ŷ[k] = Y[k]/Ĥ[k]. Channel estimation uses pilot symbols inserted into the resource grid.",
  },
  demodulation: {
    what: "The demodulator maps equalized IQ samples to hard bit decisions (nearest symbol) or soft LLR values for the channel decoder.",
    why: "Soft LLRs feed LDPC decoders that iteratively refine estimates, achieving near-capacity performance with practical complexity.",
    industry: "AI-assisted detection and Successive Interference Cancellation are emerging in 5G Advanced to push beyond classical Shannon limits.",
    tip: "The minimum Euclidean distance between constellation points sets noise tolerance. Higher modulation order halves this — hence the SNR cost.",
  },
  output: {
    what: "Channel-decoded bits are converted back to bytes and reassembled into the original source message for application delivery.",
    why: "The ratio of incorrectly decoded bits to total transmitted bits is the Bit Error Rate — the definitive performance metric.",
    industry: "Voice requires BER < 10⁻³ before codec concealment saturates. Data applications require BER < 10⁻⁶ for reliable TCP operation.",
    tip: "Channel coding allows perfect recovery even with some bit errors — down to the code's correction limit set by its minimum Hamming distance.",
  },
};

// ─── Signal Math ──────────────────────────────────────────────────────────────

function erfc(x: number): number {
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const r = 1 - Math.exp(-ax*ax) * t * (0.254829592 + t*(-0.284496736 + t*(1.421413741 + t*(-1.453152027 + t*1.061405429))));
  return x >= 0 ? r : 2 - r;
}

function pnoise(x: number): number {
  const a = Math.sin(x * 8317.3 + 1.37) * 43758.5453;
  return (a - Math.floor(a)) * 2 - 1;
}

function sGauss(seed: number): number {
  const u1 = Math.abs(pnoise(seed) * 0.5 + 0.5) || 0.001;
  const u2 = Math.abs(pnoise(seed + 999) * 0.5 + 0.5) || 0.001;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function getIdealPoints(scheme: ModScheme): IQPoint[] {
  if (scheme === "BPSK") return [{i:-1,q:0,sym:0},{i:1,q:0,sym:1}];
  if (scheme === "QPSK") {
    const s = 1/Math.sqrt(2);
    return [{i:-s,q:-s,sym:0},{i:-s,q:s,sym:1},{i:s,q:-s,sym:2},{i:s,q:s,sym:3}];
  }
  if (scheme === "16-QAM") {
    const pts:IQPoint[]=[]; const n=1/Math.sqrt(10); let s=0;
    for (const q of [-3,-1,1,3]) for (const i of [-3,-1,1,3]) pts.push({i:i*n,q:q*n,sym:s++});
    return pts;
  }
  const pts:IQPoint[]=[]; const n=1/Math.sqrt(42); let s=0;
  for (const q of [-7,-5,-3,-1,1,3,5,7]) for (const i of [-7,-5,-3,-1,1,3,5,7]) pts.push({i:i*n,q:q*n,sym:s++});
  return pts;
}

function getNoisyPoints(scheme: ModScheme, snrDb: number, seed: number): IQPoint[] {
  const ideal = getIdealPoints(scheme);
  const bps: Record<ModScheme,number> = {BPSK:1,QPSK:2,"16-QAM":4,"64-QAM":6};
  const sigma = 1/Math.sqrt(2*Math.pow(10,snrDb/10)*bps[scheme]);
  const count = Math.min(ideal.length*18, 400);
  return Array.from({length:count},(_,n) => {
    const b = ideal[n%ideal.length];
    return {i:b.i+sGauss(n*3.7+seed)*sigma, q:b.q+sGauss(n*7.3+seed+9)*sigma, sym:b.sym};
  });
}

function getBER(scheme: ModScheme, snrDb: number): number {
  // Uncoded AWGN theory: BPSK/QPSK exact; square Gray-QAM nearest-neighbor approximation.
  const s = Math.pow(10, snrDb/10);
  const v = {BPSK:0.5*erfc(Math.sqrt(s)),QPSK:0.5*erfc(Math.sqrt(s)),"16-QAM":0.375*erfc(Math.sqrt(0.4*s)),"64-QAM":(7/24)*erfc(Math.sqrt(s/7))};
  return Math.max(v[scheme], 1e-15);
}

function getSignalY(stage: StageId, t: number, ns: number): number {
  switch (stage) {
    case "message":     return Math.sign(Math.sin(t*Math.PI*7)) * 0.86;
    case "binary":      return [1,1,-1,1,-1,-1,1,-1][Math.floor(t*24)%8]*0.9;
    case "modulation":  return Math.cos(t*2*Math.PI*24)*(0.35+0.65*Math.abs(Math.cos(t*2*Math.PI*3)));
    case "ofdm":        { let y=0; for(let k=1;k<=14;k++) y+=Math.cos(t*2*Math.PI*k*5+k*0.7)/14; return y; }
    case "channel":     { let y=0; for(let k=1;k<=14;k++) y+=Math.cos(t*2*Math.PI*k*5+k*0.7)/14; return y+pnoise(t*200+77)*ns*0.6; }
    case "reception":   { let y=0; for(let k=1;k<=14;k++) y+=Math.cos(t*2*Math.PI*k*5+k*0.7)/14; return y*0.93; }
    case "demodulation": return Math.cos(t*2*Math.PI*14)*0.86;
    case "output":      return Math.sign(Math.sin(t*Math.PI*7))*0.86;
    default: return 0;
  }
}

function getSpectrumBars(N: number, stage: StageId) {
  const n = Math.min(N, 80);
  return Array.from({length:n},(_,idx) => {
    const norm = (idx/n-0.5)*2;
    const guard = Math.abs(norm)>0.84;
    let power = 0;
    if (stage==="message"||stage==="binary") power = Math.exp(-norm*norm*6)*(0.55+Math.abs(Math.sin(idx*2.1))*0.45);
    else if (stage==="ofdm"||stage==="reception") power = guard?0.01:(0.78+Math.abs(Math.sin(idx*1.9))*0.22);
    else if (stage==="channel") { const ch=0.4+0.45*Math.cos(norm*Math.PI*2.8)+0.15*Math.cos(norm*Math.PI*7); power=guard?0.01:ch*(0.65+Math.abs(Math.sin(idx*3.3))*0.35); }
    else power = guard?0.01:(0.7+Math.abs(Math.sin(idx*2.9))*0.3);
    return {idx, norm, power, guard};
  });
}

const STAGE_COLORS: Record<StageId, string> = {
  message:"#00e5b4",binary:"#818cf8",modulation:"#38bdf8",
  ofdm:"#fbbf24",channel:"#f87171",reception:"#38bdf8",
  demodulation:"#c084fc",output:"#00e5b4",
};

const SYM_COLORS = [
  "#00e5b4","#818cf8","#38bdf8","#fbbf24","#f87171","#34d399",
  "#fb923c","#a78bfa","#4ade80","#60a5fa","#f472b6","#facc15",
  "#2dd4bf","#c084fc","#fb7185","#86efac","#7dd3fc","#e879f9",
];

// ─── CSS Injection ─────────────────────────────────────────────────────────────

function InjectCSS() {
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = `
      @keyframes particleFlow {
        0%   { transform:translateX(-4px); opacity:0; }
        8%   { opacity:1; }
        92%  { opacity:1; }
        100% { transform:translateX(calc(var(--travel)+4px)); opacity:0; }
      }
      @keyframes dotPulse {
        0%,100% { transform:scale(1); opacity:1; }
        50%      { transform:scale(1.7); opacity:0.55; }
      }
      @keyframes fadeInUp {
        from { opacity:0; transform:translateY(6px); }
        to   { opacity:1; transform:translateY(0); }
      }
      @keyframes travelDot {
        0%   { stroke-dashoffset:1000; }
        100% { stroke-dashoffset:0; }
      }
      @keyframes pulseRing {
        0%   { r:4; opacity:0.9; }
        100% { r:14; opacity:0; }
      }
      @keyframes shimmer {
        0%   { opacity:0.4; }
        50%  { opacity:1; }
        100% { opacity:0.4; }
      }
      .stage-fade { animation: fadeInUp 0.22s ease-out; }
      .shimmer    { animation: shimmer 2s ease-in-out infinite; }
    `;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);
  return null;
}

// ─── Canvas Waveform ──────────────────────────────────────────────────────────

function AnimatedWaveform({ stage, snrDb, isRunning }: { stage:StageId; snrDb:number; isRunning:boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const phase = useRef(0);
  const stg = useRef(stage); const snr = useRef(snrDb); const run = useRef(isRunning);
  useEffect(()=>{stg.current=stage;phase.current=0;},[stage]);
  useEffect(()=>{snr.current=snrDb;},[snrDb]);
  useEffect(()=>{run.current=isRunning;},[isRunning]);

  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const draw=()=>{
      const dpr=Math.min(window.devicePixelRatio||1,2);
      const W=canvas.clientWidth, H=canvas.clientHeight;
      if(canvas.width!==W*dpr||canvas.height!==H*dpr){canvas.width=W*dpr;canvas.height=H*dpr;}
      const ctx=canvas.getContext("2d")!; ctx.setTransform(dpr,0,0,dpr,0,0);
      const mid=H/2,amp=mid*0.76,col=STAGE_COLORS[stg.current];
      const noiseSig=1/Math.sqrt(Math.pow(10,snr.current/10));
      phase.current+=run.current?0.038:0.009;
      const ph=phase.current;
      ctx.fillStyle="#030912"; ctx.fillRect(0,0,W,H);
      // Grid
      ctx.strokeStyle="rgba(14,42,80,0.5)"; ctx.lineWidth=0.5;
      for(let i=0;i<=10;i++){ctx.beginPath();ctx.moveTo(i*W/10,0);ctx.lineTo(i*W/10,H);ctx.stroke();}
      for(let i=0;i<=6;i++){ctx.beginPath();ctx.moveTo(0,i*H/6);ctx.lineTo(W,i*H/6);ctx.stroke();}
      ctx.strokeStyle="rgba(14,42,80,0.25)"; ctx.lineWidth=0.3;
      for(let i=0;i<=20;i++){ctx.beginPath();ctx.moveTo(i*W/20,mid-3);ctx.lineTo(i*W/20,mid+3);ctx.stroke();}
      // Axis
      ctx.strokeStyle="rgba(14,60,100,0.7)"; ctx.lineWidth=0.8;
      ctx.beginPath();ctx.moveTo(0,mid);ctx.lineTo(W,mid);ctx.stroke();
      // Labels
      ctx.fillStyle="rgba(14,52,90,0.8)"; ctx.font="7px 'JetBrains Mono',monospace";
      [["1.0",mid*0.18],[".5",mid*0.59],["0",mid],["-.5",mid*1.41],["-1",mid*1.82]].forEach(([lbl,y])=>{
        ctx.fillText(String(lbl),4,Number(y)+3);
      });
      // Wave passes
      const wv=(lw:number,al:number,blur:number)=>{
        ctx.save();ctx.shadowColor=col;ctx.shadowBlur=blur;
        ctx.strokeStyle=col+Math.round(al*255).toString(16).padStart(2,"0");
        ctx.lineWidth=lw; ctx.beginPath();
        for(let px=0;px<=W;px+=0.8){
          const t=px/W+ph, y=getSignalY(stg.current,t,noiseSig);
          if(px===0)ctx.moveTo(px,mid-y*amp);else ctx.lineTo(px,mid-y*amp);
        }
        ctx.stroke();ctx.restore();
      };
      wv(12,0.05,28); wv(5,0.12,14); wv(1.6,1,7);
      // IQ overlay for modulation stages
      if(["modulation","reception","demodulation"].includes(stg.current)){
        ctx.save();ctx.globalAlpha=0.22;ctx.strokeStyle="#c084fc";ctx.shadowColor="#c084fc";ctx.shadowBlur=5;ctx.lineWidth=1;
        ctx.beginPath();
        for(let px=0;px<=W;px+=0.8){
          const t=px/W+ph*1.15, y=Math.sin(t*2*Math.PI*14)*0.55;
          if(px===0)ctx.moveTo(px,mid-y*amp);else ctx.lineTo(px,mid-y*amp);
        }
        ctx.stroke();ctx.restore();
      }
      // Scanlines
      ctx.fillStyle="rgba(3,9,18,0.035)";
      for(let r=0;r<H;r+=2)ctx.fillRect(0,r,W,1);
      // Corner
      ctx.fillStyle="rgba(14,42,80,0.7)"; ctx.font="7px 'JetBrains Mono',monospace";
      ctx.fillText(`${stg.current.toUpperCase()}  •  TIME DOMAIN`,8,H-7);
      ctx.fillText(`SNR ${snr.current} dB`,W-58,H-7);
      raf.current=requestAnimationFrame(draw);
    };
    raf.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(raf.current);
  },[]);

  return <canvas ref={ref} style={{display:"block",width:"100%",height:200,background:"#030912"}} />;
}

function WaveformTraceCanvas({stage,snrDb,tx,rx}:{stage:StageId;snrDb:number;tx?:ComplexTracePreview;rx?:ComplexTracePreview}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const draw=()=>{
      const dpr=Math.min(window.devicePixelRatio||1,2),W=canvas.clientWidth,H=canvas.clientHeight;
      if(!W||!H)return;
      if(canvas.width!==W*dpr||canvas.height!==H*dpr){canvas.width=W*dpr;canvas.height=H*dpr;}
      const ctx=canvas.getContext("2d")!;ctx.setTransform(dpr,0,0,dpr,0,0);
      const mid=H/2,amp=mid*0.76,pad=32,color=STAGE_COLORS[stage];
      ctx.fillStyle="#030912";ctx.fillRect(0,0,W,H);
      ctx.strokeStyle="rgba(14,42,80,0.5)";ctx.lineWidth=0.5;
      for(let i=0;i<=10;i++){ctx.beginPath();ctx.moveTo(i*W/10,0);ctx.lineTo(i*W/10,H);ctx.stroke();}
      for(let i=0;i<=6;i++){ctx.beginPath();ctx.moveTo(0,i*H/6);ctx.lineTo(W,i*H/6);ctx.stroke();}
      ctx.strokeStyle="rgba(14,60,100,0.7)";ctx.lineWidth=0.8;ctx.beginPath();ctx.moveTo(pad,mid);ctx.lineTo(W-8,mid);ctx.stroke();
      ctx.fillStyle="rgba(14,52,90,0.8)";ctx.font="7px 'JetBrains Mono',monospace";
      [["1.0",mid*0.18],[".5",mid*0.59],["0",mid],["-.5",mid*1.41],["-1",mid*1.82]].forEach(([label,y])=>ctx.fillText(String(label),4,Number(y)+3));
      if(!tx||!rx||!tx.samples.length||!rx.samples.length){
        ctx.fillStyle="#fbbf24";ctx.font="9px 'JetBrains Mono',monospace";ctx.textAlign="center";
        ctx.fillText("TRACE UNAVAILABLE - run a simulation",W/2,mid+4);ctx.textAlign="start";
      }else{
        const peak=Math.max(...tx.samples.map(s=>Math.abs(s.re)),...rx.samples.map(s=>Math.abs(s.re)),1e-9);
        const trace=(values:ComplexTracePreview,stroke:string,blur:number,lineWidth:number,alpha:number)=>{
          ctx.save();ctx.strokeStyle=stroke;ctx.shadowColor=stroke;ctx.shadowBlur=blur;ctx.lineWidth=lineWidth;ctx.globalAlpha=alpha;ctx.beginPath();
          values.samples.forEach((sample,index)=>{
            const x=pad+values.indices[index]/Math.max(values.sample_count-1,1)*(W-pad-8);
            const y=mid-sample.re/peak*amp;
            if(index===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
          });
          ctx.stroke();ctx.restore();
        };
        trace(tx,"#38bdf8",2,1,0.8);trace(rx,color,14,7,0.12);trace(rx,color,7,3,0.35);trace(rx,color,4,1.5,1);
        ctx.fillStyle="rgba(14,52,90,0.8)";ctx.font="7px 'JetBrains Mono',monospace";
        ctx.fillText("0",pad,H-7);ctx.textAlign="right";ctx.fillText(String(rx.sample_count-1),W-8,H-7);ctx.textAlign="start";
      }
      ctx.fillStyle="rgba(3,9,18,0.035)";for(let y=0;y<H;y+=2)ctx.fillRect(0,y,W,1);
      ctx.fillStyle="rgba(14,42,80,0.7)";ctx.font="7px 'JetBrains Mono',monospace";
      ctx.fillText(`${stage.toUpperCase()}  •  TIME DOMAIN`,8,12);
      ctx.textAlign="right";ctx.fillText(`CONFIGURED SNR ${snrDb} dB`,W-8,12);ctx.textAlign="start";
      ctx.fillStyle="#38bdf8";ctx.fillText("TX I",W-78,H-7);ctx.fillStyle=color;ctx.fillText("RX I",W-42,H-7);
    };
    const observer=new ResizeObserver(draw);observer.observe(canvas);draw();
    return()=>observer.disconnect();
  },[stage,snrDb,tx,rx]);
  return <canvas ref={ref} style={{display:"block",width:"100%",height:200,background:"#030912"}}/>;
}

// ─── Constellation ────────────────────────────────────────────────────────────

function ConstellationDiagram({scheme,transmitted,received}:{scheme:ModScheme;transmitted?:ComplexTracePreview;received?:ComplexTracePreview}) {
  const VW=400,VH=400,cx=VW/2,cy=VH/2;
  const {points,ideal,scale}=useMemo(()=>{
    const ideal=getIdealPoints(scheme);
    const maxE=Math.max(...ideal.map(p=>Math.max(Math.abs(p.i),Math.abs(p.q))));
    return {ideal,scale:(VW/2-32)/(maxE*1.18)};
  },[scheme]);
  const bps:Record<ModScheme,number>={BPSK:1,QPSK:2,"16-QAM":4,"64-QAM":6};
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{display:"block",maxHeight:360,background:"#030912"}}>
      <defs>
        <filter id="gf"><feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <radialGradient id="vg" cx="50%" cy="50%" r="50%"><stop offset="55%" stopColor="transparent"/><stop offset="100%" stopColor="#030912" stopOpacity="0.82"/></radialGradient>
        <pattern id="cg2" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(14,42,80,0.45)" strokeWidth="0.5"/></pattern>
      </defs>
      <rect width={VW} height={VH} fill="url(#cg2)"/>
      <circle cx={cx} cy={cy} r={scale} stroke="rgba(14,42,80,0.55)" strokeWidth={0.8} fill="none" strokeDasharray="4,4"/>
      <circle cx={cx} cy={cy} r={scale*1.5} stroke="rgba(14,42,80,0.2)" strokeWidth={0.4} fill="none" strokeDasharray="2,6"/>
      {/* Decision boundaries */}
      {scheme==="QPSK"&&<><line x1={cx} y1={18} x2={cx} y2={VH-18} stroke="rgba(30,60,100,0.5)" strokeWidth={0.7} strokeDasharray="3,5"/><line x1={18} y1={cy} x2={VW-18} y2={cy} stroke="rgba(30,60,100,0.5)" strokeWidth={0.7} strokeDasharray="3,5"/></>}
      {(scheme==="16-QAM"||scheme==="64-QAM")&&(()=>{
        const lvls=(scheme==="16-QAM"?[-2,0,2].map(v=>v/Math.sqrt(10)):[-6,-4,-2,0,2,4,6].map(v=>v/Math.sqrt(42)));
        return lvls.map((lv,i)=><g key={i}>
          {lv!==0&&<line x1={cx+lv*scale} y1={18} x2={cx+lv*scale} y2={VH-18} stroke="rgba(30,60,100,0.45)" strokeWidth={0.6} strokeDasharray="2,5"/>}
          {lv!==0&&<line x1={18} y1={cy-lv*scale} x2={VW-18} y2={cy-lv*scale} stroke="rgba(30,60,100,0.45)" strokeWidth={0.6} strokeDasharray="2,5"/>}
          {lv===0&&<><line x1={cx} y1={18} x2={cx} y2={VH-18} stroke="rgba(30,60,100,0.5)" strokeWidth={0.6} strokeDasharray="2,5"/><line x1={18} y1={cy} x2={VW-18} y2={cy} stroke="rgba(30,60,100,0.5)" strokeWidth={0.6} strokeDasharray="2,5"/></>}
        </g>);
      })()}
      <line x1={16} y1={cy} x2={VW-16} y2={cy} stroke="rgba(14,60,100,0.85)" strokeWidth={0.9}/>
      <line x1={cx} y1={16} x2={cx} y2={VH-16} stroke="rgba(14,60,100,0.85)" strokeWidth={0.9}/>
      {([["−I",18,cy-8,"start"],["+I",VW-18,cy-8,"end"],["+Q",cx+8,18,"start"],["−Q",cx+8,VH-7,"start"]] as [string,number,number,string][]).map(([t,x,y,a],i)=>(
        <text key={i} x={x} y={y} fill="rgba(14,60,100,0.85)" fontSize={9} fontFamily="JetBrains Mono" textAnchor={a}>{t}</text>
      ))}
      {(transmitted?.samples??[]).map((p,i)=>(
        <circle key={`tx-${i}`} cx={cx+p.re*scale} cy={cy-p.im*scale} r={2.2} fill="#38bdf8" opacity={0.45}/>
      ))}
      {(received?.samples??[]).map((p,i)=>(
        <circle key={`rx-${i}`} cx={cx+p.re*scale} cy={cy-p.im*scale} r={2.7} fill="#f87171" opacity={0.82}/>
      ))}
      <g filter="url(#gf)">
        {ideal.map((p,i)=><circle key={i} cx={cx+p.i*scale} cy={cy-p.q*scale} r={ideal.length<=4?6.5:ideal.length<=16?5:3.5} fill="none" stroke={SYM_COLORS[i%SYM_COLORS.length]} strokeWidth={1.5} opacity={0.88}/>)}
      </g>
      {ideal.map((p,i)=><circle key={i} cx={cx+p.i*scale} cy={cy-p.q*scale} r={ideal.length<=4?2.5:ideal.length<=16?2:1.5} fill={SYM_COLORS[i%SYM_COLORS.length]} opacity={0.95}/>)}
      <rect width={VW} height={VH} fill="url(#vg)"/>
      <text x={10} y={15} fill="rgba(14,60,100,0.85)" fontSize={9} fontFamily="JetBrains Mono">{scheme}  •  {bps[scheme]} bit/sym  •  {ideal.length} symbols</text>
      <text x={VW-10} y={15} fill="rgba(14,60,100,0.85)" fontSize={8} fontFamily="JetBrains Mono" textAnchor="end">TX {transmitted?.sample_count??"—"} / RX {received?.sample_count??"—"}</text>
      {!transmitted&&!received&&<text x={cx} y={VH-18} fill="#fbbf24" fontSize={10} fontFamily="JetBrains Mono" textAnchor="middle">Backend trace unavailable; run a simulation</text>}
    </svg>
  );
}

// ─── Spectrum Analyzer ────────────────────────────────────────────────────────

function TraceWaveform({tx,rx}:{tx?:ComplexTracePreview;rx?:ComplexTracePreview}) {
  if(!tx||!rx||tx.samples.length===0||rx.samples.length===0) return <div className="p-8 text-center text-xs text-amber-400">Unavailable — waveform traces are missing for this run.</div>;
  const width=720,height=240,pad=32;
  const peak=Math.max(...tx.samples.map(p=>Math.abs(p.re)),...rx.samples.map(p=>Math.abs(p.re)),1e-9);
  const line=(trace:ComplexTracePreview)=>trace.samples.map((p,i)=>`${pad+trace.indices[i]/Math.max(trace.sample_count-1,1)*(width-2*pad)},${height/2-p.re/peak*(height/2-pad)}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Current-run transmitted and received in-phase baseband waveform; horizontal axis is original sample index">
    <rect width={width} height={height} fill="#030912"/><line x1={pad} y1={height/2} x2={width-pad} y2={height/2} stroke="#17304e"/>
    <text x={pad-5} y={pad+3} fill="#71839b" fontSize="8" textAnchor="end">+1</text><text x={pad-5} y={height/2+3} fill="#71839b" fontSize="8" textAnchor="end">0</text><text x={pad-5} y={height-pad+3} fill="#71839b" fontSize="8" textAnchor="end">-1</text>
    <polyline points={line(tx)} fill="none" stroke="#38bdf8" strokeWidth="1.5"/><polyline points={line(rx)} fill="none" stroke="#00e5b4" strokeWidth="1.5"/>
    <text x={pad} y={18} fill="#38bdf8" fontSize="10">TX I</text><text x={pad+40} y={18} fill="#00e5b4" fontSize="10">RX I</text>
    <text x={width-pad} y={18} fill="#71839b" fontSize="9" textAnchor="end">{rx.sample_count} samples; {rx.samples.length} plotted</text>
    <text x={pad} y={height-20} fill="#71839b" fontSize="9">0</text><text x={width-pad} y={height-20} fill="#71839b" fontSize="9" textAnchor="end">{rx.sample_count-1}</text>
    <text x={width/2} y={height-5} fill="#71839b" fontSize="9" textAnchor="middle">Sample index n; normalized I amplitude (scale: shared TX/RX preview peak)</text>
  </svg>;
}

function ResourceGridTrace({grid,source}:{grid?:GridTracePreview;source:"TX"|"RX"}) {
  if(!grid||grid.samples.length===0) return <div className="p-8 text-center text-xs text-amber-400">Unavailable — resource-grid trace is missing for this run.</div>;
  const [rows,cols]=grid.shape,width=720,height=260,pad={l:44,r:18,t:30,b:36};
  const cellW=(width-pad.l-pad.r)/cols,cellH=(height-pad.t-pad.b)/rows;
  const magnitude=Math.max(...grid.samples.map(s=>Math.hypot(s.re,s.im)),1e-12);
  return <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={`Current-run ${source} OFDM resource grid, ${rows} OFDM symbols by ${cols} unshifted FFT bins; sampled cells shown`}>
    <rect width={width} height={height} fill="#030912"/>
    {grid.samples.map((sample,i)=>{const flat=grid.indices[i],row=Math.floor(flat/cols),col=flat%cols,power=Math.min(Math.hypot(sample.re,sample.im)/magnitude,1);return <rect key={flat} x={pad.l+col*cellW} y={pad.t+row*cellH} width={Math.max(1,cellW-1)} height={Math.max(1,cellH-1)} fill={power>0.95?"#fbbf24":"#38bdf8"} opacity={0.2+0.8*power}/>;})}
    <text x={pad.l} y={18} fill="#71839b" fontSize="9">Current-run {source} grid: {rows} OFDM symbols × {cols} FFT bins; {grid.samples.length}/{grid.sample_count} REs plotted</text>
    <text x={width/2} y={height-5} fill="#71839b" fontSize="9" textAnchor="middle">FFT-bin index k (unshifted order); brightness = |X[k]| / preview maximum</text>
    <text x={pad.l} y={pad.t-5} fill="#71839b" fontSize="8">0</text><text x={width-pad.r} y={pad.t-5} fill="#71839b" fontSize="8" textAnchor="end">{cols-1}</text>
    <text x={pad.l-6} y={pad.t+8} fill="#71839b" fontSize="8" textAnchor="end">0</text><text x={pad.l-6} y={height-pad.b} fill="#71839b" fontSize="8" textAnchor="end">{rows-1}</text>
  </svg>;
}

function ChannelResponseTrace({trace}:{trace?:ComplexTracePreview}) {
  if(!trace||trace.samples.length===0) return <div className="p-8 text-center text-xs text-amber-400">Unavailable — channel-coefficient trace is missing for this run.</div>;
  const values=trace.samples.map(s=>Math.hypot(s.re,s.im)),peak=Math.max(...values,1e-12),width=720,height=220,pad=32;
  const points=values.map((v,i)=>`${pad+trace.indices[i]/Math.max(trace.sample_count-1,1)*(width-2*pad)},${height-pad-v/peak*(height-2*pad)}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Current-run channel coefficient magnitude over original sample index">
    <rect width={width} height={height} fill="#030912"/><polyline points={points} fill="none" stroke="#fbbf24" strokeWidth="1.5"/>
    <text x={pad} y={16} fill="#71839b" fontSize="9">|h[n]|: {trace.sample_count} samples, {trace.samples.length} plotted; dimensionless gain</text>
    <text x={pad} y={height-20} fill="#71839b" fontSize="9">0</text><text x={width-pad} y={height-20} fill="#71839b" fontSize="9" textAnchor="end">{trace.sample_count-1}</text>
    <text x={width/2} y={height-5} fill="#71839b" fontSize="9" textAnchor="middle">Sample index n; normalized magnitude |h[n]| / preview maximum</text>
    <text x={pad-4} y={pad+3} fill="#71839b" fontSize="8" textAnchor="end">1</text><text x={pad-4} y={height-pad+3} fill="#71839b" fontSize="8" textAnchor="end">0</text>
    <text x={width-pad} y={30} fill="#71839b" fontSize="8" textAnchor="end">Flat-fading coefficient sequence; not a multipath impulse response</text>
  </svg>;
}

function SpectrumAnalyzer({numCarriers,stage}:{numCarriers:number;stage:StageId}) {
  const VW=700,VH=200,PAD={l:40,r:16,t:20,b:32};
  const IW=VW-PAD.l-PAD.r,IH=VH-PAD.t-PAD.b;
  const bars=useMemo(()=>getSpectrumBars(numCarriers,stage),[numCarriers,stage]);
  const bW=IW/bars.length, col=STAGE_COLORS[stage];
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{display:"block",background:"#030912"}}>
      <defs>
        <filter id="sf"><feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="sbg" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.95"/><stop offset="85%" stopColor={col} stopOpacity="0.2"/><stop offset="100%" stopColor={col} stopOpacity="0.04"/></linearGradient>
        <pattern id="spg" width={IW/10} height={IH/5} patternUnits="userSpaceOnUse" x={PAD.l} y={PAD.t}><path d={`M ${IW/10} 0 L 0 0 0 ${IH/5}`} fill="none" stroke="rgba(14,42,80,0.4)" strokeWidth="0.4"/></pattern>
      </defs>
      <rect x={PAD.l} y={PAD.t} width={IW} height={IH} fill="url(#spg)"/>
      {[0,0.25,0.5,0.75,1].map((f,i)=>{
        const y=PAD.t+(1-f)*IH;
        return <g key={i}><line x1={PAD.l-3} y1={y} x2={PAD.l} y2={y} stroke="rgba(14,60,100,0.5)" strokeWidth={0.7}/><text x={PAD.l-6} y={y+3} fill="rgba(14,60,100,0.65)" fontSize={7} fontFamily="JetBrains Mono" textAnchor="end">{Math.round(f*100)}%</text></g>;
      })}
      <g filter="url(#sf)">
        {bars.filter(b=>!b.guard).map((b,i)=>{
          const x=PAD.l+b.idx*bW,h=b.power*IH;
          return <rect key={i} x={x+0.4} y={PAD.t+IH-h} width={Math.max(bW-0.8,0.5)} height={h} fill={col} opacity={0.38}/>;
        })}
      </g>
      {bars.map((b,i)=>{
        const x=PAD.l+b.idx*bW,h=b.power*IH;
        return <rect key={i} x={x+0.4} y={PAD.t+IH-h} width={Math.max(bW-0.8,0.5)} height={h} fill={b.guard?"#0a1628":"url(#sbg)"}/>;
      })}
      {bars.filter(b=>!b.guard&&b.power>0.8).map((b,i)=>(
        <circle key={i} cx={PAD.l+b.idx*bW+bW/2} cy={PAD.t+IH-b.power*IH} r={1.5} fill={col} opacity={0.9}/>
      ))}
      <line x1={PAD.l} y1={PAD.t+IH} x2={VW-PAD.r} y2={PAD.t+IH} stroke="rgba(14,60,100,0.75)" strokeWidth={0.9}/>
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t+IH} stroke="rgba(14,60,100,0.75)" strokeWidth={0.9}/>
      <text x={PAD.l} y={VH-8} fill="rgba(14,60,100,0.65)" fontSize={7} fontFamily="JetBrains Mono">−f/2</text>
      <text x={PAD.l+IW/2} y={VH-8} fill="rgba(14,60,100,0.65)" fontSize={7} fontFamily="JetBrains Mono" textAnchor="middle">Frequency →</text>
      <text x={VW-PAD.r} y={VH-8} fill="rgba(14,60,100,0.65)" fontSize={7} fontFamily="JetBrains Mono" textAnchor="end">+f/2</text>
      <text x={PAD.l} y={PAD.t-6} fill="rgba(14,60,100,0.65)" fontSize={8} fontFamily="JetBrains Mono">Power Spectral Density</text>
      <text x={VW-PAD.r} y={PAD.t-6} fill={col} fontSize={8} fontFamily="JetBrains Mono" textAnchor="end">{numCarriers} subcarriers</text>
    </svg>
  );
}

// ─── BER Curve ────────────────────────────────────────────────────────────────

function BERCurve({scheme,snrDb}:{scheme:ModScheme;snrDb:number}) {
  const VW=700,VH=230,PAD={l:56,r:32,t:24,b:44};
  const IW=VW-PAD.l-PAD.r,IH=VH-PAD.t-PAD.b;
  const LMN=-13,LMX=Math.log10(0.65),SMX=36;
  const sx=(s:number)=>PAD.l+(s/SMX)*IW;
  const sy=(b:number)=>PAD.t+((LMX-Math.log10(Math.max(b,Math.pow(10,LMN))))/(LMX-LMN))*IH;
  const ALL:ModScheme[]=["BPSK","QPSK","16-QAM","64-QAM"];
  const SC:Record<ModScheme,string>={BPSK:"#00e5b4",QPSK:"#38bdf8","16-QAM":"#c084fc","64-QAM":"#fbbf24"};
  const bp=(s:ModScheme)=>Array.from({length:37},(_,i)=>i)
    .map(sn=>({sn,b:getBER(s,sn)})).filter(p=>p.b<0.65&&p.b>Math.pow(10,LMN))
    .map((p,i)=>`${i===0?"M":"L"}${sx(p.sn).toFixed(1)},${sy(p.b).toFixed(1)}`).join(" ");
  const ber=getBER(scheme,snrDb);
  const mk=ber<0.65&&ber>Math.pow(10,LMN);
  const shannon=(snr:number)=>Math.log2(1+Math.pow(10,snr/10));
  const shannonPts=Array.from({length:37},(_,i)=>i).map(sn=>({sn,c:Math.min(shannon(sn),14)}));
  const shanPath=shannonPts.map((p,i)=>`${i===0?"M":"L"}${sx(p.sn).toFixed(1)},${(PAD.t+IH-Math.min(p.c/14,1)*IH).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{display:"block",background:"#030912"}}>
      <defs>
        <filter id="bf"><feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <pattern id="bpg" width={IW/7} height={IH/7} patternUnits="userSpaceOnUse" x={PAD.l} y={PAD.t}><path d={`M ${IW/7} 0 L 0 0 0 ${IH/7}`} fill="none" stroke="rgba(14,42,80,0.35)" strokeWidth="0.4"/></pattern>
      </defs>
      <rect x={PAD.l} y={PAD.t} width={IW} height={IH} fill="url(#bpg)"/>
      {[0,5,10,15,20,25,30,35].map(sn=>(
        <g key={sn}><line x1={sx(sn)} y1={PAD.t} x2={sx(sn)} y2={PAD.t+IH} stroke="rgba(14,42,80,0.45)" strokeWidth={0.5}/><text x={sx(sn)} y={VH-22} fill="rgba(14,60,100,0.65)" fontSize={7} fontFamily="JetBrains Mono" textAnchor="middle">{sn}</text></g>
      ))}
      {[-1,-2,-3,-4,-5,-6,-8,-10,-12].map(exp=>{
        const b=Math.pow(10,exp),y=sy(b);
        if(y<PAD.t+2||y>PAD.t+IH-2) return null;
        return <g key={exp}><line x1={PAD.l} y1={y} x2={PAD.l+IW} y2={y} stroke="rgba(14,42,80,0.45)" strokeWidth={0.5}/><text x={PAD.l-8} y={y+3} fill="rgba(14,60,100,0.65)" fontSize={6} fontFamily="JetBrains Mono" textAnchor="end">10<tspan fontSize={4} dy={-3}>{exp}</tspan></text></g>;
      })}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t+IH} stroke="rgba(14,60,100,0.75)" strokeWidth={0.9}/>
      <line x1={PAD.l} y1={PAD.t+IH} x2={PAD.l+IW} y2={PAD.t+IH} stroke="rgba(14,60,100,0.75)" strokeWidth={0.9}/>
      {/* Shannon capacity */}
      <path d={shanPath} stroke="rgba(255,255,255,0.1)" strokeWidth={1} fill="none" strokeDasharray="3,5"/>
      <text x={sx(28)} y={PAD.t+IH-shannonPts[28].c/14*IH-6} fill="rgba(255,255,255,0.15)" fontSize={7} fontFamily="JetBrains Mono" textAnchor="middle">Shannon</text>
      {/* Glow + curves */}
      <g filter="url(#bf)">{ALL.map(s=><path key={s} d={bp(s)} stroke={SC[s]} strokeWidth={s===scheme?3:1} fill="none" opacity={s===scheme?0.45:0.1}/>)}</g>
      {ALL.map(s=><path key={s} d={bp(s)} stroke={SC[s]} strokeWidth={s===scheme?2:1} fill="none" opacity={s===scheme?1:0.25} strokeDasharray={s===scheme?undefined:"5,4"}/>)}
      {ALL.map(s=>{const b=getBER(s,27);const y=sy(b);if(y<PAD.t+6||y>PAD.t+IH-6)return null;return <text key={s} x={PAD.l+IW+5} y={y+3} fill={SC[s]} fontSize={7} fontFamily="JetBrains Mono" opacity={s===scheme?1:0.3}>{s}</text>;})}
      {mk&&(()=>{const px=sx(snrDb),py=sy(ber);return (<g filter="url(#bf)"><line x1={px} y1={PAD.t} x2={px} y2={py} stroke={SC[scheme]} strokeWidth={0.7} strokeDasharray="3,4" opacity={0.5}/><line x1={PAD.l} y1={py} x2={px} y2={py} stroke={SC[scheme]} strokeWidth={0.7} strokeDasharray="3,4" opacity={0.5}/><circle cx={px} cy={py} r={9} fill="none" stroke={SC[scheme]} strokeWidth={1} opacity={0.4}/><circle cx={px} cy={py} r={4} fill={SC[scheme]} opacity={0.95}/><rect x={px+12} y={py-19} width={100} height={22} fill="#07101e" rx={2}/><text x={px+16} y={py-8} fill={SC[scheme]} fontSize={8} fontFamily="JetBrains Mono">{snrDb} dB → {ber.toExponential(1)}</text></g>);})()}
      <text x={PAD.l+IW/2} y={VH-6} fill="rgba(14,60,100,0.65)" fontSize={9} fontFamily="JetBrains Mono" textAnchor="middle">SNR per bit  Eb/N₀  (dB)</text>
      <text x={14} y={PAD.t+IH/2} fill="rgba(14,60,100,0.65)" fontSize={9} fontFamily="JetBrains Mono" textAnchor="middle" transform={`rotate(-90,14,${PAD.t+IH/2})`}>Bit Error Rate</text>
      <text x={PAD.l} y={PAD.t-8} fill="rgba(14,60,100,0.65)" fontSize={8} fontFamily="JetBrains Mono">BER vs. SNR — Theoretical AWGN Performance  •  Shannon Capacity Reference</text>
    </svg>
  );
}

// ─── Message Transform ────────────────────────────────────────────────────────

function MessageTransform({message,scheme}:{message:string;scheme:ModScheme}) {
  const bps:Record<ModScheme,number>={BPSK:1,QPSK:2,"16-QAM":4,"64-QAM":6};
  const bits=bps[scheme];
  const preview=getEncodingPreview(message,bits);
  const {visibleCharacters:chars,bytes,symbols}=preview;
  return (
    <div style={{background:"#030912",padding:20,minHeight:190}}>
      <div className="mb-4">
        <div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:8}}>Source Characters  →  Unicode Codepoints</div>
        <div className="flex gap-1.5 flex-wrap">
          {chars.map((ch,i)=>(
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div style={{width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:4,background:SYM_COLORS[i%SYM_COLORS.length]+"18",color:SYM_COLORS[i%SYM_COLORS.length],border:`1px solid ${SYM_COLORS[i%SYM_COLORS.length]}38`,fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:600}}>{ch===" "?"·":ch}</div>
              <div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:7}}>U+{ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4,"0")}</div>
            </div>
          ))}
          {preview.characters.length>10&&<div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:10,alignSelf:"center"}}>+{preview.characters.length-10}</div>}
        </div>
      </div>
      <div className="mb-4">
        <div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:8}}>UTF-8 Byte Stream (MSB First)</div>
        <div className="flex gap-2 flex-wrap">
          {bytes.map((byte,i)=>{
            const byteBits=byte.toString(2).padStart(8,"0");
            return (
              <div key={i} className="flex flex-col gap-px">
                <div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:6,textAlign:"center"}}>B{i}</div>
                <div className="flex gap-px">{byteBits.split("").map((bit,j)=>(
                  <div key={j} style={{width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:2,background:bit==="1"?SYM_COLORS[i%SYM_COLORS.length]+"22":"#0a1628",color:bit==="1"?SYM_COLORS[i%SYM_COLORS.length]:"#1e3a5f",border:`1px solid ${bit==="1"?SYM_COLORS[i%SYM_COLORS.length]+"44":"#0f1e38"}`,fontFamily:"'JetBrains Mono',monospace",fontSize:8,fontWeight:600}}>
                    {bit}
                  </div>
                ))}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:8}}>{scheme} Symbol Groups — {bits} bits/symbol</div>
        <div className="flex gap-1 flex-wrap">
          {symbols.map((group,i)=>{
            const si=parseInt(group,2)%SYM_COLORS.length;
            return <div key={i} style={{padding:"2px 6px",borderRadius:3,background:SYM_COLORS[si]+"18",color:SYM_COLORS[si],border:`1px solid ${SYM_COLORS[si]}38`,fontFamily:"'JetBrains Mono',monospace",fontSize:8,fontWeight:600}} title={`Symbol bits ${i+1}`}>{group}</div>;
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Multipath Visualization ───────────────────────────────────────────────────

function MultipathViz({snrDb,isRunning}:{snrDb:number;isRunning:boolean}) {
  const VW=700,VH=240;
  const TX={x:60,y:120}, RX={x:640,y:120};
  const PATHS=[
    {label:"LOS",delay:"0.0",power:1.0,color:"#00e5b4",points:[TX,RX],dashOff:0},
    {label:"Refl A",delay:"0.6 μs",power:0.55,color:"#38bdf8",points:[TX,{x:220,y:50},{x:440,y:50},RX],dashOff:200},
    {label:"Refl B",delay:"1.2 μs",power:0.32,color:"#fbbf24",points:[TX,{x:200,y:195},{x:480,y:195},RX],dashOff:400},
    {label:"Refl C",delay:"1.8 μs",power:0.16,color:"#c084fc",points:[TX,{x:150,y:40},{x:310,y:25},{x:520,y:40},RX],dashOff:600},
  ];
  // Obstacles
  const BUILDINGS=[
    {x:270,y:60,w:40,h:80},{x:380,y:55,w:30,h:75},{x:450,y:65,w:35,h:70},
  ];

  const toPolyline=(pts:{x:number;y:number}[])=>pts.map(p=>`${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{display:"block",background:"#030912",minHeight:220}}>
      <defs>
        <filter id="mf"><feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <pattern id="mpg" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(14,42,80,0.35)" strokeWidth="0.5"/></pattern>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="rgba(14,60,100,0.6)"/>
        </marker>
      </defs>
      <rect width={VW} height={VH} fill="url(#mpg)"/>

      {/* Ground plane */}
      <line x1={40} y1={210} x2={VW-40} y2={210} stroke="rgba(14,42,80,0.6)" strokeWidth={1}/>

      {/* Buildings */}
      {BUILDINGS.map((b,i)=>(
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#080f1c" stroke="rgba(14,42,80,0.7)" strokeWidth={0.8}/>
          <rect x={b.x} y={b.y} width={b.w} height={4} fill="rgba(14,42,80,0.5)"/>
          {[0.25,0.5,0.75].map((fy,j)=>(
            <g key={j}>
              {[0.2,0.6].map((fx,k)=>(
                <rect key={k} x={b.x+b.w*fx-3} y={b.y+b.h*fy-4} width={6} height={7} fill="rgba(14,42,80,0.3)" stroke="rgba(14,42,80,0.5)" strokeWidth={0.4}/>
              ))}
            </g>
          ))}
        </g>
      ))}

      {/* Signal paths */}
      {PATHS.map((p,i)=>{
        const polyPts=toPolyline(p.points);
        const totalLen=p.points.reduce((acc,pt,j)=>{
          if(j===0) return 0;
          const prev=p.points[j-1];
          return acc+Math.sqrt((pt.x-prev.x)**2+(pt.y-prev.y)**2);
        },0);
        return (
          <g key={i}>
            {/* Glow */}
            <polyline points={polyPts} fill="none" stroke={p.color} strokeWidth={8} opacity={0.07} filter="url(#mf)"/>
            {/* Main path */}
            <polyline points={polyPts} fill="none" stroke={p.color} strokeWidth={i===0?2:1.2}
              opacity={p.power} strokeDasharray={i===0?"none":"6,4"}/>
            {/* Traveling dot */}
            {isRunning&&(
              <circle r={3.5} fill={p.color} opacity={0.9} style={{filter:`drop-shadow(0 0 5px ${p.color})`}}>
                <animateMotion dur={`${1.8+i*0.6}s`} repeatCount="indefinite" keyTimes="0;1" keySplines="0.4 0 0.6 1">
                  <mpath xlinkHref={`#path-${i}`}/>
                </animateMotion>
              </circle>
            )}
            <path id={`path-${i}`} d={`M${p.points.map(pt=>`${pt.x},${pt.y}`).join(" L")}`} fill="none" visibility="hidden"/>
            {/* Power label */}
            {i>0&&<text x={p.points[1].x} y={p.points[1].y-(i%2===0?12:8)} fill={p.color} fontSize={7} fontFamily="JetBrains Mono" textAnchor="middle" opacity={0.8}>{p.label}</text>}
          </g>
        );
      })}

      {/* TX antenna */}
      <g filter="url(#mf)">
        <line x1={TX.x} y1={TX.y+30} x2={TX.x} y2={TX.y-35} stroke="#00e5b4" strokeWidth={2}/>
        <line x1={TX.x-12} y1={TX.y-20} x2={TX.x} y2={TX.y-35} stroke="#00e5b4" strokeWidth={1.5}/>
        <line x1={TX.x+12} y1={TX.y-20} x2={TX.x} y2={TX.y-35} stroke="#00e5b4" strokeWidth={1.5}/>
        <circle cx={TX.x} cy={TX.y+32} r={4} fill="#00e5b4" opacity={0.8}/>
        {isRunning&&<circle cx={TX.x} cy={TX.y-35} r={5} fill="none" stroke="#00e5b4" strokeWidth={1.5} opacity={0.7}><animate attributeName="r" from={4} to={20} dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" from={0.7} to={0} dur="1.5s" repeatCount="indefinite"/></circle>}
      </g>
      <text x={TX.x} y={TX.y+48} fill="#00e5b4" fontSize={8} fontFamily="JetBrains Mono" textAnchor="middle">TX</text>

      {/* RX antenna */}
      <g filter="url(#mf)">
        <line x1={RX.x} y1={RX.y+30} x2={RX.x} y2={RX.y-35} stroke="#38bdf8" strokeWidth={2}/>
        <line x1={RX.x-12} y1={RX.y-20} x2={RX.x} y2={RX.y-35} stroke="#38bdf8" strokeWidth={1.5}/>
        <line x1={RX.x+12} y1={RX.y-20} x2={RX.x} y2={RX.y-35} stroke="#38bdf8" strokeWidth={1.5}/>
        <circle cx={RX.x} cy={RX.y+32} r={4} fill="#38bdf8" opacity={0.8}/>
      </g>
      <text x={RX.x} y={RX.y+48} fill="#38bdf8" fontSize={8} fontFamily="JetBrains Mono" textAnchor="middle">RX</text>

      {/* Impulse response panel */}
      <rect x={VW-145} y={12} width={130} height={105} fill="#050e1c" stroke="rgba(14,42,80,0.7)" strokeWidth={0.8} rx={2}/>
      <text x={VW-140} y={24} fill="rgba(14,60,100,0.8)" fontSize={7} fontFamily="JetBrains Mono">Channel Impulse Response</text>
      <line x1={VW-140} y1={105} x2={VW-24} y2={105} stroke="rgba(14,42,80,0.8)" strokeWidth={0.7}/>
      {PATHS.map((p,i)=>{
        const x=VW-140+i*28;
        const h=p.power*60;
        return (
          <g key={i}>
            <rect x={x} y={105-h} width={10} height={h} fill={p.color} opacity={0.7}/>
            <text x={x+5} y={115} fill={p.color} fontSize={6} fontFamily="JetBrains Mono" textAnchor="middle">{p.delay}</text>
          </g>
        );
      })}
      <text x={VW-140} y={100} fill="rgba(14,60,100,0.6)" fontSize={6} fontFamily="JetBrains Mono">h(τ)</text>
      <text x={VW-24} y={112} fill="rgba(14,60,100,0.6)" fontSize={6} fontFamily="JetBrains Mono" textAnchor="end">τ →</text>

      {/* SNR / path legend */}
      {PATHS.map((p,i)=>(
        <g key={i}>
          <line x1={42} y1={VH-30+i*12} x2={60} y2={VH-30+i*12} stroke={p.color} strokeWidth={i===0?2:1.2} strokeDasharray={i===0?"none":"4,3"}/>
          <text x={64} y={VH-26+i*12} fill={p.color} fontSize={7} fontFamily="JetBrains Mono" opacity={0.85}>{p.label}  {p.delay}  {Math.round(p.power*100)}% power</text>
        </g>
      ))}
    </svg>
  );
}

// ─── OFDM Resource Grid ────────────────────────────────────────────────────────

function OFDMGrid({numCarriers,cpLength}:{numCarriers:number;cpLength:number}) {
  const SYMS=14, SUBS=12;
  const VW=700,VH=220,PAD={l:48,r:20,t:30,b:36};
  const IW=VW-PAD.l-PAD.r, IH=VH-PAD.t-PAD.b;
  const symW=IW/(SYMS+1), subH=IH/SUBS;
  const cpW=symW*(cpLength/numCarriers)*8;
  // Pilot positions (LTE-like pattern)
  const pilots=new Set(["0-0","0-6","3-0","3-6","6-0","6-6","9-0","9-6",
    "0-4","3-4","6-4","9-4","0-10","3-10","6-10","9-10"]);
  const dcSub=Math.floor(SUBS/2);

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{display:"block",background:"#030912",minHeight:210}}>
      <defs>
        <filter id="ogf"><feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <text x={PAD.l} y={18} fill="rgba(14,60,100,0.8)" fontSize={8} fontFamily="JetBrains Mono">OFDM Resource Block  •  {SYMS} symbols × {SUBS} subcarriers  •  CP = {cpLength} samples</text>
      {/* Y axis labels */}
      {Array.from({length:SUBS},(_,i)=>(
        <text key={i} x={PAD.l-5} y={PAD.t+i*subH+subH*0.65} fill="rgba(14,60,100,0.65)" fontSize={6} fontFamily="JetBrains Mono" textAnchor="end">SC{SUBS-i}</text>
      ))}
      {/* X axis labels */}
      {Array.from({length:SYMS},(_,i)=>(
        <text key={i} x={PAD.l+cpW+(i+0.5)*symW} y={VH-18} fill="rgba(14,60,100,0.65)" fontSize={6} fontFamily="JetBrains Mono" textAnchor="middle">S{i}</text>
      ))}
      <text x={PAD.l+cpW/2} y={VH-18} fill="rgba(14,42,80,0.8)" fontSize={6} fontFamily="JetBrains Mono" textAnchor="middle">CP</text>
      {/* Resource elements */}
      {Array.from({length:SUBS},(_,sub)=>
        Array.from({length:SYMS},(_,sym)=>{
          const key=`${sym%12}-${sub}`;
          const isPilot=pilots.has(key);
          const isDC=sub===dcSub;
          const isGuard=sub===0||sub===SUBS-1;
          const x=PAD.l+cpW+sym*symW;
          const y=PAD.t+sub*subH;
          const color=isDC?"#0a1628":isGuard?"#060e1a":isPilot?"#fbbf24":"#38bdf8";
          const opacity=isDC?0.3:isGuard?0.2:isPilot?0.85:0.35;
          return (
            <g key={`${sym}-${sub}`}>
              <rect x={x+0.5} y={y+0.5} width={symW-1} height={subH-1} fill={color} opacity={opacity} rx={0.5}/>
              {isPilot&&<circle cx={x+symW/2} cy={y+subH/2} r={2} fill="#fbbf24" opacity={0.95} filter="url(#ogf)"/>}
            </g>
          );
        })
      )}
      {/* Cyclic prefix column */}
      {Array.from({length:SUBS},(_,sub)=>(
        <rect key={sub} x={PAD.l+0.5} y={PAD.t+sub*subH+0.5} width={cpW-1} height={subH-1} fill="#1e3a5f" opacity={0.35} rx={0.5}/>
      ))}
      {/* Border */}
      <rect x={PAD.l} y={PAD.t} width={IW} height={IH} fill="none" stroke="rgba(14,42,80,0.7)" strokeWidth={0.8}/>
      {/* Legend */}
      {[["#38bdf8","Data RE"],["#fbbf24","Pilot / RS"],["#1e3a5f","Cyclic Prefix"],["#0a1628","Null/DC"]].map(([c,l],i)=>(
        <g key={i}>
          <rect x={PAD.l+i*160} y={VH-12} width={10} height={7} fill={c} opacity={0.8} rx={1}/>
          <text x={PAD.l+i*160+13} y={VH-6} fill="rgba(14,60,100,0.7)" fontSize={7} fontFamily="JetBrains Mono">{l}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── Recovered Data Comparison ────────────────────────────────────────────────

function RecoveredComparison({message,recoveredMessage,actualBer,crcOk}:{message:string;scheme:ModScheme;snrDb:number;recoveredMessage?:string;actualBer?:number;crcOk?:boolean}) {
  const ber=actualBer;
  const bits=Array.from(new TextEncoder().encode(message).slice(0,8)).flatMap(byte=>byte.toString(2).padStart(8,"0").split("").map(Number));
  const backendRecovered = recoveredMessage ?? "";
  const recoveredBits = backendRecovered
    ? Array.from(new TextEncoder().encode(backendRecovered).slice(0,8)).flatMap(byte=>byte.toString(2).padStart(8,"0").split("").map(Number))
    : [];
  const errCount=bits.filter((b,i)=>i<recoveredBits.length&&recoveredBits[i]!==b).length;
  const errRate=backendRecovered ? errCount/bits.length : 0;

  return (
    <div style={{background:"#030912",padding:20,minHeight:190}}>
      <div className="grid grid-cols-2 gap-6">
        {/* Transmitted */}
        <div className="space-y-3">
          <div style={{color:"#00e5b4",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.14em",textTransform:"uppercase"}}>Transmitted</div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:18,fontWeight:700,color:"#00e5b4",letterSpacing:"0.08em"}}>{message.slice(0,8)}</div>
          <div className="flex flex-wrap gap-px">
            {bits.map((b,i)=>(
              <div key={i} style={{width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:2,background:b?"rgba(0,229,180,0.2)":"#0a1628",color:b?"#00e5b4":"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:7,border:`1px solid ${b?"rgba(0,229,180,0.3)":"#0f1e38"}`}}>{b}</div>
            ))}
          </div>
        </div>
        {/* Recovered */}
        <div className="space-y-3">
          <div style={{color:"#38bdf8",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.14em",textTransform:"uppercase"}}>Recovered</div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:18,fontWeight:700,letterSpacing:"0.08em"}}>
            {(backendRecovered || "Awaiting backend result").slice(0,8).split("").map((ch,i)=>(
              <span key={i} style={{color:ch===message[i]?"#38bdf8":"#f87171"}}>{ch}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-px">
            {recoveredBits.map((b,i)=>{
              const err=b!==bits[i];
              return <div key={i} style={{width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:2,background:err?"rgba(248,113,113,0.25)":b?"rgba(56,189,248,0.18)":"#0a1628",color:err?"#f87171":b?"#38bdf8":"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:7,border:`1px solid ${err?"rgba(248,113,113,0.45)":b?"rgba(56,189,248,0.28)":"#0f1e38"}`}}>{b}</div>;
            })}
          </div>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mt-5 pt-4 border-t" style={{borderColor:"rgba(14,42,80,0.6)"}}>
        {[
          {label:"Preview Mismatches",value:backendRecovered?String(errCount):"—",color:"#f87171"},
          {label:"Total Bits",value:String(bits.length),color:"#38bdf8"},
            {label:"BER",value:ber===undefined?"—":ber.toExponential(2),color:"#fbbf24"},
          {label:"CRC",value:crcOk===undefined?"—":crcOk?"PASS":"FAIL",color:crcOk===false?"#f87171":"#00e5b4"},
        ].map(({label,value,color})=>(
              <div key={label} style={{background:"#050e1c",padding:"8px 10px",borderRadius:4,border:"1px solid rgba(14,42,80,0.6)"}}>
            <div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:7,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{label}</div>
            <div style={{color,fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:700,lineHeight:1}}>{value}</div>
          </div>
        ))}
      </div>
      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-2">
        <div style={{flex:1,height:6,background:"rgba(14,42,80,0.4)",borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:backendRecovered?(100-errRate*100)+"%":"0%",background:"linear-gradient(90deg,#00e5b4,#38bdf8)",borderRadius:3,transition:"width 0.5s"}}/>
        </div>
        <div style={{color:"#00e5b4",fontFamily:"'JetBrains Mono',monospace",fontSize:9,minWidth:60}}>{backendRecovered?`${(100-errRate*100).toFixed(1)}% match`:"No result"}</div>
      </div>
    </div>
  );
}

// ─── Performance Analysis ──────────────────────────────────────────────────────

function PerformanceChart({scheme,snrDb,numCarriers,cpLength}:{scheme:ModScheme;snrDb:number;numCarriers:number;cpLength:number}) {
  const VW=700,VH=220,PAD={l:52,r:24,t:28,b:40};
  const IW=VW-PAD.l-PAD.r,IH=VH-PAD.t-PAD.b;
  const SMX=35, TMXMBPS=300;
  const bps:Record<ModScheme,number>={BPSK:1,QPSK:2,"16-QAM":4,"64-QAM":6};
  const efficiency=numCarriers/(numCarriers+cpLength);
  const getTput=(s:ModScheme,snr:number)=>getBER(s,snr)<0.01?bps[s]*15e3*numCarriers/(numCarriers+cpLength)/1e6:0;
  const getEff=(s:ModScheme,snr:number)=>getTput(s,snr)/((numCarriers)*15e3/1e6)*100;
  const sx=(s:number)=>PAD.l+(s/SMX)*IW;
  const ty=(t:number)=>PAD.t+IH-(t/TMXMBPS)*IH;
  const ALL:ModScheme[]=["BPSK","QPSK","16-QAM","64-QAM"];
  const SC:Record<ModScheme,string>={BPSK:"#00e5b4",QPSK:"#38bdf8","16-QAM":"#c084fc","64-QAM":"#fbbf24"};
  // Shannon capacity line
  const shanPath=Array.from({length:36},(_,i)=>i).map((sn,j)=>{
    const cap=Math.min(Math.log2(1+Math.pow(10,sn/10))*numCarriers*15e3/1e6,TMXMBPS);
    return `${j===0?"M":"L"}${sx(sn).toFixed(1)},${ty(cap).toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{display:"block",background:"#030912"}}>
      <defs>
        <filter id="pf"><feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <pattern id="ppg" width={IW/7} height={IH/6} patternUnits="userSpaceOnUse" x={PAD.l} y={PAD.t}><path d={`M ${IW/7} 0 L 0 0 0 ${IH/6}`} fill="none" stroke="rgba(14,42,80,0.35)" strokeWidth="0.4"/></pattern>
      </defs>
      <rect x={PAD.l} y={PAD.t} width={IW} height={IH} fill="url(#ppg)"/>
      {[0,50,100,150,200,250,300].map((t,i)=>{
        const y=ty(t);
        if(y<PAD.t||y>PAD.t+IH+1) return null;
        return <g key={i}><line x1={PAD.l} y1={y} x2={PAD.l+IW} y2={y} stroke="rgba(14,42,80,0.4)" strokeWidth={0.5}/><text x={PAD.l-6} y={y+3} fill="rgba(14,60,100,0.65)" fontSize={7} fontFamily="JetBrains Mono" textAnchor="end">{t}</text></g>;
      })}
      {[0,5,10,15,20,25,30,35].map(sn=>(
        <g key={sn}><line x1={sx(sn)} y1={PAD.t} x2={sx(sn)} y2={PAD.t+IH} stroke="rgba(14,42,80,0.4)" strokeWidth={0.5}/><text x={sx(sn)} y={VH-22} fill="rgba(14,60,100,0.65)" fontSize={7} fontFamily="JetBrains Mono" textAnchor="middle">{sn}</text></g>
      ))}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t+IH} stroke="rgba(14,60,100,0.75)" strokeWidth={0.9}/>
      <line x1={PAD.l} y1={PAD.t+IH} x2={PAD.l+IW} y2={PAD.t+IH} stroke="rgba(14,60,100,0.75)" strokeWidth={0.9}/>
      {/* Shannon limit */}
      <path d={shanPath} stroke="rgba(255,255,255,0.12)" strokeWidth={1.2} fill="none" strokeDasharray="4,5"/>
      <text x={sx(18)} y={ty(Math.log2(1+Math.pow(10,1.8))*numCarriers*15e3/1e6)-8} fill="rgba(255,255,255,0.18)" fontSize={7} fontFamily="JetBrains Mono">Shannon Limit</text>
      {/* Throughput curves */}
      <g filter="url(#pf)">
        {ALL.map(s=>{
          const pts=Array.from({length:36},(_,i)=>({sn:i,t:getTput(s,i)})).filter(p=>p.t>0);
          const d=pts.map((p,j)=>`${j===0?"M":"L"}${sx(p.sn).toFixed(1)},${ty(p.t).toFixed(1)}`).join(" ");
          return d?<path key={s} d={d} stroke={SC[s]} strokeWidth={s===scheme?3:1} fill="none" opacity={s===scheme?0.45:0.1}/>:null;
        })}
      </g>
      {ALL.map(s=>{
        const pts=Array.from({length:36},(_,i)=>({sn:i,t:getTput(s,i)})).filter(p=>p.t>0);
        const d=pts.map((p,j)=>`${j===0?"M":"L"}${sx(p.sn).toFixed(1)},${ty(p.t).toFixed(1)}`).join(" ");
        if(!d) return null;
        return <path key={s} d={d} stroke={SC[s]} strokeWidth={s===scheme?2:1} fill="none" opacity={s===scheme?1:0.3} strokeDasharray={s===scheme?undefined:"4,3"}/>;
      })}
      {/* Labels at right */}
      {ALL.map(s=>{
        const t=getTput(s,30);
        if(t<=0) return null;
        return <text key={s} x={PAD.l+IW+5} y={ty(t)+3} fill={SC[s]} fontSize={7} fontFamily="JetBrains Mono" opacity={s===scheme?1:0.3}>{s}</text>;
      })}
      {/* Operating point */}
      {(()=>{
        const t=getTput(scheme,snrDb);
        if(t<=0) return null;
        const px=sx(snrDb),py=ty(t);
        return <g filter="url(#pf)"><circle cx={px} cy={py} r={9} fill="none" stroke={SC[scheme]} strokeWidth={1} opacity={0.45}/><circle cx={px} cy={py} r={4} fill={SC[scheme]} opacity={0.95}/><rect x={px+12} y={py-18} width={110} height={21} fill="#07101e" rx={2}/><text x={px+16} y={py-7} fill={SC[scheme]} fontSize={8} fontFamily="JetBrains Mono">{snrDb} dB → {t.toFixed(1)} Mb/s</text></g>;
      })()}
      <text x={PAD.l+IW/2} y={VH-6} fill="rgba(14,60,100,0.65)" fontSize={9} fontFamily="JetBrains Mono" textAnchor="middle">SNR (dB)</text>
      <text x={14} y={PAD.t+IH/2} fill="rgba(14,60,100,0.65)" fontSize={9} fontFamily="JetBrains Mono" textAnchor="middle" transform={`rotate(-90,14,${PAD.t+IH/2})`}>Throughput (Mb/s)</text>
      <text x={PAD.l} y={PAD.t-8} fill="rgba(14,60,100,0.65)" fontSize={8} fontFamily="JetBrains Mono">Illustrative rate estimate, not simulated  •  {numCarriers} subcarriers  •  CP {cpLength}</text>
    </svg>
  );
}

// ─── Pipeline Flow ─────────────────────────────────────────────────────────────

function PipelineFlow({active,runIdx,isRunning,onSelect}:{active:StageId;runIdx:number;isRunning:boolean;onSelect:(id:StageId)=>void}) {
  return (
    <div className="flex items-center px-4 py-2.5 gap-0 overflow-x-auto">
      {STAGES.map((stage,i)=>{
        const Icon=stage.icon;
        const isAct=stage.id===active;
        const isRun=isRunning&&runIdx===i;
        const isPassed=isRunning&&runIdx>i;
        return (
          <div key={stage.id} className="flex items-center gap-0 flex-shrink-0">
            <button onClick={()=>onSelect(stage.id)} style={{outline:"none",background:isAct?stage.bg:"transparent",border:`1px solid ${isAct?stage.color+"50":"transparent"}`,borderRadius:4,padding:"6px 10px",minWidth:60,display:"flex",flexDirection:"column",alignItems:"center",gap:5,position:"relative",transition:"all 0.15s",cursor:"pointer"}}>
              {isRun&&<span style={{position:"absolute",top:-2,right:-2,width:7,height:7,borderRadius:"50%",background:stage.color,boxShadow:`0 0 8px ${stage.color}`,animation:"dotPulse 0.9s ease-in-out infinite"}}/>}
              <div style={{width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,background:isAct||isPassed||isRun?stage.bg:"rgba(14,30,60,0.3)",color:isAct||isPassed||isRun?stage.color:"#1e3a5f",boxShadow:isAct?`0 0 12px ${stage.color}40`:"none",transition:"all 0.15s"}}>
                <Icon size={13}/>
              </div>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,fontWeight:600,color:isAct?stage.color:isPassed?"#2a4060":"#1a2d4a",letterSpacing:"0.05em"}}>{stage.short}</span>
            </button>
            {i<STAGES.length-1&&(
              <div style={{position:"relative",display:"flex",alignItems:"center",width:28,flexShrink:0,height:36}}>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center"}}>
                  <div style={{height:1,width:"100%",background:isPassed?`linear-gradient(90deg,${stage.color}60,${STAGES[i+1].color}40)`:"rgba(14,42,80,0.6)"}}/>
                </div>
                {isRunning&&(isPassed||runIdx===i)&&([0,0.35,0.7].map(d=>(
                  <div key={d} style={{position:"absolute",width:4,height:4,borderRadius:"50%",background:stage.color,boxShadow:`0 0 6px ${stage.color}`,["--travel" as string]:"28px",animation:`particleFlow 1.1s ${d}s linear infinite`}}/>
                )))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── BER Meter ────────────────────────────────────────────────────────────────

function BERMeter({ber}:{ber:number | null}) {
  if(ber===null) return <span style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:10}}>Unavailable</span>;
  const log=Math.log10(Math.max(ber,1e-12));
  const prog=Math.min(Math.max((log+12)/11,0),1);
  const c=ber<1e-6?"#00e5b4":ber<1e-3?"#fbbf24":"#f87171";
  return (
    <div className="flex items-center gap-2">
      <div style={{position:"relative",width:80,height:5,borderRadius:3,overflow:"hidden",background:"rgba(14,42,80,0.5)"}}>
        <div style={{position:"absolute",inset:"0 auto 0 0",width:`${(1-prog)*100}%`,background:c,boxShadow:`0 0 6px ${c}`,borderRadius:3,transition:"width 0.4s"}}/>
      </div>
      <span style={{color:c,fontFamily:"'JetBrains Mono',monospace",fontSize:10}}>{ber<1e-12?"<10⁻¹²":ber.toExponential(2)}</span>
    </div>
  );
}

// ─── Instrument Readout ────────────────────────────────────────────────────────

function Readout({label,value,unit,color}:{label:string;value:string;unit?:string;color?:string}) {
  return (
    <div style={{background:"#030912",padding:"8px 10px",borderRadius:3,border:"1px solid rgba(14,42,80,0.6)"}}>
      <div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:7,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:3}}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span style={{color:color||"#00e5b4",fontFamily:"'JetBrains Mono',monospace",fontSize:17,fontWeight:700,lineHeight:1}}>{value}</span>
        {unit&&<span style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8}}>{unit}</span>}
      </div>
    </div>
  );
}

// ─── Documentation Panel ──────────────────────────────────────────────────────

const DOCS: Record<StageId, { standard: string; formula: string; range: string; ref: string }> = {
  message:      { standard: "ITU-T G.711 / H.265", formula: "Source entropy H(X) = −Σ p(x)log₂p(x)", range: "Payload: 1 byte – 64 KB", ref: "Shannon, 1948" },
  binary:       { standard: "3GPP TS 38.212",      formula: "R_c = k/n  (k info bits, n coded bits)",  range: "Code rates: 1/5 – 948/1024", ref: "Richardson & Urbanke, 2001" },
  modulation:   { standard: "3GPP TS 38.211",      formula: "s(t) = A·cos(2πf_ct + φ(t))",             range: "BPSK to 256-QAM",         ref: "Proakis, Digital Comms" },
  ofdm:         { standard: "3GPP TS 38.211",      formula: "x(t) = Σₖ Xₖ·e^(j2πkΔft)",               range: "15–480 kHz sub-spacing",   ref: "Weinstein & Ebert, 1971" },
  channel:      { standard: "3GPP TR 38.901",      formula: "y(t) = h(τ,t)*x(t) + n(t)",               range: "Delay spread: 0–1000 ns",  ref: "Rappaport, Wireless Comms" },
  reception:    { standard: "3GPP TS 38.211",      formula: "Ŷ[k] = Y[k]/Ĥ[k] = X[k] + N[k]/H[k]",  range: "FFT size: 128–4096",       ref: "Kay, Statistical Signal Proc" },
  demodulation: { standard: "3GPP TS 38.212",      formula: "LLR(b) = log[P(b=0|y)/P(b=1|y)]",         range: "Hard/soft decision",       ref: "Viterbi, 1967" },
  output:       { standard: "3GPP TS 38.322 (RLC)",formula: "BER = N_e / N_total",                      range: "Target BER < 10⁻⁶",        ref: "Lin & Costello, 2004" },
};

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [active, setActive] = useState<StageId>("modulation");
  const [tab, setTab] = useState<VisTab>("constellation");
  const [isRunning, setIsRunning] = useState(false);
  const [runIdx, setRunIdx] = useState(0);
  const [showEdu, setShowEdu] = useState(true);
  const [showDocs, setShowDocs] = useState(false);
  const [seed, setSeed] = useState(1);
  const [p, setP] = useState({ snrDb:20, scheme:"16-QAM" as ModScheme, numCarriers:64, cpLength:16, frequencyOffsetHz:0, timingOffsetSamples:0, message:"Hello, WaveCore X" });
  const [simulation, setSimulation] = useState<SimulationRunResponse | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<ExplanationMap>({});
  const [history, setHistory] = useState<{label:string;ber:string;scheme:ModScheme;snr:number;t:string}[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<Record<string, number | string | boolean>>({});
  const [liveStageSummary, setLiveStageSummary] = useState("Ready");
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const liveSocket = useRef<WebSocket | null>(null);
  const runGeneration = useRef(0);

  const appendHistory = (result: SimulationRunResponse, configuration = p) => {
    const metricBer = Number(result.metrics.ber);
    const now = new Date();
    setHistory(items=>[
      {
        label:`${configuration.scheme} / ${configuration.snrDb} dB`,
        ber:metricBer.toExponential(1),
        scheme:configuration.scheme,
        snr:configuration.snrDb,
        t:now.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}),
      },
      ...items,
    ].slice(0,4));
  };

  const executeSimulation = async () => {
    const generation=++runGeneration.current;
    liveSocket.current?.close();
    liveSocket.current=null;
    setIsRunning(false);
    setIsPaused(false);
    try {
      setSimulation(null);
      setLiveMetrics({});
      setBackendError(null);
      const result = await runSimulation(p);
      if(generation!==runGeneration.current) return;
      setSimulation(result);
      setSeed(s=>s+1);
      appendHistory(result,p);
    } catch (error) {
      if(generation!==runGeneration.current) return;
      setSimulation(null);
      setLiveMetrics({});
      setBackendError(error instanceof Error ? error.message : "WaveCore backend unavailable");
    }
  };

  const sendLiveCommand = (type:string, extra:Record<string, unknown>={}) => {
    const socket = liveSocket.current;
    if(socket?.readyState===WebSocket.OPEN) socket.send(JSON.stringify({type,...extra}));
  };

  const stopLiveSimulation = () => {
    sendLiveCommand("stop");
    liveSocket.current?.close();
    liveSocket.current = null;
    setIsRunning(false);
    setIsPaused(false);
    setLiveStageSummary("Stopped");
  };

  const startLiveSimulation = () => {
    const generation=++runGeneration.current;
    const configuration={...p};
    liveSocket.current?.close();
    setSimulation(null);
    setLiveMetrics({});
    setBackendError(null);
    setIsRunning(true);
    setIsPaused(false);
    setRunIdx(0);
    setLiveStageSummary("Starting live simulation");
    const socket = openLiveSimulation(configuration);
    liveSocket.current = socket;
    socket.onmessage = (message) => {
      if(generation!==runGeneration.current) return;
      const event = JSON.parse(message.data) as LiveSimulationEvent;
      if(event.type==="simulation_started"){
        setLiveMetrics(event.metrics);
        setLiveStageSummary("Simulation started");
      }
      if(event.type==="stage_update"){
        const index = Math.min(event.ui_stage_index, STAGES.length-1);
        setRunIdx(index);
        setActive(STAGES[index].id);
        setLiveMetrics(event.metrics);
        setLiveStageSummary(event.summary);
        setSeed(s=>s+1);
      }
      if(event.type==="simulation_completed"){
        setSimulation(event.simulation);
        setLiveMetrics(event.simulation.metrics);
        appendHistory(event.simulation,configuration);
        setIsRunning(false);
        setIsPaused(false);
        setLiveStageSummary("Simulation completed");
      }
      if(event.type==="simulation_paused"){ setIsPaused(true); setLiveStageSummary("Paused"); }
      if(event.type==="simulation_resumed"){ setIsPaused(false); setLiveStageSummary("Resumed"); }
      if(event.type==="simulation_replay"){ setRunIdx(0); setIsPaused(false); setLiveStageSummary("Replay"); }
      if(event.type==="simulation_rewound"){ setRunIdx(0); setLiveStageSummary("Rewound"); }
      if(event.type==="simulation_stopped"){ setIsRunning(false); setIsPaused(false); setLiveStageSummary("Stopped"); }
      if(event.type==="playback_speed_updated") setPlaybackSpeed(event.playback_speed);
    };
    socket.onerror = () => {
      if(generation!==runGeneration.current) return;
      setBackendError("Live WebSocket connection failed");
      setIsRunning(false);
      setIsPaused(false);
    };
    socket.onclose = () => {
      if(generation!==runGeneration.current) return;
      liveSocket.current = null;
      setIsRunning(false);
    };
  };

  useEffect(()=>()=>liveSocket.current?.close(),[]);

  useEffect(()=>{
    setSimulation(null);
    setLiveMetrics({});
    setBackendError(null);
    setIsRunning(false);
    setIsPaused(false);
    setLiveStageSummary("Parameters changed; preparing simulation");
    const id=window.setTimeout(()=>{ void executeSimulation(); },350);
    return()=>{
      window.clearTimeout(id);
      runGeneration.current+=1;
      liveSocket.current?.close();
      liveSocket.current=null;
    };
  },[p.message,p.scheme,p.snrDb,p.numCarriers,p.cpLength,p.frequencyOffsetHz,p.timingOffsetSamples]);

  useEffect(()=>{
    getExplanations().then(setExplanations).catch(()=>setExplanations({}));
  },[]);

  const go=(id:StageId)=>{ setActive(id); setTab(STAGE_DEFAULT_TAB[id]); };

  const cur=STAGES.find(s=>s.id===active)!;
  const backendGuide=explanations[BACKEND_STAGE[active]];
  const edu={
    ...EDUCATION[active],
    what: backendGuide?.what ?? EDUCATION[active].what,
    why: backendGuide?.math ?? EDUCATION[active].why,
    industry: backendGuide?.industrial_usage ?? EDUCATION[active].industry,
    tip: backendGuide?.qualcomm_relevance ?? backendGuide?.common_mistakes?.[0] ?? EDUCATION[active].tip,
  };
  const doc=DOCS[active];
  const bps:Record<ModScheme,number>={BPSK:1,QPSK:2,"16-QAM":4,"64-QAM":6};
  const currentBer=liveMetrics.ber ?? simulation?.metrics.ber;
  const ber=typeof currentBer === "number" ? currentBer : null;
  const cpOH=p.cpLength/p.numCarriers;
  const currentThroughput=liveMetrics.throughput_bps ?? simulation?.metrics.throughput_bps;
  const tput=typeof currentThroughput === "number" ? (currentThroughput/1e6).toFixed(3) : "—";
  const berColor=ber===null?"#1e3a5f":ber<1e-6?"#00e5b4":ber<1e-3?"#fbbf24":"#f87171";
  const constellationTx=getTraceVisualization(simulation,"demodulation","transmitted_constellation");
  const constellationRx=getTraceVisualization(simulation,"equalization","equalized_constellation");
  const waveformTraces=getWaveformTraces(simulation);
  const resourceGridTrace=getResourceGridTrace(simulation,active);
  const channelCoefficientTrace=getChannelCoefficientTrace(simulation);
  const actualTraceTab=tab==="constellation"||tab==="ofdm-grid"||tab==="multipath";
  const activeTrace=tab==="constellation"?constellationRx:tab==="ofdm-grid"?resourceGridTrace:tab==="multipath"?channelCoefficientTrace:undefined;
  const visibleTabs=ALL_TABS.filter(t=>!t.stages||t.stages.includes(active));

  const HISTORY=history; /*
    {label:"16-QAM / 20 dB",ber:"2.3×10⁻⁵",scheme:"16-QAM" as ModScheme,snr:20,t:"14:38"},
    {label:"QPSK / 15 dB",  ber:"1.8×10⁻⁴",scheme:"QPSK" as ModScheme,  snr:15,t:"14:27"},
    {label:"64-QAM / 28 dB",ber:"4.1×10⁻⁶",scheme:"64-QAM" as ModScheme,snr:28,t:"14:11"},
    {label:"BPSK / 8 dB",   ber:"7.6×10⁻³",scheme:"BPSK" as ModScheme,  snr:8, t:"13:58"},
  ]; */

  return (
    <>
      <InjectCSS/>
      <div className="h-screen flex flex-col overflow-hidden" style={{background:"#030912",color:"#c8d8e8",fontFamily:"'Inter',system-ui,sans-serif",userSelect:"none"}}>

        {/* ── Header ── */}
        <header className="flex items-center gap-3 px-4 flex-shrink-0 border-b" style={{height:46,background:"#050e1c",borderColor:"rgba(14,42,80,0.75)"}}>
          {/* Logo */}
          <div className="flex items-center gap-2.5 mr-1">
            <div style={{width:28,height:28,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,229,180,0.1)",border:"1px solid rgba(0,229,180,0.28)",boxShadow:"0 0 12px rgba(0,229,180,0.12)"}}>
              <Waves size={14} style={{color:"#00e5b4"}}/>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span style={{color:"#00e5b4",fontFamily:"'Rajdhani',system-ui,sans-serif",fontWeight:700,fontSize:14,letterSpacing:"0.2em",textTransform:"uppercase"}}>WaveCore</span>
              <span style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:600}}>X</span>
            </div>
          </div>

          <div style={{height:18,width:1,background:"rgba(14,42,80,0.8)",margin:"0 4px"}}/>

          {/* Simulation controls */}
          <button onClick={()=>{isRunning?stopLiveSimulation():startLiveSimulation();}} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:3,background:isRunning?"rgba(248,113,113,0.1)":"rgba(0,229,180,0.1)",color:isRunning?"#f87171":"#00e5b4",border:`1px solid ${isRunning?"rgba(248,113,113,0.32)":"rgba(0,229,180,0.32)"}`,fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:500,cursor:"pointer",outline:"none"}}>
            {isRunning?<Square size={9}/>:<Play size={9}/>}
            {isRunning?"STOP":"RUN SIM"}
          </button>
          <button disabled={!isRunning} onClick={()=>{sendLiveCommand(isPaused?"resume":"pause");setIsPaused(v=>!v);}} style={{width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"1px solid rgba(14,42,80,0.75)",color:isRunning?"#38bdf8":"#1e3a5f",background:"transparent",cursor:isRunning?"pointer":"not-allowed",outline:"none"}} title={isPaused?"Resume":"Pause"}>
            {isPaused?<Play size={10}/>:<Pause size={10}/>}
          </button>
          <button disabled={!isRunning} onClick={()=>sendLiveCommand("step_backward")} style={{width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"1px solid rgba(14,42,80,0.75)",color:isRunning?"#38bdf8":"#1e3a5f",background:"transparent",cursor:isRunning?"pointer":"not-allowed",outline:"none"}} title="Step backward">
            <SkipBack size={10}/>
          </button>
          <button disabled={!isRunning} onClick={()=>sendLiveCommand("step_forward")} style={{width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"1px solid rgba(14,42,80,0.75)",color:isRunning?"#38bdf8":"#1e3a5f",background:"transparent",cursor:isRunning?"pointer":"not-allowed",outline:"none"}} title="Step forward">
            <SkipForward size={10}/>
          </button>
          <button onClick={()=>{stopLiveSimulation();setRunIdx(0);void executeSimulation();}} style={{width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"1px solid rgba(14,42,80,0.75)",color:"#1e3a5f",background:"transparent",cursor:"pointer",outline:"none"}} title="Reset">
            <RefreshCw size={10}/>
          </button>
          <select value={playbackSpeed} onChange={e=>{const speed=+e.target.value;setPlaybackSpeed(speed);sendLiveCommand("set_speed",{playback_speed:speed});}} style={{background:"#030912",color:"#2a4060",border:"1px solid rgba(14,42,80,0.75)",borderRadius:3,padding:"2px 4px",fontFamily:"'JetBrains Mono',monospace",fontSize:9,outline:"none"}}>
            {[0.5,1,2,4].map(speed=><option key={speed} value={speed}>{speed}x</option>)}
          </select>

          <div style={{height:18,width:1,background:"rgba(14,42,80,0.8)",margin:"0 4px"}}/>

          {/* Scheme + SNR */}
          <div className="flex items-center gap-2 text-xs">
            <span style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:9}}>SCHEME</span>
            <select value={p.scheme} onChange={e=>setP(v=>({...v,scheme:e.target.value as ModScheme}))} style={{background:"#030912",color:"#c8d8e8",border:"1px solid rgba(14,42,80,0.75)",borderRadius:3,padding:"2px 6px",fontFamily:"'JetBrains Mono',monospace",fontSize:10,outline:"none",cursor:"pointer"}}>
              {(["BPSK","QPSK","16-QAM","64-QAM"] as ModScheme[]).map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:9}}>SNR</span>
            <span style={{color:"#c8d8e8",fontFamily:"'JetBrains Mono',monospace",fontSize:11,minWidth:38,textAlign:"right"}}>{p.snrDb} dB</span>
            <input type="range" min={0} max={35} step={1} value={p.snrDb} onChange={e=>setP(v=>({...v,snrDb:+e.target.value}))} style={{width:80,accentColor:"#00e5b4"}}/>
          </div>

          <div className="flex-1"/>

          {/* Live metrics */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-0.5">
              <span style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:7,letterSpacing:"0.1em"}}>BER</span>
              <BERMeter ber={ber}/>
            </div>
            <div style={{height:12,width:1,background:"rgba(14,42,80,0.8)"}}/>
            <div className="flex items-center gap-3" style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10}}>
              <div className="flex items-center gap-1">
                <span style={{color:"#1e3a5f"}}>TPUT</span>
                <span style={{color:"#c8d8e8"}}>{tput} Mb/s</span>
              </div>
              <div style={{height:12,width:1,background:"rgba(14,42,80,0.8)"}}/>
              <div className="flex items-center gap-1.5">
                <div style={{width:6,height:6,borderRadius:"50%",background:isRunning?"#00e5b4":"#1e3a5f",boxShadow:isRunning?"0 0 8px #00e5b4":"none",flexShrink:0}}/>
                <span style={{color:isRunning?"#00e5b4":"#1e3a5f"}}>{isRunning?"PLAYBACK":"IDLE"}</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left Sidebar ── */}
          <aside className="flex-shrink-0 flex flex-col border-r overflow-y-auto" style={{width:178,background:"#040c1a",borderColor:"rgba(14,42,80,0.75)"}}>
            <div className="px-3 py-2 border-b flex-shrink-0" style={{borderColor:"rgba(14,42,80,0.75)"}}>
              <span style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.15em",textTransform:"uppercase"}}>Pipeline</span>
            </div>
            <div className="flex-1">
              {STAGES.map((stage,i)=>{
                const Icon=stage.icon;
                const isAct=stage.id===active;
                const isRun=isRunning&&runIdx===i;
                const isPassed=isRunning&&runIdx>i;
                return (
                  <div key={stage.id}>
                    <button onClick={()=>go(stage.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",textAlign:"left",background:isAct?stage.bg:"transparent",borderLeft:`2px solid ${isAct?stage.color:"transparent"}`,outline:"none",cursor:"pointer",transition:"all 0.15s"}}>
                      <div style={{position:"relative",flexShrink:0}}>
                        <div style={{width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,background:isAct||isPassed||isRun?stage.bg:"rgba(14,30,60,0.3)",color:isAct||isPassed||isRun?stage.color:"#1e3a5f",boxShadow:isAct?`0 0 10px ${stage.color}45`:"none",transition:"all 0.15s"}}>
                          <Icon size={12}/>
                        </div>
                        {isRun&&<span style={{position:"absolute",top:-2,right:-2,width:6,height:6,borderRadius:"50%",background:stage.color,animation:"dotPulse 0.9s ease-in-out infinite",boxShadow:`0 0 6px ${stage.color}`}}/>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:10.5,fontWeight:500,lineHeight:1.1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:isAct?stage.color:isPassed?"#2a4060":"#1a2d4a"}}>{stage.label}</div>
                        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:7,marginTop:1,color:isRun?stage.color:isPassed?"#1e3a5f":"transparent"}}>{isRun?"processing…":isPassed?"✓ done":""}</div>
                      </div>
                    </button>
                    {i<STAGES.length-1&&<div style={{paddingLeft:28,height:9}}><div style={{width:1,height:"100%",marginLeft:10,background:isPassed?`linear-gradient(${stage.color}80,${STAGES[i+1].color}30)`:"rgba(14,42,80,0.5)",transition:"background 0.4s"}}/></div>}
                  </div>
                );
              })}
            </div>
            {/* Experiment History */}
            <div className="border-t flex-shrink-0" style={{borderColor:"rgba(14,42,80,0.75)"}}>
              <div className="px-3 py-2 flex items-center gap-1.5">
                <FlaskConical size={9} style={{color:"#1e3a5f"}}/>
                <span style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.12em",textTransform:"uppercase"}}>History</span>
              </div>
              {HISTORY.map((exp,i)=>(
                <button key={i} onClick={()=>{setP(v=>({...v,scheme:exp.scheme,snrDb:exp.snr}));setSeed(s=>s+1);}} style={{width:"100%",textAlign:"left",padding:"6px 12px",borderTop:"1px solid rgba(14,42,80,0.5)",background:"transparent",cursor:"pointer",outline:"none",transition:"background 0.15s"}}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#2a4060"}}>{exp.label}</div>
                  <div className="flex justify-between mt-0.5">
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"#c084fc"}}>{exp.ber}</span>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"#1e3a5f"}}>{exp.t}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* ── Main ── */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Pipeline strip */}
            <div className="border-b flex-shrink-0" style={{background:"#040c1a",borderColor:"rgba(14,42,80,0.75)"}}>
              <PipelineFlow active={active} runIdx={runIdx} isRunning={isRunning} onSelect={go}/>
            </div>

            {/* Workspace */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Stage header + tabs */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div style={{width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:4,background:cur.bg,boxShadow:`0 0 18px ${cur.glow}`,flexShrink:0}}>
                    {(()=>{const I=cur.icon;return <I size={16}/>;})()}
                  </div>
                  <div>
                    <h2 style={{color:cur.color,fontFamily:"'Rajdhani',system-ui,sans-serif",fontWeight:700,fontSize:16,letterSpacing:"0.06em",textTransform:"uppercase",lineHeight:1.2,margin:0}}>{cur.label}</h2>
                    <p style={{color:"#2a4060",fontSize:11,margin:0}}>{cur.desc}</p>
                  </div>
                </div>
                {/* Tab bar */}
                <div style={{display:"flex",gap:2,padding:3,borderRadius:4,background:"#030912",border:"1px solid rgba(14,42,80,0.75)",flexWrap:"wrap"}}>
                  {visibleTabs.map(t=>(
                    <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"4px 10px",borderRadius:3,fontSize:10,fontWeight:500,fontFamily:"'JetBrains Mono',monospace",background:tab===t.id?cur.bg:"transparent",color:tab===t.id?cur.color:"#1e3a5f",boxShadow:tab===t.id?`0 0 8px ${cur.glow}`:"none",cursor:"pointer",outline:"none",border:"none",transition:"all 0.15s",whiteSpace:"nowrap"}}>{t.label}</button>
                  ))}
                </div>
              </div>

              {/* Visualization */}
              {backendError&&(
                <div style={{border:"1px solid rgba(248,113,113,0.35)",background:"rgba(248,113,113,0.08)",color:"#f87171",fontFamily:"'JetBrains Mono',monospace",fontSize:10,padding:"8px 10px",borderRadius:4}}>
                  Backend link warning: {backendError}
                </div>
              )}
              <div className="stage-fade rounded overflow-hidden" style={{border:"1px solid rgba(14,42,80,0.75)"}}>
                {tab!=="recovered"&&tab!=="transform"&&<div style={{padding:"5px 9px",background:"#07101e",color:"#6b7890",fontFamily:"'JetBrains Mono',monospace",fontSize:8}}>{actualTraceTab?(activeTrace?"BACKEND TRACE - current simulation arrays, bounded preview":"TRACE UNAVAILABLE - run a simulation"):"DEMO DATA / THEORETICAL - illustrative, not backend samples"}</div>}
                {tab==="waveform"      &&<AnimatedWaveform stage={active} snrDb={p.snrDb} isRunning={isRunning}/>}
                {tab==="constellation" &&<ConstellationDiagram scheme={p.scheme} transmitted={constellationTx} received={constellationRx}/>}
                {tab==="spectrum"      &&<SpectrumAnalyzer numCarriers={p.numCarriers} stage={active}/>}
                {tab==="ber"           &&<BERCurve scheme={p.scheme} snrDb={p.snrDb}/>}
                {tab==="transform"     &&<MessageTransform message={p.message} scheme={p.scheme}/>}
                {tab==="multipath"     &&<ChannelResponseTrace trace={channelCoefficientTrace}/>}
                {tab==="ofdm-grid"     &&<ResourceGridTrace grid={resourceGridTrace} source={active==="ofdm"?"TX":"RX"}/>}
                {tab==="recovered"     &&<RecoveredComparison message={p.message} scheme={p.scheme} snrDb={p.snrDb} recoveredMessage={simulation?.recovered_message} actualBer={typeof simulation?.metrics.ber === "number" ? simulation.metrics.ber : undefined} crcOk={simulation?.crc_ok}/>}
                {tab==="performance"   &&<PerformanceChart scheme={p.scheme} snrDb={p.snrDb} numCarriers={p.numCarriers} cpLength={p.cpLength}/>}
              </div>

              {/* Education panel */}
              <div className="rounded" style={{border:"1px solid rgba(14,42,80,0.75)",background:"#040c1a"}}>
                <button onClick={()=>setShowEdu(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 16px",borderBottom:showEdu?"1px solid rgba(14,42,80,0.75)":"none",outline:"none",background:"transparent",cursor:"pointer",borderRadius:"inherit"}}>
                  <BookOpen size={10} style={{color:cur.color,flexShrink:0}}/>
                  <span style={{color:cur.color,fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase"}}>Stage Guide — {cur.label}</span>
                  <div style={{flex:1}}/>
                  {showEdu?<EyeOff size={10} style={{color:"#1e3a5f"}}/>:<Eye size={10} style={{color:"#1e3a5f"}}/>}
                </button>
                {showEdu&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderTop:"none"}}>
                    {([["What is happening",edu.what],["Why it matters",edu.why],["Industry usage",edu.industry],["Parameter insight",edu.tip]] as [string,string][]).map(([lbl,content],i)=>(
                      <div key={i} style={{padding:"12px 16px",borderRight:i%2===0?"1px solid rgba(14,42,80,0.5)":"none",borderBottom:i<2?"1px solid rgba(14,42,80,0.5)":"none"}}>
                        <div style={{color:cur.color,opacity:0.6,fontFamily:"'JetBrains Mono',monospace",fontSize:7,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:5}}>{lbl}</div>
                        <p style={{color:"#2a4060",fontSize:11,lineHeight:1.65,margin:0}}>{content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documentation panel */}
              <div className="rounded" style={{border:"1px solid rgba(14,42,80,0.75)",background:"#040c1a"}}>
                <button onClick={()=>setShowDocs(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 16px",borderBottom:showDocs?"1px solid rgba(14,42,80,0.75)":"none",outline:"none",background:"transparent",cursor:"pointer",borderRadius:"inherit"}}>
                  <FileText size={10} style={{color:"#1e3a5f",flexShrink:0}}/>
                  <span style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase"}}>Technical Reference — {doc.standard}</span>
                  <div style={{flex:1}}/>
                  <ChevronRight size={10} style={{color:"#1e3a5f",transform:showDocs?"rotate(90deg)":"none",transition:"transform 0.2s"}}/>
                </button>
                {showDocs&&(
                  <div style={{padding:"12px 16px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                    {[["Standard",doc.standard],["Key Formula",doc.formula],["Operating Range",doc.range],["Reference",doc.ref]].map(([lbl,val],i)=>(
                      <div key={i} style={{gridColumn:lbl==="Key Formula"?"span 2":"span 1"}}>
                        <div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:7,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4}}>{lbl}</div>
                        <div style={{color:"#38bdf8",fontFamily:"'JetBrains Mono',monospace",fontSize:10}}>{val}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* ── Right Inspector ── */}
          <aside className="flex-shrink-0 flex flex-col border-l overflow-y-auto" style={{width:246,background:"#040c1a",borderColor:"rgba(14,42,80,0.75)"}}>
            <div className="px-3 py-2 border-b flex items-center gap-2 flex-shrink-0" style={{borderColor:"rgba(14,42,80,0.75)"}}>
              <SlidersHorizontal size={9} style={{color:"#1e3a5f"}}/>
              <span style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.15em",textTransform:"uppercase"}}>Parameter Inspector</span>
            </div>
            <div className="p-3 space-y-4 flex-1 overflow-y-auto">
              {/* Instrument readouts */}
              <div className="grid grid-cols-2 gap-1.5">
                <Readout label="Bit Error Rate" value={ber===null?"—":ber.toExponential(2)} color={berColor}/>
                <Readout label="Throughput" value={tput} unit="Mb/s" color="#38bdf8"/>
                <Readout label="Modulation" value={`${bps[p.scheme]}`} unit="bit/sym" color="#c084fc"/>
                <Readout label="OFDM Eff." value={`${(p.numCarriers/(p.numCarriers+p.cpLength)*100).toFixed(0)}`} unit="%" color="#fbbf24"/>
              </div>
              {/* Modulation grid */}
              <div className="space-y-2">
                <div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.12em",textTransform:"uppercase"}}>Modulation Scheme</div>
                <div className="grid grid-cols-2 gap-1">
                  {(["BPSK","QPSK","16-QAM","64-QAM"] as ModScheme[]).map(s=>{
                    const act=p.scheme===s;
                    return <button key={s} onClick={()=>setP(v=>({...v,scheme:s}))} style={{display:"flex",flexDirection:"column",alignItems:"flex-start",padding:"7px 8px",borderRadius:3,border:`1px solid ${act?"#818cf8":"rgba(14,42,80,0.65)"}`,background:act?"rgba(129,140,248,0.1)":"#030912",color:act?"#818cf8":"#1e3a5f",cursor:"pointer",outline:"none",transition:"all 0.15s"}}>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:600}}>{s}</span>
                      <span style={{fontSize:8,color:"#1e3a5f"}}>{bps[s]} bit/sym</span>
                    </button>;
                  })}
                </div>
              </div>
              {/* Sliders */}
              {[
                {key:"snrDb",      label:"SNR",          min:0,  max:35, step:1, unit:"dB",   color:"#00e5b4"},
                {key:"numCarriers",label:"FFT Size",      min:8,  max:256,step:8, unit:"",     color:"#fbbf24"},
                {key:"cpLength",   label:"Cyclic Prefix",min:4,  max:64, step:4, unit:"samp", color:"#38bdf8"},
                {key:"frequencyOffsetHz",label:"CFO (uncorrected)",min:-120000,max:120000,step:1000,unit:" Hz",color:"#f87171"},
                {key:"timingOffsetSamples",label:"Timing (uncorrected)",min:-Math.min(p.cpLength,16),max:Math.min(p.cpLength,16),step:1,unit:" samp",color:"#fb923c"},
              ].map(({key,label,min,max,step,unit,color})=>{
                const val=p[key as keyof typeof p] as number;
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.1em",textTransform:"uppercase"}}>{label}</span>
                      <span style={{color,fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700}}>{val}{unit}</span>
                    </div>
                    <input type="range" min={min} max={key==="cpLength"?Math.min(max,p.numCarriers-1):max} step={step} value={val} onChange={e=>setP(v=>{
                      const raw=+e.target.value;
                      if(key==="numCarriers"){
                        const fftSize=[8,16,32,64,128,256].reduce((best,candidate)=>Math.abs(candidate-raw)<Math.abs(best-raw)?candidate:best,8);
                        const cpLength=Math.min(v.cpLength,fftSize-1);
                        const timingLimit=Math.min(cpLength,16);
                        return {...v,numCarriers:fftSize,cpLength,timingOffsetSamples:Math.max(-timingLimit,Math.min(v.timingOffsetSamples,timingLimit))};
                      }
                      if(key==="cpLength"){
                        const cpLength=Math.min(raw,v.numCarriers-1);
                        const timingLimit=Math.min(cpLength,16);
                        return {...v,cpLength,timingOffsetSamples:Math.max(-timingLimit,Math.min(v.timingOffsetSamples,timingLimit))};
                      }
                      return {...v,[key]:raw};
                    })} className="w-full" style={{accentColor:color}}/>
                    <div className="flex justify-between" style={{fontFamily:"'JetBrains Mono',monospace",fontSize:7,color:"#1e3a5f"}}>
                      <span>{min}</span><span>{max}</span>
                    </div>
                  </div>
                );
              })}
              {/* Message input */}
              <div className="space-y-1.5">
                <div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.12em",textTransform:"uppercase"}}>Source Message</div>
                <input type="text" value={p.message} onChange={e=>setP(v=>({...v,message:e.target.value}))} placeholder="Enter message…" style={{width:"100%",padding:"6px 8px",borderRadius:3,background:"#030912",color:"#c8d8e8",border:"1px solid rgba(14,42,80,0.65)",fontFamily:"'JetBrains Mono',monospace",fontSize:10,outline:"none",boxSizing:"border-box"}}/>
                <div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8}}>{p.message.length} chars · {p.message.length*8} bits · {Math.ceil(p.message.length*8/bps[p.scheme])} syms</div>
              </div>
              {/* Computed metrics */}
              <div className="border-t pt-3 space-y-0" style={{borderColor:"rgba(14,42,80,0.65)"}}>
                <div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Computed Metrics</div>
                {[
                  {l:"Measured frame BER",v:ber===null?"—":ber.toExponential(2),c:berColor},
                  {l:"Modulation bits/symbol",v:`${bps[p.scheme]}`,c:"#818cf8"},
                  {l:"CP Overhead",v:`${(cpOH*100).toFixed(1)}%`,c:"#38bdf8"},
                  {l:"OFDM time efficiency",v:`${(p.numCarriers/(p.numCarriers+p.cpLength)*100).toFixed(1)}%`,c:"#00e5b4"},
                  {l:"Est. Throughput",v:`${tput} Mb/s`,c:"#fbbf24"},
                  {l:"Symbols/char",v:`${Math.ceil(8/bps[p.scheme])}`,c:"#c084fc"},
                ].map(({l,v,c})=>(
                  <div key={l} className="flex justify-between items-baseline py-1.5 border-b last:border-0" style={{borderColor:"rgba(14,42,80,0.4)"}}>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#1e3a5f"}}>{l}</span>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:c,fontWeight:600}}>{v}</span>
                  </div>
                ))}
              </div>
              {/* Binary preview */}
              <div className="border-t pt-3 space-y-2" style={{borderColor:"rgba(14,42,80,0.65)"}}>
                <div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.12em",textTransform:"uppercase"}}>Binary Preview</div>
                {p.message.slice(0,5).split("").map((ch,i)=>(
                  <div key={i} className="flex items-center gap-2">
                    <div style={{width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,background:SYM_COLORS[i%SYM_COLORS.length]+"18",color:SYM_COLORS[i%SYM_COLORS.length],fontFamily:"'JetBrains Mono',monospace",fontSize:9,fontWeight:600,flexShrink:0}}>{ch===" "?"·":ch}</div>
                    <span style={{color:SYM_COLORS[i%SYM_COLORS.length],opacity:0.7,fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:"0.06em"}}>{ch.charCodeAt(0).toString(2).padStart(8,"0")}</span>
                  </div>
                ))}
                {p.message.length>5&&<div style={{color:"#1e3a5f",fontFamily:"'JetBrains Mono',monospace",fontSize:8}}>+{p.message.length-5} more</div>}
              </div>
            </div>
          </aside>
        </div>

        {/* ── Status Bar ── */}
        <footer className="flex-shrink-0 flex items-center px-4 gap-4 border-t" style={{height:25,background:"#050e1c",borderColor:"rgba(14,42,80,0.75)",fontFamily:"'JetBrains Mono',monospace",fontSize:8}}>
          <div className="flex items-center gap-1.5">
            <div style={{width:5,height:5,borderRadius:"50%",background:isRunning?"#00e5b4":"#1e3a5f",boxShadow:isRunning?"0 0 6px #00e5b4":"none",flexShrink:0}}/>
            <span style={{color:"#1e3a5f"}}>{isRunning?`${STAGES[runIdx]?.label}: ${liveStageSummary}`:"Ready — RUN SIM computes the link, then plays its recorded stages"}</span>
          </div>
          <div style={{height:10,width:1,background:"rgba(14,42,80,0.8)"}}/>
          {[
            {k:"SCHEME",v:p.scheme},{k:"SNR",v:`${p.snrDb} dB`},{k:"BER",v:ber===null?"—":ber.toExponential(2)},
            {k:"CARRIERS",v:String(p.numCarriers)},{k:"CP",v:String(p.cpLength)},{k:"EFF",v:`${((1-cpOH)*100).toFixed(0)}%`},
          ].map(({k,v})=>(
            <div key={k} className="flex items-center gap-1">
              <span style={{color:"#1a3050"}}>{k}</span>
              <span style={{color:"#2a4060"}}>{v}</span>
            </div>
          ))}
          <div style={{flex:1}}/>
          <span style={{color:"#1a2d48"}}>WaveCore X  ·  v3.0.0  ·  2024</span>
        </footer>
      </div>
    </>
  );
}
