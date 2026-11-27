"""Verify the attached P4 ZIP without writing its artwork into the repository."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("archive", type=Path)
args = parser.parse_args()
contract = Path(__file__).resolve().parents[2] / "experiments/artistic-slice/art/references.json"
expected = json.loads(contract.read_text(encoding="utf-8"))
with zipfile.ZipFile(args.archive) as archive:
    prefix = "Watteau-Horizon-P4/"
    if json.loads(archive.read(prefix + "manifest.json")) != expected:
        raise ValueError("Le manifeste du ZIP diffère du manifeste P4 audité.")
    for entry in expected:
        data = archive.read(prefix + entry["path"])
        if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
            raise ValueError(f"En-tête PNG invalide : {entry['path']}")
        observed = hashlib.sha256(data).hexdigest()
        dimensions = list(struct.unpack_from(">II", data, 16))
        if observed != entry["sha256"] or dimensions != entry["dimensions"]:
            raise ValueError(f"Empreinte ou dimensions inattendues : {entry['path']}")
        print(f"PASS {entry['path']} {dimensions[0]} × {dimensions[1]} {observed}")
