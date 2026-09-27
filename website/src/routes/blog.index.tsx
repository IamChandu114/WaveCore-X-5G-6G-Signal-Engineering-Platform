import { createFileRoute } from "@tanstack/react-router";
import { ArticleCard, articles, BlogEyebrow, BlogFooter, BlogHeader } from "@/components/blog/BlogSite";

export const Route = createFileRoute("/blog/")({
  head: () => ({ meta: [
    { title: "Engineering Blog — WaveCore X" },
    { name: "description", content: "A three-part WaveCore X engineering series following the signal path from transmitter through channel to receiver." },
    { property: "og:title", content: "Engineering Blog — WaveCore X" },
    { property: "og:description", content: "From bits to recovery: explore the transmitter, channel, and receiver in a connected wireless engineering series." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: BlogIndex,
});

function BlogIndex() {
  return <div className="site-shell blog-site"><BlogHeader /><main>
    <section className="blog-index-intro"><div className="blog-index-intro-inner">
      <div className="blog-intro-meta"><span>WAVECORE X / ENGINEERING JOURNAL</span><span>THREE PARTS · ONE SIGNAL PATH</span></div>
      <BlogEyebrow>ENGINEERING BLOG</BlogEyebrow>
      <h1>From Bits<br /><em>to Recovery.</em></h1>
      <p>Follow a wireless signal through its three defining stages: construction, propagation, and recovery. A connected series of technical articles.</p>
      <div className="blog-series-line" aria-label="Series: transmitter, channel, receiver"><span>01 / TRANSMITTER</span><i /><span>02 / CHANNEL</span><i /><span>03 / RECEIVER</span></div>
    </div></section>
    <section className="blog-index-list" aria-label="Articles in this series"><div className="blog-list-inner"><div className="blog-list-heading"><span>THE SERIES / 001—003</span><span>SCHEMATICS ARE EXPLANATORY, NOT MEASURED DATA</span></div><div className="blog-cards">{articles.map((article) => <ArticleCard key={article.slug} article={article} />)}</div></div></section>
  </main><BlogFooter /></div>;
}