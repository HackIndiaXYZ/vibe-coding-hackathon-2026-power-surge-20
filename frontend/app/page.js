"use client";
import { useState } from "react";

async function mockUploadNotes(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("http://localhost:8000/upload-notes", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Unable to upload notes. Please try again.");
  }

  return response.json();
}

async function mockGenerateQuestion(session_id) {
  const response = await fetch("http://localhost:8000/generate-question", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session_id: session_id,
      difficulty: "easy",
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to generate a question. Please try again.");
  }

  return response.json();
}

async function uploadNotes(file) {
  return mockUploadNotes(file);
}

async function generateQuestion(sessionId) {
  return mockGenerateQuestion(sessionId);
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [questionResult, setQuestionResult] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [questionError, setQuestionError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadError("");
    setQuestionError("");
    setUploadResult(null);
    setQuestionResult(null);
  }

  async function handleUpload() {
    if (!selectedFile) {
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setQuestionError("");
    setUploadResult(null);
    setQuestionResult(null);

    try {
      const result = await uploadNotes(selectedFile);
      setUploadResult(result);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Unable to upload notes. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleGenerateQuestion() {
    if (!uploadResult?.session_id) {
      return;
    }

    setIsGenerating(true);
    setQuestionError("");
    setQuestionResult(null);

    try {
      const result = await generateQuestion(uploadResult.session_id);
      setQuestionResult(result);
    } catch (error) {
      setQuestionError(
        error instanceof Error
          ? error.message
          : "Unable to generate a question. Please try again."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  const previewText = uploadResult?.preview
    ? uploadResult.preview.slice(0, 200)
    : "";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        color: "#111827",
        padding: "48px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <header style={{ display: "grid", gap: 8 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#2563eb",
            }}
          >
            Offline AI Viva Examiner
          </p>
          <h1 style={{ margin: 0, fontSize: "2rem", lineHeight: 1.2 }}>
            Upload notes, then generate a practice viva question.
          </h1>
          <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>
            This page uses mocked backend calls for now so you can swap in real
            fetch requests later without changing the UI flow.
          </p>
        </header>

        <section
          style={{
            background: "#ffffff",
            border: "1px solid #dbe3f0",
            borderRadius: 16,
            padding: 24,
            display: "grid",
            gap: 16,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#2563eb",
              }}
            >
              Stage 1
            </span>
            <h2 style={{ margin: 0, fontSize: "1.35rem" }}>Notes upload</h2>
            <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>
              Select a PDF or text file to simulate extracting study material.
            </p>
          </div>

          <label style={{ display: "grid", gap: 8, fontWeight: 600 }}>
            <span>Select notes file</span>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileChange}
              style={{
                padding: 12,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                background: "#ffffff",
              }}
            />
          </label>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              style={{
                padding: "12px 18px",
                border: "none",
                borderRadius: 10,
                background: !selectedFile || isUploading ? "#94a3b8" : "#2563eb",
                color: "#ffffff",
                fontWeight: 700,
                cursor: !selectedFile || isUploading ? "not-allowed" : "pointer",
              }}
            >
              {isUploading ? "Uploading..." : "Upload notes"}
            </button>
            {selectedFile ? (
              <span style={{ alignSelf: "center", color: "#475569" }}>
                Selected: {selectedFile.name}
              </span>
            ) : null}
          </div>

          {uploadError ? (
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
              }}
            >
              {uploadError}
            </div>
          ) : null}

          {uploadResult ? (
            <div
              style={{
                display: "grid",
                gap: 10,
                padding: 18,
                borderRadius: 12,
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
              }}
            >
              <strong style={{ fontSize: "1rem" }}>Upload successful</strong>
              <span style={{ color: "#1e3a8a" }}>
                Character count: {uploadResult.char_count}
              </span>
              <div style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600, color: "#1e3a8a" }}>
                  Preview
                </span>
                <p style={{ margin: 0, color: "#1f2937", lineHeight: 1.6 }}>
                  {previewText}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <section
          style={{
            background: "#ffffff",
            border: "1px solid #dbe3f0",
            borderRadius: 16,
            padding: 24,
            display: "grid",
            gap: 16,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#2563eb",
              }}
            >
              Stage 2
            </span>
            <h2 style={{ margin: 0, fontSize: "1.35rem" }}>
              Question generation
            </h2>
            <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>
              Generate one viva-style question using the uploaded notes session.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button
              type="button"
              onClick={handleGenerateQuestion}
              disabled={!uploadResult?.session_id || isGenerating}
              style={{
                padding: "12px 18px",
                border: "none",
                borderRadius: 10,
                background:
                  !uploadResult?.session_id || isGenerating ? "#94a3b8" : "#0f766e",
                color: "#ffffff",
                fontWeight: 700,
                cursor:
                  !uploadResult?.session_id || isGenerating
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {isGenerating ? "Generating..." : "Generate question"}
            </button>
          </div>

          {questionError ? (
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
              }}
            >
              {questionError}
            </div>
          ) : null}

          {questionResult ? (
            <div
              style={{
                display: "grid",
                gap: 12,
                padding: 20,
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px solid #dbe3f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                  color: "#475569",
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: "lowercase",
                }}
              >
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    background: "#e2e8f0",
                  }}
                >
                  {questionResult.topic}
                </span>
                <span style={{ color: "#94a3b8" }}>·</span>
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    background: "#dcfce7",
                    color: "#166534",
                  }}
                >
                  {questionResult.difficulty}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "1.5rem",
                  lineHeight: 1.5,
                  color: "#0f172a",
                }}
              >
                {questionResult.question_text}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
