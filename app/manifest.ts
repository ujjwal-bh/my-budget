import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pocketwise — Personal finance, made clear",
    short_name: "Pocketwise",
    description: "Track spending, plan budgets, and make progress toward your financial goals.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fc",
    theme_color: "#625cf4",
    orientation: "portrait",
    icons: [
      {
        src: "/pocketwise-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
