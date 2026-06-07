import random
import re
import uuid
from collections import Counter

import ollama
import pypdfium2 as pdfium
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from schemas import GenerateQuestionRequest, Question

notes_store: dict[str, str] = {}

_SYSTEM_PROMPT = (
    "You are a fair university examiner conducting an oral viva exam. "
    "Generate exactly ONE exam question grounded STRICTLY in the provided study material "
    "— do not introduce outside concepts. The question must be answerable verbally in a "
    "spoken exam, so never instruct the student to 'write code', 'draw', or 'show on paper'. "
    "For calculation questions on programming material, this means code-tracing where the "
    "student says what the output is. For 'expected_concepts', list 3-5 short concrete strings "
    "— the specific things a student must mention for full marks, not vague labels like "
    "'concept_1'. Generate a unique question_id like 'q_gen_xxx' where xxx is random."
)

_USER_PROMPT = (
    "Difficulty: {difficulty}\n"
    "Suggested question_type: {question_type}\n\n"
    "Study material:\n{chunk}\n\n"
    "Generate one exam question as valid JSON matching the Question schema."
)

_CODE_PATTERNS = ["def ", "print(", "class ", "for ", "[", "="]
_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "using",
    "what",
    "when",
    "which",
    "with",
}


def _sample_chunk(notes: str, target: int = 1500) -> str:
    if len(notes) <= target:
        return notes
    start = random.randint(0, len(notes) - target)
    raw = notes[start : start + target]
    ends = [m.end() for m in re.finditer(r"\. |\n\n|\?\n", raw)]
    return raw[: ends[-1]] if ends else raw


def _detect_question_type(chunk: str) -> str:
    if any(p in chunk for p in _CODE_PATTERNS):
        return random.choice(["conceptual", "calculation"])
    return "conceptual"


def _extract_expected_concepts(text: str, limit: int = 5) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z0-9_-]+", text.lower())
    counts = Counter(word for word in words if len(word) > 3 and word not in _STOPWORDS)
    concepts = [word for word, _ in counts.most_common(limit)]
    return concepts or ["main idea", "key detail", "supporting example"]


def _fallback_question(notes: str, difficulty: str, question_type: str) -> Question:
    chunk = _sample_chunk(notes, target=400).strip()
    lines = [line.strip(" -\t") for line in chunk.splitlines() if line.strip()]
    topic = lines[0][:80].rstrip(".,:;") if lines else "Uploaded notes"

    if question_type == "calculation":
        question_text = (
            "Walk through the following material step by step and explain the result: "
            f"{chunk[:220]}"
        )
    else:
        question_text = (
            f"Explain the main idea behind '{topic}' using evidence from the uploaded notes."
        )

    return Question(
        question_id=f"q_fallback_{uuid.uuid4().hex[:8]}",
        question_text=question_text,
        topic=topic,
        difficulty=difficulty,
        expected_concepts=_extract_expected_concepts(chunk),
        question_type=question_type,
    )

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


@app.post("/generate-question", response_model=Question)
def generate_question(body: GenerateQuestionRequest):
    notes = notes_store.get(body.session_id)
    if notes is None:
        raise HTTPException(status_code=404, detail="Session not found.")

    chunk = _sample_chunk(notes)
    question_type = _detect_question_type(chunk)

    user_msg = _USER_PROMPT.format(
        difficulty=body.difficulty,
        question_type=question_type,
        chunk=chunk,
    )

    client = ollama.Client(timeout=60.0)
    try:
        response = client.chat(
            model="phi4-mini",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            format=Question.model_json_schema(),
        )
        return Question.model_validate_json(response.message.content)
    except Exception:
        return _fallback_question(notes, body.difficulty, question_type)
