import pickle
import glob
from pathlib import Path
import torch
from torchvision import transforms
import numpy as np
from PIL import Image
import torch
import torch.nn as nn
from torchvision import models
import json
from config import IMAGES_DIR, CLIP_INDEX_PATH, CLIP_MODEL, TOP_K_IMAGES

_model = None
_processor = None
_index = None

CLIP_SIM_MIN = 0.15
CLIP_SIM_MAX = 0.40
CLIP_THRESHOLD = 0.18
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
        print(f"   Loading CLIP model: {CLIP_MODEL}")
        _model = CLIPModel.from_pretrained(CLIP_MODEL)
        _processor = CLIPProcessor.from_pretrained(CLIP_MODEL)
        print("   CLIP ready")
    return _model, _processor

_classifier = None
_classifier_classes = None

def _load_classifier():
    global _classifier, _classifier_classes
    if _classifier is not None:
        return _classifier, _classifier_classes

    model_path = Path(IMAGES_DIR).parent.parent / "defect_model" / "efficientnet_b0.pth"
    meta_path = Path(IMAGES_DIR).parent.parent / "defect_model" / "meta.json"
    if not model_path.exists():
        model_path = Path(__file__).parent / "defect_model" / "efficientnet_b0.pth"
        meta_path = Path(__file__).parent / "defect_model" / "meta.json"

    if model_path.exists() and meta_path.exists():
        try:
            with open(meta_path) as f:
                meta = json.load(f)
            _classifier_classes = meta["classes"]

            model = models.efficientnet_b0(weights=None)
            model.classifier[1] = nn.Linear(model.classifier[1].in_features, len(_classifier_classes))
            model.load_state_dict(torch.load(model_path, map_location="cpu", weights_only=True))
            model.eval()
            _classifier = model
            print(f"Loaded fine-tuned classifier: {len(_classifier_classes)} classes")
            return _classifier, _classifier_classes
        except Exception as e:
            print(f"Could not load classifier: {e}")

    return None, None

def _caption_image(model, processor, img):
    classifier, classes = _load_classifier()
    if classifier is not None:
        try:
            transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ])
            tensor = transform(img).unsqueeze(0)
            with torch.no_grad():
                output = classifier(tensor)
                probs = torch.softmax(output, dim=1)[0]
                best_idx = probs.argmax().item()
                label = classes[best_idx].replace("_", " ")
                return label
        except:
            pass

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
        print(f"   No images found in {IMAGES_DIR}")
        _index = {"paths": [], "embeddings": np.array([]), "labels": [], "dimensions": []}
        return _index

    print(f"   Indexing {len(image_paths)} images")

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

    print(f"   CLIP index ready: {len(valid_paths)} images")
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
        print(f"   Loaded CLIP index: {len(_index['paths'])} images")
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