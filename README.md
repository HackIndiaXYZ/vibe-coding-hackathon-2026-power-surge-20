AI Viva Examiner

An offline AI viva examiner that turns your notes into spoken oral exams, grades your reasoning locally, and works with zero cloud, zero API keys, and zero internet after setup.

🎙️ Voice-driven · 🔒 100% offline · 🧠 Local AI (Phi-4-mini + Whisper) · 🎯 Adaptive difficulty · 📊 Session summary

Demo

📽️ Demo video: https://drive.google.com/drive/folders/1k7XUQ2NOrOYAfam1bHh4FC6QrQJ9Nwqm

What it does
AI Viva Examiner is a fully local AI-powered oral exam practice tool built for HackIndia Vibe Coding Hackathon 2026. It will:

- Reads your notes - upload a PDF or text file of your study material
- Generates exam questions - uses a local language model to produce viva-style questions at easy/medium/hard difficulty
- Speaks questions aloud - like a real examiner using browser text-to-speech
- Listens to your answers - record your spoken response with one click
- Grades your reasoning - local AI evaluates whether you covered the expected concepts, with detailed feedback
- Adapts to your gaps - when you miss something important, the next question probes that weak spot
- Summarizes your session - end the session anytime to see a report card with strong topics, areas to revise, and AI-generated study recommendations

Why offline matters

Most AI study tools are cloud-only. AI Viva Examiner is built for a different reality - students with patchy internet, privacy-sensitive notes, or no budget for API subscriptions.

Most AI study tools send your notes and answers to OpenAI or Anthropic. AI Viva Examiner runs every model - language, speech, transcription - directly on your laptop. That means:

- Your notes stay on your machine - true privacy for personal study material
- Zero API keys, zero cost - no subscriptions, no recurring spend
- No internet required after setup - works on a plane, in a hostel, anywhere
- Usable with just a laptop - no payment barrier for students

Key features

- Local question generation - questions tailored to your uploaded notes, with three difficulty levels: easy, medium, and hard
- Speak or type your answer - record voice with one click or type into the answer box; faster-whisper transcribes locally
- Honest grading - AI evaluates whether you covered the expected concepts, not just surface-level keywords
- Adaptive follow-ups - miss a concept, and the next question can probe that exact gap before moving on
- End-of-session report card - review average score, strong topics, topics to revise, weak topics, and study recommendations
- Pure local stack - no cloud, no API keys, no telemetry, and no internet required after setup

Tech stack

Layer | Choice | Why
Frontend | Next.js 15, React 19 | App Router UI with fast iteration for a hackathon demo
Backend | FastAPI | Lightweight API layer with clean local endpoints
Validation | Pydantic | Structured request and response validation across endpoints
Language model | Phi-4-mini (3.8B) via Ollama | Strong CPU-friendly latency for real-time viva interactions
Speech-to-text | faster-whisper (base, int8) | Lightweight, accurate local transcription
Text-to-speech | Browser Web Speech API | Zero install and no additional model RAM overhead
PDF parsing | pypdfium2 | Reliable PDF text extraction without external binaries

How to run it

Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer
- Ollama installed from https://ollama.com/
- At least 8GB free RAM (16GB recommended)

Setup (one-time)

1. Clone the repo

git clone https://github.com/HackIndiaXYZ/vibe-coding-hackathon-2026-power-surge-20.git
cd vibe-coding-hackathon-2026-power-surge-20

2. Pull the language model

ollama pull phi4-mini

3. Set up the backend

Create and activate a virtual environment inside the backend folder, then install dependencies.

cd backend
python -m venv .venv

.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

Backend packages installed here include FastAPI, Uvicorn, the Ollama Python client, pypdfium2 for PDF parsing, and faster-whisper for transcription.

4. Set up the frontend

Open a separate terminal, move into the frontend folder, and install Node dependencies.

cd frontend
npm install

This installs the Next.js 15 app and its React 19 dependencies.

Note: First startup downloads ~280MB of models (Whisper base + Phi-4-mini). After that, fully offline.

Run it (every time)

Open three terminals and keep them running while you use the app.

Terminal 1 - Ollama

Make sure Ollama is running and that the phi4-mini model is available.

Verify the local model is available
ollama list

Start the Ollama service if it is not already running
ollama serve

Pull the model if it is missing
ollama pull phi4-mini

Terminal 2 - backend

Start the FastAPI server from the backend folder.

Start the local FastAPI backend
cd backend
.venv\Scripts\Activate.ps1
uvicorn main:app --reload

What to expect:

- The backend listens on http://localhost:8000
- API docs are available at http://localhost:8000/docs
- A quick health check is http://localhost:8000/ping
- On the first run, faster-whisper may download its speech model before requests become fast

Terminal 3 - frontend

Start the Next.js frontend from the frontend folder.

Start the local frontend app
cd frontend
npm run dev

What to expect:

- The frontend runs on http://localhost:3000
- The browser app sends requests directly to the FastAPI backend on http://localhost:8000
- The backend must already be running before upload, question generation, transcription, or evaluation will work

Open http://localhost:3000 in your browser.

Using the app

1. Upload a .pdf or .txt file containing your notes.
2. Select the difficulty level.
3. Generate a viva question.
4. Listen to the spoken question in the browser.
5. Type or record your answer.
6. Review the feedback and continue the session.

Troubleshooting

Backend does not start

Re-activate the virtual environment and reinstall dependencies:

cd backend
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

Frontend shows network errors

Make sure the backend is running first and responds at http://localhost:8000/ping.

Question generation or grading fails

Check that Ollama is running and that phi4-mini is available:

ollama list

If needed, restart the Ollama service with ollama serve.

Microphone recording does not work

Allow microphone access for localhost in your browser and try again.

Architecture

┌──────────────┐         ┌──────────────────────────┐         ┌─────────────────┐
│   Browser    │ ◀────── │      FastAPI Backend     │ ◀────── │   Ollama        │
│   Next.js    │ ──────▶ │   (Python, localhost)    │ ──────▶ │  (Phi-4-mini)   │
│  (port 3000) │         │     (port 8000)          │         │   (port 11434)  │
└──────────────┘         └──────────────────────────┘         └─────────────────┘
│
│
▼
┌──────────────────────────┐
│   faster-whisper (STT)   │
│   (in-process, CPU)      │
└──────────────────────────┘

The browser handles text-to-speech directly. All other AI work runs in the FastAPI process.

API endpoints

- POST /upload-notes - extract text from PDF/TXT and store it in session memory
- POST /generate-question - generate one viva question at the requested difficulty
- POST /evaluate-answer - grade the student's spoken or typed answer
- POST /transcribe-audio - convert recorded audio to text
- POST /session-summary - generate study recommendations from session evaluations

Full API docs are available at http://localhost:8000/docs when the backend is running.

Engineering decisions

- Why local-only - cloud AI study tools quickly become expensive for students; this project is designed to work forever without subscriptions
- Why Phi-4-mini over larger models - the goal is real-time viva flow on a laptop CPU, so latency matters as much as answer quality
- Why structured outputs - constrained response formats make question generation and grading more dependable in a live demo

Team

Built for HackIndia Vibe Coding Hackathon 2026 by:

Mrityunjay Krithick - backend, AI integration,prompt engineering
Oviya S - frontend, UI, voice integration, prompt engineering
Paari S - pitch, demo, gold-standard test data, ui design

