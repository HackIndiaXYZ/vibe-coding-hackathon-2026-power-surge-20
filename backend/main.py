import os
import random
import re
import tempfile
import uuid
from collections import Counter

import ollama
import pypdfium2 as pdfium
from faster_whisper import WhisperModel
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from schemas import EvaluateAnswerRequest, Evaluation, GenerateQuestionRequest, Question

_whisper_model = WhisperModel("base", device="cpu", compute_type="int8")

notes_store: dict[str, str] = {}

_SYSTEM_PROMPT = (
    "You are a fair university examiner generating ONE oral viva exam question. "
    "Ground the question STRICTLY in the provided study material — do not introduce outside concepts. "
    "The question must be answerable verbally in a spoken exam, so never instruct the student to 'write code', 'draw', or 'show on paper'. "
    "\n\n"
    "QUESTION_TYPE RULES (critical):\n"
    "- Use 'calculation' ONLY if the question asks for a specific numeric output, code-trace result, or step-by-step computation that has one correct answer.\n"
    "- Use 'conceptual' for anything asking the student to explain, compare, define, justify, or describe a concept — even if the material contains code.\n"
    "- The suggested question_type is a hint; override it if the question you generated is clearly the other type.\n"
    "\n"
    "DIFFICULTY CALIBRATION (critical — make difficulty levels genuinely different):\n"
    "- 'easy': single-concept questions, definitions or simple identification, answerable in 1-2 sentences.\n"
    "- 'medium': requires comparing two concepts, explaining a process, or applying knowledge to a scenario.\n"
    "- 'hard': requires synthesis across multiple concepts, evaluation of tradeoffs, edge cases, or reasoning about subtle behavior.\n"
    "\n"
    "EXPECTED_CONCEPTS RULES:\n"
    "- List 3-5 short concrete strings — the specific things a student must mention for full marks.\n"
    "- Each concept must be a non-empty, meaningful phrase (at least 3 words OR a specific term/formula).\n"
    "- Never include empty strings, placeholders, or vague labels like 'concept_1'.\n"
    "\n"
    "Generate a unique question_id like 'q_gen_xxx' where xxx is random."
)

_USER_PROMPT = (
    "REQUESTED DIFFICULTY: {difficulty}\n"
    "Your question MUST genuinely match this difficulty level. Re-read the difficulty calibration rules.\n\n"
    "Suggested question_type: {question_type}\n\n"
    "Study material:\n{chunk}\n\n"
    "Generate ONE exam question at the {difficulty} difficulty level as valid JSON matching the Question schema. "
    "Before responding, self-check: does your question genuinely match the requested {difficulty} difficulty? "
    "If not, rewrite it harder or easier." )


_EVAL_SYSTEM_PROMPT = (
    "You are a fair, careful examiner grading an oral viva answer. "
    "Your job is to evaluate whether the student's spoken answer demonstrates understanding of the expected concepts. "
    "Be strict about reasoning errors and factual mistakes, but lenient about minor wording differences — students paraphrase. "
    "Award full marks (8-10) only when most expected concepts are clearly addressed with correct reasoning. "
    "Award middle marks (4-7) for partial understanding. "
    "Award low marks (0-3) for answers that are vague, mostly wrong, or miss the main concepts. "
    "For 'concepts_covered', list only the expected_concepts strings (verbatim) that the student clearly addressed. "
    "For 'concepts_missed', list expected_concepts strings the student did NOT address. "
    "Set 'needs_followup' to true when score is below 7 AND there are unmissed concepts worth probing. "
    "The 'followup_hint' should be a single concise spoken question that probes one specific gap — not a list of things to study."
)

_EVAL_USER_PROMPT = (
    "Question asked: {question_text}\n\n"
    "Expected concepts for full marks: {expected_concepts}\n\n"
    "Student's answer: {student_answer}\n\n"
    "Evaluate the student's answer as valid JSON matching the Evaluation schema."
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


@app.post("/evaluate-answer", response_model=Evaluation)
def evaluate_answer(body: EvaluateAnswerRequest):
    user_msg = _EVAL_USER_PROMPT.format(
        question_text=body.question_text,
        expected_concepts=body.expected_concepts,
        student_answer=body.student_answer,
    )
    client = ollama.Client(timeout=60.0)
    try:
        response = client.chat(
            model="phi4-mini",
            messages=[
                {"role": "system", "content": _EVAL_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            format=Evaluation.model_json_schema(),
            options={"temperature": 0.3},
        )
        result = Evaluation.model_validate_json(response.message.content)
    except Exception:
        raise HTTPException(status_code=502, detail="Ollama error.")

    result.concepts_covered = [
        c for c in (c.strip() for c in result.concepts_covered) if len(c) >= 3
    ]
    result.concepts_missed = [
        c for c in (c.strip() for c in result.concepts_missed) if len(c) >= 3
    ]
    if not result.needs_followup:
        result.followup_hint = ""

    return result


@app.post("/transcribe-audio")
def transcribe_audio(file: UploadFile = File(...)):
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name

        try:
            segments, info = _whisper_model.transcribe(tmp_path, beam_size=5, language="en")
            transcription = " ".join(seg.text for seg in segments).strip()
        except Exception:
            raise HTTPException(status_code=502, detail="Whisper error.")
    finally:
        if tmp_path:
            os.remove(tmp_path)

    if not transcription:
        raise HTTPException(status_code=400, detail="No speech detected.")

    return {"transcription": transcription, "duration_seconds": info.duration}
