import manifest from "./activityImageManifest.json";

export const DESTINATION_PLACEHOLDER = "/destination-placeholder.svg";

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

const aliases = {
  "hilton manila newport world resorts pasay city": "hilton manila newport world resorts",
  "balaoi visitor attraction fee pagudpud": "balaoi visitorattraction fee pagudpud",
  "basilica minore del santo nino cebu city": "basilica minore del santo nio cebu city",
  "bohol chocolate hills tarsier and river cruise experience from tagbilaran": "bohol chocolate hills tarsier river cruise experience from tagbilaran",
  "bohol sikatuna mirror and chocolate hills full day tour with loboc river cruise from tagbilaran": "bohol sikatuna mirror chocolate hills full day tour with loboc river cruise from tagbilaran",
  "cebu private bohol full day tour with tickets and river cruise from cebu city": "cebu private bohol full day tour with tickets river cruise from cebu city",
  "el nido tour b caves and islands el nido": "el nido tour b caves islands el nido",
  "el nido tour d lagoons and beaches el nido": "el nido tour d lagoons beaches el nido",
  "malacanang of the north and chinese garden paoay": "malacaang of the north chinese garden paoay",
  "museo bacarra and bacarra heritage trail bacarra": "museo bacarra bacarra heritage trail bacarra",
  "oslob whale shark snorkeling with sardines and turtles tour in cebu from cebu city": "oslob whale shark snorkeling with sardines turtles tour in cebu from cebu city",
  "oslob whaleshark and badian canyoneering tour packages from cebu city": "oslob whaleshark badian canyoneering tour packages from cebu city",
  "panglao virgin and balicasag islands half day snorkeling tour panglao": "panglao virgin balicasag islands half day snorkeling tour panglao",
  "private cebu and mactan twin city tour cebu city lapu lapu city": "private cebu mactan twin city tour cebu city lapu lapu city",
  "sentrong pangkultura ng binan plaza rizal binan city": "sentrong pangkultura ng bian plaza rizal bian city",
  "umok ni siwawer vintar adventure zipline bikeline vintar": "umok ni siwawer vintar adventure ziplinebikeline vintar",
};

function scoreMatch(queryTokens, candidateTokens) {
  const query = new Set(queryTokens);
  const candidate = new Set(candidateTokens);
  const overlap = [...query].filter((token) => candidate.has(token)).length;
  if (!overlap) return 0;
  const precision = overlap / candidate.size;
  const recall = overlap / query.size;
  return (2 * precision * recall) / (precision + recall);
}

export function resolveActivityImage(activity, destination) {
  const activityName = typeof activity === "string" ? activity : (activity?.name || activity?.activityName || "");
  const destinationName = typeof destination === "string" ? destination : (destination?.name || destination?.destination || "");
  const activityKey = normalize(activityName);
  const fullKey = normalize(`${activityName} ${destinationName}`);
  const candidates = [...new Set([aliases[fullKey], aliases[activityKey], fullKey, activityKey, normalize(destinationName)].filter(Boolean))];

  for (const key of candidates) {
    const exact = manifest.byFilename[key];
    if (exact?.length) return exact[0];
  }

  let best = null;
  for (const key of candidates) {
    const tokens = key.split(" ").filter((token) => token.length > 1);
    if (!tokens.length) continue;
    for (const image of manifest.images) {
      const score = scoreMatch(tokens, image.normalizedTokens.filter((token) => token.length > 1));
      if (!best || score > best.score || (score === best.score && image.url < best.image.url)) best = { score, image };
    }
    if (best?.score >= 0.84) break;
  }
  return best && best.score >= 0.84 ? best.image.url : DESTINATION_PLACEHOLDER;
}

export function getActivityImagePath(activity, destination) {
  return resolveActivityImage(activity, destination);
}
