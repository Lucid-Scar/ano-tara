# Final itinerary brochure implementation and validation

Implemented for `/final-planner` on 2026-11-13. No project dependencies were added. No commit or push was performed.

## Files

Modified:
- `app/final-planner/FinalPlanner.page.js`: replaced the duplicated document templates and embedded site header with the brochure component; retained archive callbacks and the assigned-day drag fix. Kept derived total prices in `brochurePrice` so they are not interpreted again as per-person prices.
- `app/globals.css`: A4 dimensions, compact document styles, page viewer, isolated print styles and numbered map markers.
- `components/ItineraryMap.jsx`: numbered markers, route-inclusive bounds, resize handling and print readiness.

Created:
- `components/ItineraryBrochure.jsx`: document blocks, measured pagination, page navigation, print preparation and portal.
- `lib/mapGeometry.js`: coordinate validation and supported route geometry extraction.
- `scripts/test-itinerary-print.cjs`: Edge browser fixtures and PDF export checks.
- `scripts/check-itinerary-pdfs.py`: checks the actual exported PDFs using PyMuPDF.
- `scripts/itinerary-print-report.md`: this report.

## Layout and pagination

Overview contains the compact branded trip summary, full-trip map and numbered legend, activities grouped by their assigned day, price summary, weather and garments, then travel notes. Detailed contains day/date, weather warnings, activities and descriptions, day costs, outfits/advice, and a day map. A trip budget summary follows without repeating the accommodation estimate for every day.

The document preserves the backend's scheduled order and supplied routes. It does not change travel planning results. Unknown prices remain unknown. Known activity totals and the MLR accommodation estimate are shown separately to avoid counting accommodation twice. Backend destination estimates remain available as separate estimates.

An offscreen copy measures content at the actual 192 mm printable width after fonts are ready. Images have reserved dimensions; a ResizeObserver responds to layout changes. Whole activity cards, garment rows, weather boxes and budget summaries are placed into a 265 mm content budget. Headings are measured with the following block. Long descriptions are divided into smaller text blocks, and garments and map legends into bounded rows. Page headers show the current day with a continuation label when applicable. There is no fixed-height content clipping.

Screen pages use A4 proportions and scale together. Desktop shows two pages, very wide screens three, and mobile one, with previous/next navigation. The rendered page groups also supply the printed pages; CSS returns them to full-size single-column pages with 10 mm vertical and 9 mm horizontal print margins.

The measurement observer ignores the hidden measurement area during printing. This prevents print-media changes from recomputing pagination using zero-height measurements.

## Maps and printing

Coordinates reject nulls, blank values, nonfinite numbers and values outside geographic ranges. Bounds include all valid stops and supported road geometry. A ResizeObserver invalidates Leaflet size and refits bounds, with padding and maximum zoom 13. Numbered markers correspond to activity/legend numbers, including gaps where an activity lacks coordinates.

Successful backend LineString/MultiLineString geometry is reused. No additional routing requests are made. Failed or unavailable routes remain unconnected with an explanation; no straight-line route is presented as a driving route and no unsupported water crossing is drawn. Nearby or identical locations can overlap at an all-trip zoom; the numbered legend and interactive zoom remain available.

The brochure is portaled directly into the body. Print CSS hides its sibling application roots and every brochure control, so only the selected document is exported. The print button waits for fonts, images, mounted maps and map tiles, and shows an error when map preparation fails or times out. Attribution remains visible. Use this button to prepare assets before printing; a browser keyboard print shortcut cannot await asynchronous assets in the same way.

## Validation results

`npm run build` in `frontend`: **passed**, including production compilation and generation of all nine routes.

Actual PDF exports ran in installed Microsoft Edge using Playwright against the production build on port 3100. Live OpenStreetMap tiles loaded successfully. Routing geometry was supplied by fixtures, matching the backend response structure; these tests did not call the live itinerary/routing backend.

| Fixture | Overview pages | Detailed pages |
| --- | ---: | ---: |
| 1 day, 2 activities, long name, 5 garments | 2 | 2 |
| 2 days, 10 activities, 10 garments | 3 | 5 |
| 5 days, 45 activities, 25 garments, very long descriptions | 9 | 18 |
| 1 day, single valid marker, no garments | 2 | 2 |
| 1 day, no valid coordinates, no garments | 1 | 2 |

All ten exports passed:
- No browser application errors.
- Print preparation completed with loaded maps.
- No activity/content block overlapped a page footer.
- No rendered marker extended outside its map viewport.
- No application UI or document controls appeared in print.
- Desktop displayed two pages where available; mobile displayed one.
- Actual PDF page counts matched the measured preview.
- Every PDF page was A4 with text inside the expected margins and its numbered footer present.
- No empty PDF pages.

Fixtures include valid and missing activity images, unlisted and free/priced activities, missing coordinates, several assigned garments, Manila/Cebu markers, route geometry extending beyond stop coordinates, and failed route segments. Rendered PDF pages were also visually inspected for both modes.

Artifacts are in `%TEMP%\ano-tara-print-results` (`*.pdf`, preview screenshots, rendered PDF samples and `results.json`). Test tooling was installed only in temporary directories, outside project dependencies.

To repeat with Playwright and PyMuPDF available:

```powershell
# Start the production frontend on port 3100 in a separate terminal.
$env:PLAYWRIGHT_PATH = "$env:TEMP\ano-tara-print-tools\node_modules\playwright"
node frontend/scripts/test-itinerary-print.cjs
$env:PYTHONPATH = "$env:TEMP\ano-tara-pdf-tools"
python frontend/scripts/check-itinerary-pdfs.py
```

## Remaining manual checks

- The OS print dialog and a physical printer were not automated. Use 100% scaling and disable browser “Headers and footers”; CSS cannot reliably control those browser-generated URL/time headers.
- Network interruption during tile loading should be checked manually; automated cases used successful live tile loads.
- Live backend generation and physical-printer color/driver behavior were not exercised by these document tests. Existing state, backend requests and archive implementation remain in place.
