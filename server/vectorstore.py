from pathlib import Path
import glob
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from config import (
    REPORTS_DIR,
    CHROMA_PERSIST_DIR,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    EMBEDDING_MODEL,
)

def get_embeddings():
    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        encode_kwargs={"normalize_embeddings": True},
    )

def load_and_chunk_pdfs() -> list[Document]:
    pdf_files = glob.glob(str(Path(REPORTS_DIR) / "*.pdf"))
    if not pdf_files:
        print(f"No pdf reports found in {REPORTS_DIR}")
        return []

    print(f"Found {len(pdf_files)} PDF reports, loading and chunking.")
    all_chunks = []
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n\n", "\n\n", "\n", ". ", " ", ""],
        add_start_index=True,
    )

    for pdf_path in pdf_files:
        filename = Path(pdf_path).stem
        print(f"Loading {filename}")

        try:
            loader = PyPDFLoader(pdf_path)
            pages = loader.load()
        except Exception as e:
            print(f"Error with {filename}: {e}")
            continue

        for page in pages:
            page_num = page.metadata.get("page", 0) + 1
            page.metadata["source_label"] = f"{filename} s.{page_num}"
            page.metadata["report"] = filename
            page.metadata["page_num"] = page_num

        chunks = splitter.split_documents(pages)
        all_chunks.extend(chunks)
        print(f"{len(chunks)} chunks from {filename}")

    print(f"Total {len(all_chunks)} chunks from {len(pdf_files)} reports")
    return all_chunks

def build_vectorstore() -> Chroma:
    embeddings = get_embeddings()
    if Path(CHROMA_PERSIST_DIR).exists():
        print("Loading existing vectorstore")
        store = Chroma(
            persist_directory=CHROMA_PERSIST_DIR,
            embedding_function=embeddings,
        )
    else:
        chunks = load_and_chunk_pdfs()
        if not chunks:
            print("No chunks to index, creating empty vectorstore")
            store = Chroma(
                persist_directory=CHROMA_PERSIST_DIR,
                embedding_function=embeddings,
            )
        else:
            print("New vectorstore, creating from chunks")
            store = Chroma.from_documents(
                documents=chunks,
                embedding=embeddings,
                persist_directory=CHROMA_PERSIST_DIR,
            )
    print("Vectors ready")
    return store

def ingest_pdf(store: Chroma, pdf_bytes: bytes, filename: str) -> int:
    save_path = Path(REPORTS_DIR) / filename
    save_path.write_bytes(pdf_bytes)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n\n", "\n\n", "\n", ". ", " ", ""],
        add_start_index=True,
    )

    try:
        loader = PyPDFLoader(str(save_path))
        pages = loader.load()
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise RuntimeError(f"Could not parse PDF: {e}")

    stem = Path(filename).stem
    for page in pages:
        page_num = page.metadata.get("page", 0) + 1
        page.metadata["source_label"] = f"{stem} s.{page_num}"
        page.metadata["report"] = stem
        page.metadata["page_num"] = page_num

    chunks = splitter.split_documents(pages)
    if chunks:
        store.add_documents(chunks)
        print(f"Ingested {len(chunks)} chunks from {filename}")
    return len(chunks)

def rebuild_vectorstore() -> Chroma:
    import shutil
    if Path(CHROMA_PERSIST_DIR).exists():
        shutil.rmtree(CHROMA_PERSIST_DIR)
        print("Deleted old vectorstore directory")
    return build_vectorstore()