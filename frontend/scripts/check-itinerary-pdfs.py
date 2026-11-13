"""Check actual Edge PDF files produced by test-itinerary-print.cjs (requires PyMuPDF)."""
import json
import os
from pathlib import Path
import pymupdf

root = Path(os.environ.get('PRINT_TEST_OUTPUT', str(Path(os.environ.get('TEMP', '/tmp')) / 'ano-tara-print-results')))
results = json.loads((root / 'results.json').read_text())
for result in results:
    name = f"{result['prefix']}-{result['mode']}"
    doc = pymupdf.open(root / (name + '.pdf'))
    assert len(doc) == result['layout']['pages'], (name, len(doc), result['layout']['pages'])
    for index, page in enumerate(doc):
        assert abs(page.rect.width - 595.28) < 1 and abs(page.rect.height - 841.89) < 1
        text = page.get_text()
        assert 'Back to planner' not in text and 'Save to archive' not in text
        assert len(text) > 50 and 'ANO TARA?' in text
        assert f'{index + 1} / {len(doc)}' in text
        for x0, y0, x1, y1, *_ in page.get_text('blocks'):
            assert x0 >= 23 and y0 >= 26 and x1 <= page.rect.width - 23 and y1 <= page.rect.height - 24, (name, index, (x0,y0,x1,y1))
    print(f'{name}: {len(doc)} A4 pages; page count, margins, footers and print isolation passed')
    if result['count'] == 2:
        doc[0].get_pixmap().save(root / (name + '-pdf-page1.png'))
