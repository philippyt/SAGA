import pickle
import glob
from pathlib import Path
import numpy as np
from PIL import Image
from config import IMAGES_DIR, CLIP_INDEX_PATH, CLIP_MODEL, TOP_K_IMAGES

_model = None
_processor = None
_index = None

CLIP_SIM_MIN = 0.15
CLIP_SIM_MAX = 0.40
CLIP_THRESHOLD = 0.18

# CLIP zero-shot labeling
CLIP_CAPTIONS = [
    "external corrosion on pipeline surface",
    "internal corrosion damage",
    "marine growth and biofouling on structure",
    "coating damage and disbondment",
    "pipeline freespan over seabed",
    "anode depletion and cathodic protection",
    "crack or fracture in metal",
    "dent or mechanical damage on pipe",
    "subsea pipeline on seabed",
    "ROV inspection of underwater structure",
    "weld defect or anomaly",
    "scour and erosion around pipeline",
    "clean metal surface without defects",
    "rust and oxidation on steel",
    "underwater concrete structure damage",
    "valve or fitting inspection",
]

def _normalize_score(raw: float) -> int:
    clamped = max(CLIP_SIM_MIN, min(CLIP_SIM_MAX, raw))
    pct = (clamped - CLIP_SIM_MIN) / (CLIP_SIM_MAX - CLIP_SIM_MIN)
    return int(round(pct * 100))

def _load_clip():
    global _model, _processor
    if _model is None:
        from transformers import CLIPModel, CLIPProcessor
        print(f"loading model {CLIP_MODEL}")
        _model = CLIPModel.from_pretrained(CLIP_MODEL)
        _processor = CLIPProcessor.from_pretrained(CLIP_MODEL)
    return _model, _processor

def _caption_image(model, processor, img):
    try:
        inputs = processor(text=CLIP_CAPTIONS, images=img, return_tensors="pt", padding=True, truncation=True)
        outputs = model(**inputs)
        logits = outputs.logits_per_image.detach().numpy().flatten()
        best_idx = logits.argmax()
        return CLIP_CAPTIONS[best_idx]
    except:
        return "inspection image"

def build_clip_index():
    global _index
    model, processor = _load_clip()
    image_extensions = ["*.jpg", "*.jpeg", "*.png", "*.bmp", "*.webp"]
    image_paths = []
    for ext in image_extensions:
        image_paths.extend(glob.glob(str(Path(IMAGES_DIR) / "**" / ext), recursive=True))

    if not image_paths:
        _index = {"paths": [], "embeddings": np.array([]), "labels": [], "dimensions": []}
        return _index

    embeddings = []
    valid_paths = []
    labels = []
    dimensions = []
    for i, img_path in enumerate(image_paths):
        try:
            img = Image.open(img_path).convert("RGB")
            w, h = img.size
            inputs = processor(images=img, return_tensors="pt")
            outputs = model.get_image_features(**inputs)
            emb = outputs.detach().numpy().flatten()
            emb = emb / np.linalg.norm(emb)
            embeddings.append(emb)
            valid_paths.append(img_path)
            dimensions.append((w, h))
            caption = _caption_image(model, processor, img)
            labels.append(caption)

            if (i + 1) % 50 == 0:
                print(f"   {i + 1}/{len(image_paths)} images indexed")
        except Exception as e:
            print(f"   Error with {img_path}: {e}")

    _index = {
        "paths": valid_paths,
        "embeddings": np.array(embeddings) if embeddings else np.array([]),
        "labels": labels,
        "dimensions": dimensions,
    }

    with open(CLIP_INDEX_PATH, "wb") as f:
        pickle.dump(_index, f)

    print(f"{len(valid_paths)} images")
    return _index

def load_clip_index():
    global _index
    if _index is not None:
        return _index
    if Path(CLIP_INDEX_PATH).exists():
        with open(CLIP_INDEX_PATH, "rb") as f:
            _index = pickle.load(f)
        if "dimensions" not in _index:
            _index["dimensions"] = [(0, 0)] * len(_index["paths"])
        print(f"{len(_index['paths'])} images")
        return _index

    return build_clip_index()

def search_images(query: str, k: int = None) -> list[dict]:
    k = k or TOP_K_IMAGES
    index = load_clip_index()

    if len(index["paths"]) == 0:
        return []

    model, processor = _load_clip()
    inputs = processor(text=[query], return_tensors="pt", padding=True, truncation=True)
    text_emb = model.get_text_features(**inputs).detach().numpy().flatten()
    text_emb = text_emb / np.linalg.norm(text_emb)
    similarities = index["embeddings"] @ text_emb
    valid_mask = similarities >= CLIP_THRESHOLD
    valid_indices = np.where(valid_mask)[0]

    if len(valid_indices) == 0:
        valid_indices = np.arange(len(similarities))

    sorted_indices = valid_indices[np.argsort(similarities[valid_indices])[::-1]][:k]
    results = []
    for idx in sorted_indices:
        abs_path = Path(index["paths"][idx])
        images_dir = Path(IMAGES_DIR)
        try:
            rel_path = str(abs_path.relative_to(images_dir))
        except ValueError:
            rel_path = str(Path(abs_path.parent.name) / abs_path.name)

        dims = index["dimensions"][idx] if idx < len(index["dimensions"]) else (0, 0)
        results.append({
            "path": rel_path.replace("\\", "/"),
            "label": index["labels"][idx],
            "score": _normalize_score(float(similarities[idx])),
            "raw_score": round(float(similarities[idx]), 3),
            "width": dims[0],
            "height": dims[1],
        })

    return results

def rebuild_clip_index():
    global _index
    _index = None
    if Path(CLIP_INDEX_PATH).exists():
        Path(CLIP_INDEX_PATH).unlink()
    return build_clip_index()