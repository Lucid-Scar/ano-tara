import { readdir } from "node:fs/promises";
import path from "node:path";
import Home from "./Home.page";

export default async function Page() {
  const files = await readdir(path.join(process.cwd(), "public", "activity pics"), { withFileTypes: true });
  const activitySlides = files
    .filter((file) => file.isFile() && /\.(jpe?g|png|webp|avif)$/i.test(file.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((file) => ({
      src: `/activity%20pics/${encodeURIComponent(file.name)}`,
      title: file.name.replace(/\.[^.]+$/, "").replace(/_/g, " "),
    }));

  return <Home activitySlides={activitySlides} />;
}
