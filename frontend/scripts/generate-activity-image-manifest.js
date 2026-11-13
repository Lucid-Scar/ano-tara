const fs = require("node:fs/promises");
const path = require("node:path");

const publicDirectory = path.join(__dirname, "..", "public");
const imageDirectory = path.join(publicDirectory, "activity pics");
const outputFile = path.join(__dirname, "..", "lib", "activityImageManifest.json");
const supportedImage = /\.(jpe?g|png|webp|avif)$/i;

function normalize(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolutePath));
    else if (entry.isFile() && supportedImage.test(entry.name)) files.push(absolutePath);
  }
  return files;
}

async function main() {
  const files = await walk(imageDirectory);
  const images = files.map((file) => {
    const relative = path.relative(publicDirectory, file).split(path.sep);
    const filename = path.basename(file);
    const stem = filename.replace(/\.[^.]+$/, "");
    return {
      url: `/${relative.map(encodeURIComponent).join("/")}`,
      filename,
      normalizedFilename: normalize(stem),
      normalizedTokens: normalize(stem).split(" "),
    };
  }).sort((a, b) => a.url.localeCompare(b.url, "en"));

  const byFilename = {};
  for (const image of images) {
    const key = normalize(image.filename.replace(/\.[^.]+$/, ""));
    (byFilename[key] ||= []).push(image.url);
  }
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify({ images, byFilename }, null, 2)}\n`);
  console.log(`Generated activity image manifest: ${images.length} images`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
