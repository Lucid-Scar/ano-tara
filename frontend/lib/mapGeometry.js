export function validCoordinate(lat, lng) {
  return lat !== null && lat !== undefined && lng !== null && lng !== undefined
    && String(lat).trim() !== "" && String(lng).trim() !== ""
    && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}

export function routeLines(segments = []) {
  return segments.flatMap((segment) => {
    if (segment.routing?.status !== "success") return [];
    const geometry = segment.routing.geometry?.type === "Feature"
      ? segment.routing.geometry.geometry : segment.routing.geometry;
    const lines = geometry?.type === "LineString" ? [geometry.coordinates]
      : geometry?.type === "MultiLineString" ? geometry.coordinates : [];
    return lines.filter((line) => Array.isArray(line) && line.length > 1
      && line.every((point) => Array.isArray(point) && validCoordinate(point[1], point[0])))
      .map((line) => line.map(([lng, lat]) => [Number(lat), Number(lng)]));
  });
}
