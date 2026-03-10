import sys
import json
import fitz


def extract(pdf_path, out_path):
    doc = fitz.open(pdf_path)
    pages = []
    for page in doc:
        pages.append({"page": page.number + 1, "text": page.get_text()})
    doc.close()

    with open(out_path, "w") as f:
        json.dump({"pages": pages, "page_count": len(pages)}, f)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: parse.py <input.pdf> <output.json>", file=sys.stderr)
        sys.exit(1)
    extract(sys.argv[1], sys.argv[2])
