import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Creative Circle",
    short_name: "Creative Circle",
    description: "Creator workspace for teleprompter, video, review, and UGC tools.",
    start_url: "/creative-circle",
    scope: "/creative-circle/",
    display: "fullscreen",
    background_color: "#07090d",
    theme_color: "#07090d",
    orientation: "any",
  };
}
