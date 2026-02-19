import pickle
import glob
from pathlib import Path
import numpy as np
from PIL import Image
from transformers import CLIPModel, CLIPProcessor
from config import IMAGES_DIR, CLIP_INDEX_PATH, CLIP_MODEL, TOP_K_IMAGES

_model = None
_processor = None
_index = None

def _load_clip():
    global _model, _processor
    if _model is None:
        print(f"loading clip model {CLIP_MODEL}")
        _model = CLIPModel.from_pretrained(CLIP_MODEL)
        _processor = CLIPProcessor.from_pretrained(CLIP_MODEL)
        print("CLIP ready")
    return _model, _processor

def build_clip_index():
    global _index
    model, processor = _load_clip()
    image_extensions = ["*.jpg", "*.jpeg", "*.png", "*.bmp", "*.webp"]
    image_paths = []
    for ext in image_extensions:
        image_paths.extend(glob.glob(str(Path(IMAGES_DIR) / "**" / ext), recursive=True))

    if not image_paths:
        print(f"no images in {IMAGES_DIR}")
        _index = {"paths": [], "embeddings": np.array([]), "labels": []}
        return _index

    print(f"indexing {len(image_paths)} images")
    embeddings = []
    valid_paths = []
    labels = []

    for i, img_path in enumerate(image_paths):
        try:
            img = Image.open(img_path).convert("RGB")
            inputs = processor(images=img, return_tensors="pt")
            outputs = model.get_image_features(**inputs)
            emb = outputs.detach().numpy().flatten()
            emb = emb / np.linalg.norm(emb)

            embeddings.append(emb)
            valid_paths.append(img_path)

            rel_path = str(Path(img_path).relative_to(IMAGES_DIR))
            parent = Path(img_path).parent.name
            labels.append(parent if parent != Path(IMAGES_DIR).name else Path(img_path).stem)

            if (i + 1) % 50 == 0:
                print(f"{i + 1}/{len(image_paths)} images indexed")
        except Exception as e:
            print(f"error {img_path}: {e}")

    _index = {
        "paths": valid_paths,
        "embeddings": np.array(embeddings) if embeddings else np.array([]),
        "labels": labels,
    }
    with open(CLIP_INDEX_PATH, "wb") as f:
        pickle.dump(_index, f)

    print(f"{len(valid_paths)} pictures indexed")
    return _index

def load_clip_index():
    global _index
    if _index is not None:
        return _index
    if Path(CLIP_INDEX_PATH).exists():
        with open(CLIP_INDEX_PATH, "rb") as f:
            _index = pickle.load(f)
        print(f"   Lastet CLIP-indeks: {len(_index['paths'])} bilder")
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
    top_indices = np.argsort(similarities)[::-1][:k]
    results = []
    for idx in top_indices:
        rel_path = str(Path(index["paths"][idx]).relative_to(IMAGES_DIR))
        results.append({
            "path": rel_path,
            "label": index["labels"][idx],
            "score": round(float(similarities[idx]), 3),
        })

    return results

def rebuild_clip_index():
    global _index
    _index = None
    if Path(CLIP_INDEX_PATH).exists():
        Path(CLIP_INDEX_PATH).unlink()
    return build_clip_index()