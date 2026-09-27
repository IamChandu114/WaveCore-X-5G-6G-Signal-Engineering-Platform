import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Binary,
  Box,
  Braces,
  Check,
  ChevronRight,
  CircleDot,
  Code2,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  Gauge,
  GitBranch,
  Github,
  Grid3X3,
  Layers3,
  LockKeyhole,
  Menu,
  Radio,
  RotateCcw,
  Signal,
  SlidersHorizontal,
  TerminalSquare,
  TestTube2,
  Waves,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArticleLink, articles } from "@/components/blog/BlogSite";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WaveCore X — Baseband Wireless Communications Simulator" },
      {
        name: "description",
        content:
          "Explore WaveCore X, a complex-baseband wireless communications simulator with an implemented message-to-recovery signal chain.",
      },
      { property: "og:title", content: "WaveCore X — Baseband Wireless Communications Simulator" },
      {
        property: "og:description",
        content:
          "Inspect the implemented signal chain, architecture, channel models, receiver, metrics, and current validation boundary.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

type Stage = {
  id: string;
  short: string;
  name: string;
  purpose: string;
  input: string;
  output: string;
  status: "Described core link";
  assumption: string;
  limitation: string;
};

const stages: Stage[] = [
  { id: "source", short: "01", name: "Message & framing", purpose: "Convert a UTF-8 message to bits and append CRC-16 framing for error detection.", input: "UTF-8 text", output: "Framed bitstream", status: "Described core link", assumption: "The source payload is valid UTF-8.", limitation: "CRC detects corruption; it does not correct it." },
  { id: "coding", short: "02", name: "Coding & interleaving", purpose: "Apply Hamming(7,4) coding and block interleaving before symbol mapping.", input: "Framed bits", output: "Protected, reordered bits", status: "Described core link", assumption: "Block dimensions follow the configured frame.", limitation: "Advanced coding modules are not connected to this core path." },
  { id: "mapping", short: "03", name: "Symbol mapping", purpose: "Map coded bits to normalized complex constellation symbols.", input: "Coded bits", output: "Complex symbols", status: "Described core link", assumption: "BPSK, QPSK, 16/64/256-QAM are supported.", limitation: "Constellation artwork on this site is explanatory, not measured output." },
  { id: "ofdm", short: "04", name: "OFDM framing", purpose: "Place data and pilots, run IFFT, and append a cyclic prefix.", input: "Complex symbols", output: "Time-domain OFDM samples", status: "Described core link", assumption: "A basic pilot-bearing OFDM configuration is used.", limitation: "Advanced resource-grid and OFDMA modules are not all integrated." },
  { id: "channel", short: "05", name: "Channel", purpose: "Apply AWGN or a flat block Rayleigh/Rician fading model.", input: "Transmit samples", output: "Impaired samples", status: "Described core link", assumption: "A supplied seed makes stochastic channel runs deterministic.", limitation: "Advanced multipath and over-the-air effects are outside the integrated link." },
  { id: "receiver", short: "06", name: "Estimate & equalize", purpose: "Use pilots for channel estimation, then apply ZF or MMSE equalization.", input: "Impaired samples", output: "Equalized symbols", status: "Described core link", assumption: "Pilot observations represent the flat block channel.", limitation: "Synchronization correction is not established as part of the integrated link." },
  { id: "decode", short: "07", name: "Decode & measure", purpose: "Demap, deinterleave, decode, verify framing, and recover the message.", input: "Equalized symbols", output: "Recovered text + metrics", status: "Described core link", assumption: "Metrics are computed from finite simulation results.", limitation: "Results are software-model outputs, not hardware measurements." },
];

const capabilities = [
  ["Source integrity", "UTF-8 processing and CRC-16 framing", Binary],
  ["Forward error control", "Hamming(7,4) and block interleaving", Layers3],
  ["Symbol mapping", "BPSK through 256-QAM", Grid3X3],
  ["Multicarrier", "Pilot-bearing OFDM, IFFT/FFT, cyclic prefix", Waves],
  ["Channel", "AWGN and flat Rayleigh/Rician models", Radio],
  ["Receiver", "Pilot estimation with ZF and MMSE", SlidersHorizontal],
] as const;

const nav = [
  ["Signal path", "#signal-path"],
  ["Capabilities", "#capabilities"],
  ["Architecture", "#architecture"],
  ["Validation", "#validation"],
] as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow"><span aria-hidden="true" />{children}</p>;
}

