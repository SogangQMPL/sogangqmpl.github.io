"""Merge verified publication figures into the lab's content file.

Run with Python 3 from any directory. No third-party packages or network calls
are needed. The root manifest is read last, so it can replace a preliminary
supporting figure with a preferred visual abstract or main-paper schematic.
Only publication image fields and explicitly verified DOI/URL fields change.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content/site.json"
AUDIT = ROOT / "docs/논문그림-출처.json"
MANIFESTS = [
    ROOT / "docs/publication-figures-recent.json",
    ROOT / "docs/publication-figures-middle.json",
    ROOT / "docs/publication-figures-early.json",
    ROOT / "docs/publication-figures-root.json",
]
IMAGE_FIELDS = ("image", "imageAlt", "imageLabel", "imageSource")


def load_json(file):
    return json.loads(file.read_text(encoding="utf-8-sig"))


def verified_doi(record):
    """Only an explicitly verified DOI may correct existing bibliographic data."""
    value = record.get("verifiedDOI")
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise ValueError(f"{record['id']}: verifiedDOI must be a DOI string")
    value = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", value.strip(), flags=re.I)
    value = re.sub(r"^doi:\s*", "", value, flags=re.I)
    if not re.fullmatch(r"10\.\d{4,9}/\S+", value):
        raise ValueError(f"{record['id']}: invalid verifiedDOI: {value!r}")
    return value


def image_updates(record):
    """Return validated image fields, or nothing for an unresolved record."""
    if not record.get("image"):
        return {}
    image = record["image"]
    if not isinstance(image, str) or not image.startswith("assets/"):
        raise ValueError(f"{record['id']}: image must be a local assets/ path")
    resolved = (ROOT / image).resolve()
    if not resolved.is_relative_to((ROOT / "assets").resolve()) or not resolved.is_file():
        raise ValueError(f"{record['id']}: image file missing or outside assets: {image}")
    updates = {}
    for key in IMAGE_FIELDS:
        if not isinstance(record.get(key), str) or not record[key].strip():
            raise ValueError(f"{record['id']}: {key} must be a non-empty string")
        updates[key] = record[key]
    if not re.fullmatch(r"https://\S+", updates["imageSource"]):
        raise ValueError(f"{record['id']}: imageSource must be an https URL")
    for source, target in (("width", "imageWidth"), ("height", "imageHeight")):
        value = record.get(source)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0 or int(value) != value:
            raise ValueError(f"{record['id']}: {source} must be a positive integer")
        updates[target] = int(value)
    if "imagePreview" in record:
        crop = record["imagePreview"]
        if not isinstance(crop, dict) or any(not isinstance(crop.get(key), (int, float)) for key in ("x", "y", "width", "height")):
            raise ValueError(f"{record['id']}: invalid image preview rectangle")
        if not (0 <= crop["x"] < 1 and 0 <= crop["y"] < 1 and 0 < crop["width"] <= 1 - crop["x"] and 0 < crop["height"] <= 1 - crop["y"]):
            raise ValueError(f"{record['id']}: image preview outside original figure")
        updates["imagePreview"] = crop
    return updates


def write_json(file, value):
    file.parent.mkdir(parents=True, exist_ok=True)
    temporary = file.with_name(file.name + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(file)


def main():
    data = load_json(CONTENT)
    publications = data.get("publications")
    if not isinstance(publications, list):
        raise ValueError("content/site.json: publications must be an array")
    ids = {publication["id"] for publication in publications}
    if len(ids) != len(publications):
        raise ValueError("content/site.json: duplicate publication IDs")

    merged = {}
    origins = {}
    manifests_read = []
    overridden = []
    for manifest in MANIFESTS:
        if not manifest.exists():
            continue
        records = load_json(manifest)
        if not isinstance(records, list):
            raise ValueError(f"{manifest.name}: expected an array of records")
        relative = manifest.relative_to(ROOT).as_posix()
        manifests_read.append(relative)
        for record in records:
            if not isinstance(record, dict) or record.get("id") not in ids:
                raise ValueError(f"{manifest.name}: unknown or missing publication ID: {record!r}")
            publication_id = record["id"]
            if publication_id in merged:
                overridden.append({"id": publication_id, "previous": origins[publication_id], "selected": relative})
            merged[publication_id] = record.copy()
            origins[publication_id] = relative

    audit_records = []
    missing = []
    corrected_dois = []
    for publication in publications:
        publication_id = publication["id"]
        record = merged.get(publication_id)
        if record:
            updates = image_updates(record)
            if "image" in updates and publication.get("image") != updates["image"] and "imagePreview" not in record:
                publication.pop("imagePreview", None)
            publication.update(updates)
            doi = verified_doi(record)
            if doi:
                if publication.get("doi") != doi or publication.get("url") != "https://doi.org/" + doi:
                    corrected_dois.append(publication_id)
                publication["doi"] = doi
                publication["url"] = "https://doi.org/" + doi
            audit_records.append({
                **record,
                "title": publication["title"],
                "doi": publication.get("doi", ""),
                "manifest": origins[publication_id],
            })
        if not publication.get("image"):
            missing.append(publication_id)

    audit = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceManifests": manifests_read,
        "precedence": "recent < middle < early < root; later records override earlier ones",
        "publicationCount": len(publications),
        "imageCount": len(publications) - len(missing),
        "missingIds": missing,
        "correctedDOIIds": corrected_dois,
        "overrides": overridden,
        "records": audit_records,
    }
    # Validation above finishes before either output is replaced.
    write_json(CONTENT, data)
    write_json(AUDIT, audit)
    print(f"Publication figures merged: {audit['imageCount']}/{len(publications)}")
    print("Missing images: " + (", ".join(missing) if missing else "none"))
    print("Verified DOI corrections: " + (", ".join(corrected_dois) if corrected_dois else "none"))
    print("Audit: " + str(AUDIT))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        print(f"Publication figure merge failed: {error}", file=sys.stderr)
        raise SystemExit(1)
