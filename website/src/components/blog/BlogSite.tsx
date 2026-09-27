import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronRight, Menu, Waves, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { externalSourceLabel, safeExternalUrl } from "@/lib/external-url";

type ArticleSeed = {
  number: string;
  slug: string;
  path: string;
  label: string;
  category: string;
  title: string;
  description: string;
  visual: "transmitter" | "channel" | "receiver";
  url: string;
  publication: string;
};

/** Attaches the published destination, validated http(s), with the on-site page as fallback. */
function published<T extends ArticleSeed>(article: T) {
  const href = safeExternalUrl(article.url);
  return {
    ...article,
    href: href ?? article.path,
    external: Boolean(href),
    source: externalSourceLabel(article.url),
  };
}

export const articles = [
  published({
    number: "01",
    slug: "transmitter",
    path: "/blog/transmitter",
    label: "THE TRANSMITTER",
    category: "TRANSMIT CHAIN",
    title: "From Raw Bits to a Wireless Signal: Building a Software-Defined Physical Layer",
    description: "The beginning of the signal path: bits, mapping, and the transformation into a transmit waveform.",
    visual: "transmitter",
    publication: "MEDIUM",
    url: "https://medium.com/@ca4443700/from-raw-bits-to-a-wireless-signal-building-a-software-defined-physical-layer-a111965edcb3?sharedUserId=ca4443700",
  }),
  published({
    number: "02",
    slug: "channel",
    path: "/blog/channel",
    label: "THE CHANNEL",
    category: "CHANNEL MODELING",
    title: "When the Signal Meets Reality: Modeling OFDM, Multipath, Fading and Wireless Impairments",
    description: "A look at how channel models describe the disturbances between transmission and reception.",
    visual: "channel",
    publication: "MEDIUM",
    url: "https://medium.com/@ca4443700/when-the-signal-meets-reality-modeling-ofdm-multipath-fading-and-wireless-impairments-a94a29ba0648?sharedUserId=ca4443700",
  }),
  published({
    number: "03",
    slug: "receiver",
    path: "/blog/receiver",
    label: "THE RECEIVER",
    category: "RECEIVE CHAIN",
    title: "Recovering Data from a Distorted Signal: Synchronization, Channel Estimation and Equalization",
    description: "The recovery side of the chain: the concepts behind interpreting an impaired signal.",
    visual: "receiver",
    publication: "MEDIUM",
    url: "https://medium.com/@ca4443700/the-receiver-is-the-real-test-demodulation-equalization-and-synchronization-in-ofdm-2ec24e8b12fd?sharedUserId=ca4443700",
  }),
] as const;

export type Article = (typeof articles)[number];

export function BlogHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="topbar blog-topbar">
      <Link to="/" className="brand" aria-label="WaveCore X home"><span className="brand-mark"><Waves /></span><span>WaveCore <b>X</b></span></Link>
      <nav className="desktop-nav" aria-label="Primary navigation">
        <Link to="/">PRODUCT</Link>
        <Link to="/blog" className="blog-nav-current">BLOG</Link>
      </nav>
      <div className="top-actions"><Button variant="outline" size="sm" asChild><Link to="/">Back to product <ArrowRight /></Link></Button><Button variant="ghost" size="icon" className="menu-button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button></div>
      {open && <nav className="mobile-nav" aria-label="Mobile navigation"><Link to="/" onClick={() => setOpen(false)}>Product <ChevronRight /></Link><Link to="/blog" onClick={() => setOpen(false)}>Blog <ChevronRight /></Link></nav>}
    </header>
  );
}

export function BlogFooter() {
  return <footer className="blog-footer"><div className="blog-footer-inner"><Link to="/" className="brand"><span className="brand-mark"><Waves /></span><span>WaveCore <b>X</b></span></Link><span>SOFTWARE SIMULATION / ENGINEERING NOTES</span><Link to="/blog">All articles <ArrowRight size={14} /></Link></div></footer>;
}

export function BlogEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow"><span aria-hidden="true" />{children}</p>;
}

