import pickle
import glob
import json
from pathlib import Path
import torch
import torch.nn as nn
import numpy as np
from PIL import Image
from torchvision import transforms, models
from config import IMAGES_DIR, CLIP_INDEX_PATH, CLIP_MODEL, TOP_K_IMAGES
_model = None
_processor = None
_index = None
_classifier = None
_classifier_classes = None

CLIP_SIM_MIN = 0.15
CLIP_SIM_MAX = 0.40
CLIP_THRESHOLD = 0.18
CLIP_CAPTIONS = [
    "external corrosion on subsea pipeline",
    "internal metal loss on pipe wall",
    "marine growth and biofouling on structure",
    "coating disbondment on pipeline surface",
    "pipeline freespan over seabed",
    "sacrificial anode on pipeline",
    "crack or fracture in weld",
    "mechanical dent or gouge on pipe",
    "pipeline resting on seabed",
    "ROV inspection underwater",
    "weld inspection close-up",
    "scour erosion around pipeline",
    "clean pipeline with no visible defects",
    "cathodic protection assessment",
    "subsea structure inspection",
    "flange or valve fitting inspection",
]

# Each defect class has three domain-specific phrasings.
# Scores are averaged across all phrasings before softmax, this reduces sensitivity to any single wording choice (ensemble prompting).
_DEFECT_ENSEMBLE = [
    {
        "label": "External corrosion",
        "prompts": [
            "external corrosion on metal pipeline surface",
            "rust and oxidation on steel pipe exterior",
            "pitting and general corrosion on outer pipe wall",
        ],
    },
    {
        "label": "Internal corrosion",
        "prompts": [
            "internal corrosion damage inside pipeline",
            "metal loss and pitting on inner pipe wall",
            "corrosion product buildup inside bore",
        ],
    },
    {
        "label": "MIC (microbiologically influenced corrosion)",
        "prompts": [
            "microbiologically influenced corrosion on pipeline",
            "biological film and microbial corrosion on metal",
            "sulphate-reducing bacteria induced metal degradation",
        ],
    },
    {
        "label": "Coating disbondment",
        "prompts": [
            "coating disbondment and damage on pipeline",
            "pipe coating peeling and loss of adhesion",
            "anti-corrosion coating failure on subsea pipe",
        ],
    },
    {
        "label": "Weld crack or fracture",
        "prompts": [
            "crack or fracture in weld or base metal",
            "stress corrosion cracking on pipeline girth weld",
            "fatigue crack in pipe wall or weld toe",
        ],
    },
    {
        "label": "Mechanical damage (dent or gouge)",
        "prompts": [
            "dent or mechanical impact damage on pipeline",
            "gouge and metal deformation on pipe surface",
            "third-party damage causing pipe deformation",
        ],
    },
    {
        "label": "Marine growth (biofouling)",
        "prompts": [
            "marine growth and biofouling on subsea structure",
            "barnacles and algae covering pipeline surface",
            "heavy biological fouling on offshore structure",
        ],
    },
    {
        "label": "Anode depletion",
        "prompts": [
            "sacrificial anode depletion on subsea pipeline",
            "cathodic protection anode consumed or missing",
            "depleted zinc or aluminium anode on pipeline",
        ],
    },
    {
        "label": "Freespan",
        "prompts": [
            "pipeline freespan over seabed gap",
            "unsupported pipe section suspended above seabed",
            "pipeline spanning depression or scour hole",
        ],
    },
    {
        "label": "Scour and seabed erosion",
        "prompts": [
            "scour and seabed erosion around pipeline",
            "sand and sediment erosion exposing pipeline",
            "seabed movement undermining pipeline support",
        ],
    },
    {
        "label": "No visible defect",
        "prompts": [
            "clean metal surface without visible defects",
            "intact pipeline in good condition on seabed",
            "no corrosion or damage visible on pipe surface",
        ],
    },
]

