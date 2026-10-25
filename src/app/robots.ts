import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/studio", "/feed", "/messages", "/subscriptions", "/settings", "/become-creator", "/account", "/post/", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
