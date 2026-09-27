import { createFileRoute } from "@tanstack/react-router";
import { ArticlePage, articles } from "@/components/blog/BlogSite";

const article = articles[2];
export const Route = createFileRoute("/blog/receiver")({
  head: () => ({ meta: [
    { title: `${article.title} — WaveCore X` },
    { name: "description", content: `${article.description} Published by the author on Medium.` },
    { property: "og:title", content: `${article.title} — WaveCore X` },
    { property: "og:description", content: `${article.description} Published by the author on Medium.` },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary_large_image" },
  ], links: [{ rel: "canonical", href: article.href }] }),
  component: () => <ArticlePage article={article} />,
});