_SEVERITY_ENSEMBLE = [
    {
        "key": "minor",
        "action": "Monitor; schedule reinspection within 2 years.",
        "prompts": [
            "minor surface defect requiring monitoring only",
            "light superficial damage with no structural concern",
            "small coating scratch or surface rust, observation only",
        ],
    },
    {
        "key": "moderate",
        "action": "Plan repair within 12 months. Notify integrity engineer.",
        "prompts": [
            "moderate defect requiring planned repair within 12 months",
            "significant metal loss requiring engineering evaluation",
            "visible damage affecting corrosion barrier needing attention",
        ],
    },
    {
        "key": "severe",
        "action": "Immediate engineering assessment required before next operation.",
        "prompts": [
            "severe defect requiring immediate engineering assessment",
            "deep corrosion or crack approaching wall thickness limit",
            "major structural damage requiring urgent inspection action",
        ],
    },
    {
        "key": "critical",
        "action": "Halt operations. Emergency shutdown and repair required.",
        "prompts": [
            "critical defect requiring immediate shutdown and emergency repair",
            "through-wall defect or imminent failure of pipeline",
            "catastrophic damage requiring immediate operational halt",
        ],
    },
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

def _load_classifier():
    global _classifier, _classifier_classes
    if _classifier is not None:
        return _classifier, _classifier_classes

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
                return classes[best_idx].replace("_", " ")
        except Exception:
            pass

    try:
        inputs = processor(text=CLIP_CAPTIONS, images=img, return_tensors="pt", padding=True, truncation=True)
        with torch.no_grad():
            outputs = model(**inputs)
        logits = outputs.logits_per_image.detach().numpy().flatten()
        return CLIP_CAPTIONS[logits.argmax()]
    except Exception:
        return "inspection image"

def _ensemble_classify(model, processor, img, ensemble: list[dict]) -> list[tuple]:
    class_scores = []
    for cls in ensemble:
        inputs = processor(
            text=cls["prompts"], images=img,
            return_tensors="pt", padding=True, truncation=True,
        )
        with torch.no_grad():
            outputs = model(**inputs)
        logits = outputs.logits_per_image.detach().numpy().flatten()
        class_scores.append(float(logits.mean()))

    arr = np.array(class_scores)
    exp = np.exp(arr - arr.max())
    probs = (exp / exp.sum()).tolist()
    return list(zip(ensemble, probs))


def classify_image(img) -> dict:
    model, processor = _load_clip()

    defect_ranked = sorted(
        _ensemble_classify(model, processor, img, _DEFECT_ENSEMBLE),
        key=lambda x: x[1], reverse=True,
    )
    sev_ranked = sorted(
        _ensemble_classify(model, processor, img, _SEVERITY_ENSEMBLE),
        key=lambda x: x[1], reverse=True,
    )

    top_sev = sev_ranked[0][0]
    return {
        "defects": [{"type": cls["label"], "prob": round(p * 100)} for cls, p in defect_ranked[:3]],
        "severity": top_sev["key"],
        "severity_prob": round(sev_ranked[0][1] * 100),
        "recommendation": top_sev["action"],
        "top_defect": defect_ranked[0][0]["label"],
    }

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
            with torch.no_grad():
                outputs = model.get_image_features(**inputs)
            emb = outputs.detach().numpy().flatten()
            emb = emb / np.linalg.norm(emb)
            embeddings.append(emb)
            valid_paths.append(img_path)
            dimensions.append((w, h))
            labels.append(_caption_image(model, processor, img))

            if (i + 1) % 50 == 0:
                print(f"   {i + 1}/{len(image_paths)} images indexed")
        except Exception as e:
            print(f"Error with {img_path}: {e}")

    _index = {
        "paths": valid_paths,
        "embeddings": np.array(embeddings) if embeddings else np.array([]),
        "labels": labels,
        "dimensions": dimensions,
    }

    with open(CLIP_INDEX_PATH, "wb") as f:
        pickle.dump(_index, f)

    print(f"CLIP index ready: {len(valid_paths)} images")
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
        print(f"Loaded CLIP index: {len(_index['paths'])} images")
        return _index

    return build_clip_index()

def search_images(query: str, k: int = None) -> list[dict]:
    k = k or TOP_K_IMAGES
    index = load_clip_index()

    if len(index["paths"]) == 0:
        return []

    model, processor = _load_clip()
    inputs = processor(text=[query], return_tensors="pt", padding=True, truncation=True)
    with torch.no_grad():
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