/** An explanatory diagram, never a plot of measured or simulated results. */
export function ArticleVisual({ kind, id }: { kind: Article["visual"]; id: string }) {
  return <div className={`blog-visual blog-visual-${kind}`} aria-label={`Schematic signal-processing diagram for ${kind}`} role="img">
    <div className="blog-visual-top"><span>WAVECORE X / FIELD NOTES</span><span>SCHEMATIC · NOT MEASURED</span></div>
    <svg viewBox="0 0 600 250" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id={`bg-${id}`} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" className="blog-grid-line" /></pattern>
        <linearGradient id={`line-${id}`} x1="0" x2="1"><stop offset="0" className="stop-cyan"/><stop offset="1" className="stop-amber"/></linearGradient>
      </defs>
      <rect width="600" height="250" fill={`url(#bg-${id})`} />
      <line x1="32" y1="125" x2="568" y2="125" className="blog-axis" />
      {kind === "transmitter" && <>
        <path className="blog-trace" d="M32 162 H61 V89 H78 V162 H95 V89 H112 V162 H129 V89 H146 V162 H175 C186 162 186 95 199 95 S212 162 225 162 S239 95 252 95 S266 162 279 162 S293 95 306 95 S319 162 332 162 S346 95 359 95 S373 162 386 162 S400 95 413 95 S427 162 440 162 S454 95 467 95 S481 162 494 162 S508 95 521 95 S535 162 548 162" />
        <line x1="174" y1="44" x2="174" y2="206" className="blog-divider" /><text x="37" y="224" className="blog-svg-label">BITS</text><text x="201" y="224" className="blog-svg-label">SYMBOLS / WAVEFORM</text>
      </>}
      {kind === "channel" && <>
        <path className="blog-trace" d="M35 125 C52 50 67 198 84 125 S117 50 134 125 S168 198 184 125 S218 50 234 125 S268 198 284 125 S318 50 334 125 S368 198 384 125 S418 50 434 125 S468 198 484 125 S518 50 534 125 S552 180 565 125" />
        <path className="blog-echo" d="M48 125 C65 87 80 164 97 125 S130 87 147 125 S181 164 197 125 S231 87 247 125 S281 164 297 125 S331 87 347 125 S381 164 397 125 S431 87 447 125 S481 164 497 125 S531 87 547 125" />
        <text x="38" y="224" className="blog-svg-label">DIRECT PATH</text><text x="391" y="224" className="blog-svg-label">DELAYED PATH</text>
      </>}
      {kind === "receiver" && <>
        <path className="blog-trace" d="M36 125 C46 90 52 172 63 125 S79 73 91 125 S104 176 117 125 S132 76 145 125 S158 170 171 125 S185 73 198 125 S211 169 224 125" />
        <line x1="266" y1="42" x2="266" y2="208" className="blog-divider" />
        <path className="blog-trace blog-trace-clean" d="M306 125 C322 69 338 181 354 125 S386 69 402 125 S434 181 450 125 S482 69 498 125 S530 181 546 125" />
        <text x="37" y="224" className="blog-svg-label">IMPAIRED INPUT</text><text x="330" y="224" className="blog-svg-label">RECOVERED SYMBOLS</text>
      </>}
    </svg>
    <div className="blog-visual-bottom"><span>TX</span><span>CHANNEL</span><span>RX</span></div>
  </div>;
}

/** The article destination: the published piece when one exists, otherwise the on-site page. */
export function ArticleLink({ article, children, className }: { article: Article; children: React.ReactNode; className?: string }) {
  return article.external
    ? <a href={article.href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
    : <Link to={article.path} className={className}>{children}</Link>;
}

export function ArticleCard({ article }: { article: Article }) {
  return <article className="blog-card">
    <ArticleVisual kind={article.visual} id={`card-${article.slug}`} />
    <div className="blog-card-content">
      <div className="blog-card-meta"><span>{article.number} / {article.label}</span><span>{article.category}</span></div>
      <h2><ArticleLink article={article}>{article.title}</ArticleLink></h2>
      <p>{article.description}</p>
      <Button asChild variant="ghost" className="blog-read-link"><ArticleLink article={article}>READ ARTICLE {article.external ? <ArrowUpRight size={16} /> : <ArrowRight size={16} />}</ArticleLink></Button>
    </div>
  </article>;
}

/** Series hand-off page: the writing itself lives at the published destination. */
export function ArticlePage({ article }: { article: Article }) {
  const index = articles.findIndex((item) => item.slug === article.slug);
  const previous = articles[index - 1];
  const next = articles[index + 1];
  return <div className="site-shell blog-site"><BlogHeader /><main className="blog-article-main">
    <div className="blog-article-inner">
      <Link to="/blog" className="blog-back"><ArrowLeft size={15} /> ALL ARTICLES</Link>
      <div className="blog-article-heading"><BlogEyebrow>{article.number} / {article.label} · {article.category}</BlogEyebrow><h1>{article.title}</h1><p>{article.description}</p></div>
      <ArticleVisual kind={article.visual} id={`page-${article.slug}`} />
      <div className="blog-article-published">
        <span>{article.external ? `PUBLISHED / ${article.publication}` : "EDITORIAL STATUS / FORTHCOMING"}</span>
        <h2>{article.external ? "The full article is published." : "Article in preparation."}</h2>
        <p>{article.external
          ? "This piece is published in the author’s own collection. Read it there — this page keeps the three-part series in order."
          : "The full technical article has not been supplied yet. This page is reserved for the author’s original engineering notes."}</p>
        {article.external && <>
          <Button asChild className="blog-article-cta"><a href={article.href} target="_blank" rel="noopener noreferrer">READ ON {article.publication} <ArrowUpRight size={16} /></a></Button>
          {article.source && <a className="blog-article-source" href={article.href} target="_blank" rel="noopener noreferrer"><span>{article.source}</span><ArrowUpRight size={13} /></a>}
        </>}
      </div>
      <nav className="blog-article-nav" aria-label="Article series navigation">
        {previous ? <ArticleLink article={previous}><span><ArrowLeft size={14} /> PREVIOUS IN SERIES{previous.external && <ArrowUpRight size={12} />}</span><strong>{previous.label}</strong></ArticleLink> : <Link to="/blog"><span><ArrowLeft size={14} /> BACK TO</span><strong>ALL ARTICLES</strong></Link>}
        {next ? <ArticleLink article={next}><span>NEXT IN SERIES {next.external ? <ArrowUpRight size={12} /> : <ArrowRight size={14} />}</span><strong>{next.label}</strong></ArticleLink> : <Link to="/blog"><span>BACK TO SERIES <ArrowRight size={14} /></span><strong>ALL ARTICLES</strong></Link>}
      </nav>
    </div>
  </main><BlogFooter /></div>;
}