function Status({ children, variant = "verified" }: { children: React.ReactNode; variant?: "verified" | "standalone" | "illustrative" | "planned" }) {
  return <span className={cn("status", `status-${variant}`)}><span aria-hidden="true" />{children}</span>;
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <header className="section-heading">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </header>
  );
}

function SignalVisual() {
  return (
    <div className="signal-visual" aria-label="Illustrative visualization of a signal passing through a communications channel">
      <div className="visual-label"><Status variant="illustrative">Illustrative visualization</Status><span>NOT A MEASUREMENT</span></div>
      <svg viewBox="0 0 900 430" role="img" aria-labelledby="signal-title signal-desc">
        <title id="signal-title">Complex baseband signal flow</title>
        <desc id="signal-desc">An explanatory waveform changes through transmit, channel, and receiver stages.</desc>
        <defs>
          <pattern id="smallGrid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" className="grid-line" /></pattern>
          <linearGradient id="signalFade" x1="0" x2="1"><stop offset="0" className="stop-cyan" /><stop offset=".72" className="stop-cyan" /><stop offset="1" className="stop-amber" /></linearGradient>
        </defs>
        <rect width="900" height="430" fill="url(#smallGrid)" />
        <line x1="44" y1="214" x2="856" y2="214" className="axis" />
        <line x1="80" y1="45" x2="80" y2="380" className="axis" />
        <path className="trace trace-glow" d="M50 214 C70 90 85 338 110 214 S145 90 170 214 S205 338 230 214 L255 214 L265 145 L275 275 L285 125 L295 297 L305 180 L315 240 L330 214 C355 52 380 365 405 214 S455 58 480 214 S530 365 555 214 L590 214 C610 120 628 304 647 214 S680 105 700 214 S735 317 755 214 S790 110 812 214 S842 310 856 214" />
        {[250, 570].map((x) => <line key={x} x1={x} y1="60" x2={x} y2="365" className="divider" />)}
        <g className="axis-labels"><text x="92" y="78">TX / COMPLEX SAMPLES</text><text x="272" y="78">CHANNEL MODEL</text><text x="592" y="78">RX / EQUALIZED</text><text x="48" y="405">0</text><text x="828" y="405">t →</text></g>
        {[{ x: 130, y: 214 }, { x: 360, y: 179 }, { x: 680, y: 224 }, { x: 780, y: 212 }].map(({ x, y }) => <g key={x}><circle cx={x} cy={y} r="5" className="signal-node" /><circle cx={x} cy={y} r="13" className="signal-ring" /></g>)}
      </svg>
      <div className="visual-footer"><span>BASEBAND / I + jQ</span><span>SEED: DETERMINISTIC WHEN SUPPLIED</span><span>fₛ / CONFIGURED</span></div>
    </div>
  );
}

function safeExternalUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function Index() {
  const isDev = import.meta.env.DEV;
  const configuredUrl = import.meta.env["VITE_SIMULATOR_URL"];
  const activeSimulatorUrl = configuredUrl ? safeExternalUrl(configuredUrl) : (isDev ? "http://localhost:5174" : undefined);
  const githubUrl = safeExternalUrl(import.meta.env["VITE_GITHUB_URL"]);
  const demoUrl = safeExternalUrl(import.meta.env["VITE_DEMO_VIDEO_URL"]);
  const [selected, setSelected] = useState<Stage>(stages[0] ?? { id: "source", short: "01", name: "Message & framing", purpose: "Frame the message for transmission.", input: "UTF-8 text", output: "Framed bitstream", status: "Described core link", assumption: "Valid text input.", limitation: "CRC detects errors but does not correct them." });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [localDemo, setLocalDemo] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    // Easy demo upload: drop a file at public/demo.mp4 and it appears here automatically.
    fetch("/demo.mp4", { method: "HEAD" })
      .then((res) => setLocalDemo(res.ok && (res.headers.get("content-type") ?? "").startsWith("video")))
      .catch(() => setLocalDemo(false));
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => event.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? stages.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + stages.length) % stages.length;
    const nextStage = stages[next];
    if (!nextStage) return;
    setSelected(nextStage);
    tabRefs.current[next]?.focus();
  };

  const simulatorAction = (size: "sm" | "lg") => activeSimulatorUrl ? (
    <Button variant={size === "sm" ? "outline" : "default"} size={size} asChild><a href={activeSimulatorUrl} target="_blank" rel="noopener noreferrer">Launch simulator <ArrowRight /></a></Button>
  ) : (
    <Button variant={size === "sm" ? "outline" : "default"} size={size} disabled className="opacity-50 cursor-not-allowed">Simulator deployment pending</Button>
  );

  return (
    <div className="site-shell">
      <header className="topbar">
        <a href="#top" className="brand" aria-label="WaveCore X home"><span className="brand-mark"><Waves /></span><span>WaveCore <b>X</b></span></a>
        <nav className="desktop-nav" aria-label="Primary navigation">{nav.map(([label, href]) => <a href={href} key={href}>{label}</a>)}<Link to="/blog">BLOG</Link></nav>
        <div className="top-actions">
          {simulatorAction("sm")}
          <Button variant="ghost" size="icon" className="menu-button" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</Button>
        </div>
        {mobileOpen && <nav className="mobile-nav" aria-label="Mobile navigation">{nav.map(([label, href]) => <a href={href} key={href} onClick={() => setMobileOpen(false)}>{label}<ChevronRight /></a>)}<Link to="/blog" onClick={() => setMobileOpen(false)}>Blog<ChevronRight /></Link></nav>}
      </header>

      <main id="top">
        <section className="hero section-dark">
          <div className="hero-grid" aria-hidden="true" />
          <SignalVisual />
          <div className="hero-copy">
            <Eyebrow>Complex-baseband software simulator</Eyebrow>
            <h1>WaveCore <span>X</span></h1>
            <p className="hero-deck">A baseband wireless communications engineering simulator.</p>
            <p className="hero-body">Trace a message through coding, constellation mapping, OFDM, modeled channels, receiver equalization, and recovery—across the described end-to-end software subset.</p>
            <div className="hero-actions">
              {simulatorAction("lg")}
              <a href="#architecture">Explore Architecture <ArrowDown /></a>
              <a href="#validation">Read Engineering Audit <ArrowDown /></a>
            </div>
            <div className="hero-meta"><span><CircleDot /> SOFTWARE MODEL</span><span><CircleDot /> END-TO-END SUBSET</span><span><CircleDot /> DETERMINISTIC WITH SEED</span></div>
          </div>
        </section>

        <section className="signal-strip" aria-label="Core signal flow summary">
          {stages.map((stage, index) => <div key={stage.id}><span>{String(index + 1).padStart(2, "0")}</span><b>{stage.name}</b>{index < stages.length - 1 && <ArrowRight aria-hidden="true" />}</div>)}
        </section>

        <section id="signal-path" className="section-light path-section">
          <SectionHeading eyebrow="01 / Signal path" title="One message. The entire chain." body="The described core link connects framing to recovery. Each transformation is explicit; every boundary remains visible." />
          <div className="path-diagram">
            {stages.map((stage, index) => <div className="path-step" key={stage.id}><div className="path-index">{stage.short}</div><div><h3>{stage.name}</h3><p>{stage.input}</p></div>{index < stages.length - 1 && <ChevronRight />}</div>)}
          </div>
          <p className="figure-note"><span>FIG. 01</span> Explanatory pipeline diagram. It describes connected software stages, not timing or measured performance.</p>
        </section>

        <section id="capabilities" className="section-dark capabilities-section">
          <SectionHeading eyebrow="02 / Described core" title="Inside the core link." body="The supplied project description identifies these stages. This page does not independently verify the implementation or its results." />
          <div className="capability-grid">
            {capabilities.map(([title, body, Icon], index) => <article key={title} className="capability-row"><span className="cap-num">0{index + 1}</span><Icon /><div><h3>{title}</h3><p>{body}</p></div><Status>Described core link</Status></article>)}
          </div>
          <div className="boundary-band"><LockKeyhole /><div><h3>Scope boundary</h3><p>This is a mathematical complex-baseband simulation—not an RF transmitter or receiver. It has not been verified for LTE, 5G, or NR standards compliance.</p></div></div>
        </section>

        <section id="architecture" className="section-light architecture-section">
          <SectionHeading eyebrow="03 / Engineering architecture" title="A legible stack, end to end." body="The simulator separates interaction, typed request handling, simulation orchestration, signal processing, and result delivery." />
          <div className="architecture-stack">
            {[
              ["01", "INTERFACE", "React / Vite UI", "Configuration + visualization", Code2],
              ["02", "CONTRACT", "FastAPI routes & schemas", "Validated request / response", Braces],
              ["03", "ORCHESTRATION", "Simulation engine", "End-to-end pipeline", Cpu],
              ["04", "COMPUTE", "DSP · channel · analytics", "Numerical processing", Activity],
              ["05", "RESPONSE", "Metrics + recovered data", "Structured simulation result", TerminalSquare],
            ].map(([num, kicker, title, body, Icon], index) => {
              const StackIcon = Icon as typeof Code2;
              return <div className="stack-row" key={String(kicker)}><span>{num as string}</span><StackIcon /><small>{kicker as string}</small><h3>{title as string}</h3><p>{body as string}</p>{index < 4 && <ArrowDown className="stack-arrow" />}</div>;
            })}
          </div>
          <div className="architecture-notes"><p><Database /> Database workflows are not implied by this architecture.</p><p><GitBranch /> Advanced modules may exist independently without being connected to the main pipeline.</p></div>
        </section>

        <section className="technical-pair section-dark">
          <article>
            <Eyebrow>04 / Modulation + OFDM</Eyebrow>
            <h2>From bits to orthogonal carriers.</h2>
            <div className="constellation" aria-label="Illustrative constellation plot">
              <span className="plot-tag">ILLUSTRATIVE / 16-QAM</span>
              <div className="plot-axis plot-x" /><div className="plot-axis plot-y" />
              {Array.from({ length: 16 }).map((_, i) => <i key={i} style={{ left: `${20 + (i % 4) * 20}%`, top: `${20 + Math.floor(i / 4) * 20}%` }} />)}
              <span className="axis-i">I</span><span className="axis-q">Q</span>
            </div>
            <p>Normalized BPSK, QPSK, 16-QAM, 64-QAM, and 256-QAM mapping feeds basic pilot-bearing OFDM with IFFT/FFT and cyclic prefix handling.</p>
          </article>
          <article>
            <Eyebrow>05 / Channel + receiver</Eyebrow>
            <h2>Controlled impairment. Explicit recovery.</h2>
            <div className="channel-list">
              <div><Waves /><span><b>AWGN</b><small>Additive white Gaussian noise</small></span></div>
              <div><Radio /><span><b>Rayleigh / Rician</b><small>Flat block fading assumptions</small></span></div>
              <div><CircleDot /><span><b>Pilot estimation</b><small>ZF and MMSE equalization</small></span></div>
            </div>
            <p>Advanced multipath and synchronization correction are not established as part of the integrated end-to-end link.</p>
          </article>
        </section>

        <section className="section-light metrics-section">
          <SectionHeading eyebrow="06 / Metrics + reproducibility" title="Measurements, with definitions attached." body="Metrics are calculated from simulation output. They describe a finite software run—not RF hardware or network service." />
          <div className="metrics-grid">
            {[
              ["BER", "Bit error rate", "Incorrect recovered bits divided by compared bits."],
              ["SER", "Symbol error rate", "Incorrect detected symbols divided by compared symbols."],
              ["EVM", "Error vector magnitude", "Difference between received and reference constellation points."],
              ["Rₘ", "Modeled waveform throughput", "A model-derived waveform rate—not network or hardware throughput."],
              ["tₛ", "Software runtime", "Wall-clock execution time for the configured simulation."],
            ].map(([mark, title, body]) => <article key={mark}><strong>{mark}</strong><h3>{title}</h3><p>{body}</p></article>)}
          </div>
          <div className="repro-callout"><RotateCcw /><div><h3>Reproducible, not absolute</h3><p>A supplied random seed makes channel runs deterministic. Finite samples still limit how confidently a single result represents long-run behavior.</p></div></div>
        </section>

        <section className="explorer-section section-dark">
          <SectionHeading eyebrow="07 / Interactive architecture explorer" title="Inspect every transformation." body="Select a stage to see its role, contract, assumptions, and current limit." />
          <div className="explorer">
            <div className="explorer-tabs" role="tablist" aria-label="Signal processing stages">
              {stages.map((stage, index) => <Button variant="ghost" key={stage.id} id={`tab-${stage.id}`} ref={(node) => { tabRefs.current[index] = node; }} type="button" role="tab" aria-controls="stage-panel" aria-selected={selected.id === stage.id} tabIndex={selected.id === stage.id ? 0 : -1} onKeyDown={(event) => onTabKey(event, index)} onClick={() => setSelected(stage)}><span>{stage.short}</span>{stage.name}<ChevronRight /></Button>)}
            </div>
            <div id="stage-panel" className="explorer-panel" role="tabpanel" aria-labelledby={`tab-${selected.id}`}>
              <div className="panel-top"><span>{selected.short} / STAGE</span><Status>{selected.status}</Status></div>
              <h3>{selected.name}</h3><p className="panel-purpose">{selected.purpose}</p>
              <div className="io-flow"><div><small>INPUT</small><b>{selected.input}</b></div><ArrowRight /><div><small>OUTPUT</small><b>{selected.output}</b></div></div>
              <dl><div><dt>Assumption</dt><dd>{selected.assumption}</dd></div><div><dt>Known limit</dt><dd>{selected.limitation}</dd></div></dl>
            </div>
          </div>
        </section>

        <section className="section-light media-section">
          <SectionHeading eyebrow="08 / Demo + project gallery" title="See the project as it exists." body="Only owner-supplied project media belongs here. No mock screenshots, synthetic dashboards, or implied measurements." />
          <div className="media-grid">
            {localDemo ? (
              <article className="media-shot media-video"><div><Box /><span>VIDEO / SUPPLIED</span></div><video src="/demo.mp4" controls preload="metadata" playsInline /><h3>Project walkthrough</h3><p>Owner-supplied demo recording of the WaveCore X simulator.</p></article>
            ) : (
              <article className="media-empty"><div><Box /><span>{demoUrl ? "VIDEO / CONFIGURED" : "VIDEO / NOT SUPPLIED"}</span></div><h3>{demoUrl ? "Project walkthrough" : "Demo video not supplied"}</h3><p>{demoUrl ? "Open the supplied project walkthrough." : "An owner-supplied walkthrough can be connected when available."}</p>{demoUrl && <a href={demoUrl} target="_blank" rel="noopener noreferrer">Watch supplied demo <ExternalLink /></a>}</article>
            )}
            <article className="media-shot"><div><Grid3X3 /><span>IMAGE / SUPPLIED</span></div><img src="/wavecore-simulator.png" alt="WaveCore X simulator interface showing the OFDM stage, waveform view and parameter inspector" loading="lazy" /><h3>Simulator interface</h3><p>Owner-supplied capture of the WaveCore X simulator: pipeline stages, waveform view and parameter inspector.</p></article>
          </div>
        </section>

        <section id="validation" className="validation-section section-dark">
          <SectionHeading eyebrow="09 / Validation + limitations" title="Where the evidence ends." body="Validation maturity is a ladder. The supplied site describes a software model; no independent test evidence or measured hardware results were supplied here." />
          <div className="validation-track">
            {[
              ["01", "Software simulation", "DESCRIBED SOFTWARE LEVEL", "current"],
              ["02", "Independent reference validation", "NOT ESTABLISHED", "next"],
              ["03", "Software / hardware-in-loop", "NOT DEMONSTRATED", "locked"],
              ["04", "SDR over-the-air", "NOT DEMONSTRATED", "locked"],
              ["05", "Standards certification", "NOT VERIFIED", "locked"],
            ].map(([num, title, status, state]) => <div className={cn("validation-step", `step-${state}`)} key={num}><span>{num}</span><div className="step-node">{state === "current" ? <Check /> : <LockKeyhole />}</div><h3>{title}</h3><small>{status}</small></div>)}
          </div>
          <div className="limitations-grid">
            <div><h3>Not claimed</h3><ul><li>LTE / 5G / NR standards compliance</li><li>Production certification</li><li>Guaranteed performance</li><li>Measured hardware results</li></ul></div>
            <div><h3>Not demonstrated</h3><ul><li>SDR operation</li><li>Hardware-in-the-loop</li><li>Over-the-air testing</li><li>Advanced integrated multipath</li></ul></div>
          </div>
        </section>

        <section className="section-light docs-section">
          <SectionHeading eyebrow="10 / Documentation" title="Read the engineering record." body="These links navigate to the corresponding technical sections on this public product page. External project documents can replace them when supplied." />
          <div className="doc-list">
            <a href="#signal-path"><FileText /><span><b>Signal chain overview</b><small>Described message-to-recovery path</small></span><ArrowRight /></a>
            <a href="#architecture"><Braces /><span><b>Architecture documentation</b><small>Interface, API, engine, and DSP layers</small></span><ArrowRight /></a>
            <a href="#validation"><TestTube2 /><span><b>Engineering integrity audit</b><small>Validation boundary and limitations</small></span><ArrowRight /></a>
            {githubUrl ? <a href={githubUrl} target="_blank" rel="noopener noreferrer"><Github /><span><b>Source repository</b><small>Configured project repository</small></span><ExternalLink /></a> : <div className="doc-unavailable"><Github /><span><b>Repository unavailable</b><small>No project repository link has been supplied</small></span><LockKeyhole /></div>}
          </div>
        </section>

        <section className="roadmap-section section-dark">
          <SectionHeading eyebrow="11 / Roadmap" title="Status, without ambiguity." />
          <div className="roadmap-grid">
            <article><Status>Described core</Status><ul><li>Message-to-recovery link</li><li>Five modulation families</li><li>Basic pilot-bearing OFDM</li><li>AWGN and flat fading</li><li>ZF / MMSE equalization</li><li>Seeded channel runs</li></ul></article>
            <article><Status variant="standalone">Standalone / not integrated</Status><ul><li>Advanced coding modules</li><li>Advanced multipath modules</li><li>Synchronization modules</li><li>Resource-grid modules</li><li>OFDMA modules</li></ul></article>
            <article><Status variant="planned">Future evaluation</Status><ul><li>Deeper reference validation</li><li>Integrated advanced modules</li><li>Owner-supplied media</li><li>Hardware-in-loop evaluation</li><li>SDR / over-the-air evaluation</li></ul></article>
          </div>
        </section>

        <section className="blog-home-preview section-dark" aria-labelledby="blog-preview-title">
          <div className="blog-home-inner">
            <div className="blog-home-copy"><Eyebrow>12 / ENGINEERING BLOG</Eyebrow><h2 id="blog-preview-title">From Bits<br /><em>to Recovery.</em></h2><p>A three-part engineering series following the signal from transmission through the channel to recovery.</p><Button asChild className="blog-home-cta"><Link to="/blog">EXPLORE BLOG <ArrowRight size={17} /></Link></Button></div>
            <div className="blog-home-series" aria-label="Blog series">{articles.map((article) => <ArticleLink key={article.slug} article={article}><span>{article.number} / {article.label}</span>{article.external ? <ArrowUpRight size={16} /> : <ArrowRight size={16} />}</ArticleLink>)}</div>
          </div>
        </section>

        <section className="closing section-dark">
          <Signal /><div><Eyebrow>{activeSimulatorUrl ? "Continue in the simulator" : "Explore the signal path"}</Eyebrow><h2>Investigate the link.</h2><p>{activeSimulatorUrl ? "Configure the chain, run the software model, and inspect the resulting receiver metrics." : "Explore the documented stages, assumptions, and limitations of the software model."}</p></div>{simulatorAction("lg")}
        </section>
      </main>

      <footer>
        <div className="footer-main"><a href="#top" className="brand"><span className="brand-mark"><Waves /></span><span>WaveCore <b>X</b></span></a><p>A complex-baseband wireless communications engineering simulator.</p><div className="footer-links"><a href="#signal-path">Signal path</a><a href="#architecture">Architecture</a><a href="#validation">Validation</a><Link to="/blog">Blog</Link>{githubUrl && <a href={githubUrl} target="_blank" rel="noopener noreferrer">Repository</a>}</div></div>
        <div className="footer-fine"><span>© 2026 WaveCore X</span><p>Software simulation only. Not an RF system. No standards compliance, certification, or hardware performance is claimed.</p><span><Gauge /> MODEL STATUS: CORE LINK</span></div>
      </footer>
    </div>
  );
}