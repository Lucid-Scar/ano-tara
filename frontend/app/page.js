import manifest from "../lib/activityImageManifest.json";
import Home from "./Home.page";

export default function Page() {
  const activitySlides = manifest.images.map((image) => ({
    src: image.url,
    title: image.filename.replace(/\.[^.]+$/, "").replace(/_/g, " "),
  }));
  return <Home activitySlides={activitySlides} />;
}
