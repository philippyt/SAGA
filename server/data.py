#!/usr/bin/env python3
"""
Download open-source subsea inspection data.

Usage:
    python download_data.py

Downloads:
    - Marine corrosion images (Kaggle)
    - ULTIR underwater corrosion/crack images
    - Sample subsea inspection PDF reports (public domain)
"""
import os
import sys
import subprocess
import urllib.request
import zipfile
import shutil
from pathlib import Path

BASE = Path(__file__).parent
IMAGES_DIR = BASE / "data" / "images"
REPORTS_DIR = BASE / "data" / "reports"

IMAGES_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def download_file(url, dest):
    if dest.exists():
        print(f"  Already exists: {dest.name}")
        return

    print(f"  Downloading: {dest.name}")
    session = requests.Session()
    retries = Retry(total=5, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
    session.mount('https://', HTTPAdapter(max_retries=retries))

    try:
        response = session.get(url, timeout=30, stream=True)
        response.raise_for_status()
        with open(dest, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"  Done: {dest.name}")
    except Exception as e:
        print(f"  Failed: {dest.name} - {e}")
        if dest.exists():  # partial download
            dest.unlink()


def download_reports():
    """Download public subsea inspection PDFs."""
    print("\n--- PDF Reports ---")

    reports = [
        (
            "https://www.bsee.gov/sites/bsee.gov/files/research-reports/565aa.pdf",
            "DNV_Subsea_Pipeline_Integrity.pdf",
        ),
        (
            "https://ww2.eagle.org/content/dam/eagle/advisories-and-debriefs/ssimr-advisory-19016.pdf",
            "ABS_Subsea_IMR_Advisory_2019.pdf",
        ),
    ]

    for url, filename in reports:
        try:
            download_file(url, REPORTS_DIR / filename)
        except Exception as e:
            print(f"  Failed: {filename} - {e}")


def download_corrosion_github():
    """Download corrosion images from GitHub (pjsun2012)."""
    print("\n--- Corrosion Images (GitHub) ---")
    dest = IMAGES_DIR / "corrosion"
    if dest.exists() and len(list(dest.iterdir())) > 10:
        print("  Already downloaded")
        return

    zip_url = "https://github.com/pjsun2012/Phase5_Capstone-Project/archive/refs/heads/main.zip"
    zip_path = IMAGES_DIR / "corrosion_github.zip"

    try:
        download_file(zip_url, zip_path)
        print("  Extracting...")
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(IMAGES_DIR / "_temp_corrosion")

        # Find image directories
        extracted = IMAGES_DIR / "_temp_corrosion"
        dest.mkdir(exist_ok=True)

        count = 0
        for root, dirs, files in os.walk(extracted):
            for f in files:
                if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                    src = Path(root) / f
                    shutil.copy2(src, dest / f)
                    count += 1

        print(f"  Extracted {count} images to {dest}")
        shutil.rmtree(extracted, ignore_errors=True)
        zip_path.unlink(missing_ok=True)
    except Exception as e:
        print(f"  Failed: {e}")


def download_ultir():
    """Download ULTIR underwater inspection images."""
    print("\n--- ULTIR Underwater Corrosion ---")
    print("  ULTIR dataset must be downloaded manually from:")
    print("  https://ultir.github.io/")
    print("  Place images in: data/images/ultir/")

    dest = IMAGES_DIR / "ultir"
    dest.mkdir(exist_ok=True)

    readme = dest / "README.txt"
    if not readme.exists():
        readme.write_text(
            "Download ULTIR dataset from https://ultir.github.io/\n"
            "Contains underwater corrosion and crack images under varying conditions.\n"
        )


def download_mavecod():
    """Note about MaVeCoDD dataset."""
    print("\n--- MaVeCoDD Ship Hull Corrosion ---")
    print("  Download manually from Mendeley Data:")
    print("  https://data.mendeley.com/datasets/ry392rp8cj/1")
    print("  Place images in: data/images/mavecod/")

    dest = IMAGES_DIR / "mavecod"
    dest.mkdir(exist_ok=True)


def print_summary():
    """Print what we have."""
    print("\n=== Data Summary ===")

    pdf_count = len(list(REPORTS_DIR.glob("*.pdf")))
    print(f"PDF reports: {pdf_count} files in {REPORTS_DIR}")

    img_count = 0
    for ext in ['*.jpg', '*.jpeg', '*.png', '*.bmp', '*.webp']:
        img_count += len(list(IMAGES_DIR.rglob(ext)))
    print(f"Images: {img_count} files in {IMAGES_DIR}")

    if pdf_count == 0:
        print("\nNo PDFs found. Run this script or add PDFs to data/reports/")
    if img_count == 0:
        print("\nNo images found. Run this script or add images to data/images/")


if __name__ == "__main__":
    print("Subsea RAG - Data Downloader")
    print("=" * 40)

    download_reports()
    download_corrosion_github()
    download_ultir()
    download_mavecod()
    print_summary()

    print("\nNext steps:")
    print("1. Optionally download ULTIR and MaVeCoDD manually")
    print("2. cd backend && pip install -r requirements.txt")
    print("3. python main.py")