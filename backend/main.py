import uuid

import pypdfium2 as pdfium
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

notes_store: dict[str, str] = {}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/ping")
def ping():
    return {"status": "ok"}


@app.post("/upload-notes")
async def upload_notes(file: UploadFile = File(...)):
    filename = file.filename or ""
    if filename.endswith(".pdf"):
        raw = await file.read()
        pdf = pdfium.PdfDocument(raw)
        pages = [pdf[i].get_textpage().get_text_range() for i in range(len(pdf))]
        text = "\n".join(pages)
    elif filename.endswith(".txt"):
        raw = await file.read()
        text = raw.decode("utf-8")
    else:
        raise HTTPException(status_code=400, detail="Only .pdf and .txt files are accepted.")

    session_id = str(uuid.uuid4())
    notes_store[session_id] = text
    return {"session_id": session_id, "char_count": len(text), "preview": text[:200]}


@app.get("/notes/{session_id}")
def get_notes(session_id: str):
    text = notes_store.get(session_id)
    if text is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"session_id": session_id, "char_count": len(text), "preview": text[:200]}
