export function weatherCondition(item) {
  return item?.weather_forecast?.condition || item?.forecast?.condition ||
    item?.condition || item?.weather || item?.expected_weather ||
    item?.insights?.weather?.condition || "Weather category unavailable";
}

export function WeatherCategoryBadge({ item }) {
  return (
    <span className="inline-block rounded border border-slate-700 bg-white px-2 py-1 text-xs font-bold leading-snug text-slate-950">
      Weather category: {weatherCondition(item)}
    </span>
  );
}

export function HazardBanner({ item }) {
  const conditions = new Set();
  function collect(source, fallback) {
    if (!source) return;
    const condition = weatherCondition(source);
    const label = condition === "Weather category unavailable" ? fallback || condition : condition;
    if (source.hazard_flag === true || source.decision_tree_hazard === true ||
        source.weather_forecast?.decision_tree_hazard === true ||
        source.forecast?.decision_tree_hazard === true) {
      conditions.add(label);
    }
    (source.scheduled_activities || source.activities || []).forEach((activity) => collect(activity, label));
    (source.destination_forecasts || []).forEach((forecast) => collect(forecast, label));
  }
  collect(item);
  if (!conditions.size) return null;
  return (
    <div role="alert" className="my-3 break-inside-avoid border-l-8 border-red-950 bg-red-700 px-4 py-3 text-sm font-bold leading-relaxed text-white print:border-2 print:border-black print:bg-white print:text-black">
      {Array.from(conditions).map((condition) => (
        <p key={condition}>Class 0 Hazard Alert: {condition}. Safety protocols advised.</p>
      ))}
    </div>
  );
}
