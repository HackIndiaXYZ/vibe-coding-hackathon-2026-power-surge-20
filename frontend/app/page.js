"use client";
import { useEffect, useRef, useState } from "react";

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

async function mockEvaluateAnswer(
  question_id,
  answer_text,
  question_text,
  expected_concepts
) {
  const response = await fetch("http://localhost:8000/evaluate-answer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question_id,
      question_text,
      expected_concepts,
      student_answer: answer_text,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to evaluate your answer. Please try again.");
  }

  return response.json();
}

async function uploadNotes(file) {
  return mockUploadNotes(file);
}

async function generateQuestion(sessionId) {
  return mockGenerateQuestion(sessionId);
}

async function evaluateAnswer(
  questionId,
  answerText,
  questionText,
  expectedConcepts
) {
  return mockEvaluateAnswer(
    questionId,
    answerText,
    questionText,
    expectedConcepts
  );
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [questionResult, setQuestionResult] = useState(null);
  const [pendingFollowup, setPendingFollowup] = useState(null);
  const [isCurrentQuestionFollowup, setIsCurrentQuestionFollowup] =
    useState(false);
  const [answerText, setAnswerText] = useState("");
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [questionError, setQuestionError] = useState("");
  const [evaluationError, setEvaluationError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  function speakText(text) {
    if (typeof window === "undefined" || !text) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadError("");
    setQuestionError("");
    setEvaluationError("");
    setUploadResult(null);
    setQuestionResult(null);
    setPendingFollowup(null);
    setIsCurrentQuestionFollowup(false);
    setAnswerText("");
    setEvaluationResult(null);
  }

  async function handleUpload() {
    if (!selectedFile) {
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setQuestionError("");
    setEvaluationError("");
    setUploadResult(null);
    setQuestionResult(null);
    setPendingFollowup(null);
    setIsCurrentQuestionFollowup(false);
    setAnswerText("");
    setEvaluationResult(null);

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

    if (pendingFollowup) {
      const followupQuestion = {
        question_id: `followup_${Date.now()}`,
        question_text: pendingFollowup.hint,
        topic: `${pendingFollowup.parent_topic} (follow-up)`,
        difficulty: pendingFollowup.parent_difficulty,
        expected_concepts: questionResult?.expected_concepts ?? [],
        question_type: "conceptual",
      };

      setQuestionError("");
      setQuestionResult(followupQuestion);
      setIsCurrentQuestionFollowup(true);
      setPendingFollowup(null);
      setAnswerText("");
      setEvaluationResult(null);
      setEvaluationError("");

      if (autoPlay) {
        speakText(followupQuestion.question_text);
      }

      return;
    }

    setIsGenerating(true);
    setQuestionError("");
    setQuestionResult(null);
    setPendingFollowup(null);
    setIsCurrentQuestionFollowup(false);
    setEvaluationError("");
    setAnswerText("");
    setEvaluationResult(null);

    try {
      const result = await generateQuestion(uploadResult.session_id);
      setQuestionResult(result);
      setIsCurrentQuestionFollowup(false);
      if (autoPlay) {
        speakText(result.question_text);
      }
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

  async function handleEvaluateAnswer() {
    if (!questionResult?.question_id) {
      return;
    }

    setIsEvaluating(true);
    setEvaluationError("");
    setEvaluationResult(null);

    try {
      const result = await evaluateAnswer(
        questionResult.question_id,
        answerText,
        questionResult.question_text,
        questionResult.expected_concepts
      );
      setEvaluationResult(result);

      if (isCurrentQuestionFollowup) {
        setPendingFollowup(null);
      } else if (result.needs_followup === true && result.followup_hint) {
        setPendingFollowup({
          hint: result.followup_hint,
          parent_topic: questionResult.topic,
          parent_difficulty: questionResult.difficulty,
        });
      } else {
        setPendingFollowup(null);
      }
    } catch (error) {
      setEvaluationError(
        error instanceof Error
          ? error.message
          : "Unable to evaluate your answer. Please try again."
      );
    } finally {
      setIsEvaluating(false);
    }
  }

  async function handleTranscribe() {
    setIsTranscribing(true);
    setEvaluationError("");

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");

      const response = await fetch("http://localhost:8000/transcribe-audio", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setEvaluationError(
          "Could not transcribe. Please try again or type your answer."
        );
        return;
      }

      const data = await response.json();
      setAnswerText(data.transcription);
    } catch {
      setEvaluationError(
        "Could not transcribe. Please try again or type your answer."
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  async function handleRecordToggle() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    if (
      typeof window === "undefined" ||
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setEvaluationError(
        "Microphone access denied. Please allow mic permission or type your answer."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorderOptions = MediaRecorder.isTypeSupported("audio/webm")
        ? { mimeType: "audio/webm" }
        : undefined;
      const mediaRecorder = recorderOptions
        ? new MediaRecorder(stream, recorderOptions)
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = () => {
        void handleTranscribe();
      };

      mediaRecorder.start();
      setEvaluationError("");
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((currentSeconds) => currentSeconds + 1);
      }, 1000);
    } catch {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setEvaluationError(
        "Microphone access denied. Please allow mic permission or type your answer."
      );
    }
  }

  const previewText = uploadResult?.preview
    ? uploadResult.preview.slice(0, 200)
    : "";
  const trimmedAnswerLength = answerText.trim().length;
  const canSubmitAnswer =
    !!questionResult?.question_id &&
    trimmedAnswerLength >= 10 &&
    !isEvaluating &&
    !isRecording &&
    !isTranscribing;
  const formattedRecordingTime = `${Math.floor(recordingSeconds / 60)}:${String(
    recordingSeconds % 60
  ).padStart(2, "0")}`;
  const recordingStatusText = isTranscribing
    ? "Transcribing..."
    : isRecording
      ? `Recording... ${formattedRecordingTime}`
      : questionResult?.question_id
        ? "Click record and speak your answer"
        : "";
  const generateButtonLabel = isGenerating
    ? "Generating..."
    : pendingFollowup
      ? "🔁 Ask follow-up question"
      : questionResult
        ? "Next question"
        : "Generate question";
  const generateButtonBackground = !uploadResult?.session_id || isGenerating
    ? "#94a3b8"
    : pendingFollowup
      ? "linear-gradient(135deg, #7c3aed, #ea580c)"
      : "#0f766e";
  const scoreCardStyles =
    evaluationResult?.score != null
      ? evaluationResult.score < 4
        ? {
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
          }
        : evaluationResult.score < 8
          ? {
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#b45309",
            }
          : {
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
            }
      : null;

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

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={autoPlay}
                  onChange={(e) => setAutoPlay(e.target.checked)}
                  style={{ margin: 0 }}
                />
                <span>Auto-play questions</span>
              </label>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {questionResult && !isSpeaking ? (
                  <button
                    type="button"
                    onClick={() => speakText(questionResult.question_text)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 999,
                      border: "1px solid #99f6e4",
                      background: "#ccfbf1",
                      color: "#115e59",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    🔊 Listen
                  </button>
                ) : null}

                {isSpeaking ? (
                  <button
                    type="button"
                    onClick={stopSpeaking}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 999,
                      border: "1px solid #fecaca",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ⏹ Stop
                  </button>
                ) : null}
              </div>
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
                background: generateButtonBackground,
                color: "#ffffff",
                fontWeight: 700,
                boxShadow: pendingFollowup
                  ? "0 10px 24px rgba(124, 58, 237, 0.22)"
                  : "none",
                cursor:
                  !uploadResult?.session_id || isGenerating
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {generateButtonLabel}
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
              {isCurrentQuestionFollowup ? (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#fef3c7",
                    border: "1px solid #fcd34d",
                    color: "#92400e",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Follow-up question — probing your previous answer.
                </div>
              ) : null}
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
              Stage 3
            </span>
            <h2 style={{ margin: 0, fontSize: "1.35rem" }}>
              Answer evaluation
            </h2>
            <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>
              Write your answer, then submit it for mocked evaluation feedback.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handleRecordToggle}
              disabled={isTranscribing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 18px",
                borderRadius: 12,
                border: "none",
                fontSize: 16,
                fontWeight: 700,
                cursor: isTranscribing ? "not-allowed" : "pointer",
                background: isRecording ? "#dc2626" : "#d97706",
                color: "#ffffff",
                opacity: isTranscribing ? 0.7 : 1,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#ffffff",
                  opacity: isRecording ? 1 : 0.85,
                  boxShadow: isRecording
                    ? "0 0 0 6px rgba(255, 255, 255, 0.18)"
                    : "none",
                  transition: "box-shadow 0.3s ease, opacity 0.3s ease",
                }}
              />
              {isRecording ? "⏹️ Stop" : "🎙️ Record"}
            </button>
            <span
              style={{
                minHeight: 24,
                fontSize: 14,
                color: isRecording ? "#b91c1c" : "#6b7280",
                fontWeight: isRecording || isTranscribing ? 600 : 500,
              }}
            >
              {recordingStatusText}
            </span>
          </div>

          <label style={{ display: "grid", gap: 8, fontWeight: 600 }}>
            <span>Your answer</span>
            <textarea
              rows={6}
              placeholder="Type your answer here..."
              value={answerText}
              onChange={(event) => setAnswerText(event.target.value)}
              style={{
                width: "100%",
                padding: 12,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                background: "#ffffff",
                color: "#111827",
                resize: "vertical",
                font: "inherit",
                boxSizing: "border-box",
              }}
            />
          </label>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button
              type="button"
              onClick={handleEvaluateAnswer}
              disabled={!canSubmitAnswer}
              style={{
                padding: "12px 18px",
                border: "none",
                borderRadius: 10,
                background: canSubmitAnswer ? "#d97706" : "#94a3b8",
                color: "#ffffff",
                fontWeight: 700,
                cursor: canSubmitAnswer ? "pointer" : "not-allowed",
              }}
            >
              {isEvaluating ? "Evaluating..." : "Submit answer"}
            </button>
          </div>

          {evaluationError ? (
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
              }}
            >
              {evaluationError}
            </div>
          ) : null}

          {evaluationResult && scoreCardStyles ? (
            <div
              style={{
                display: "grid",
                gap: 16,
                padding: 20,
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px solid #dbe3f0",
              }}
            >
              <div
                style={{
                  ...scoreCardStyles,
                  padding: 18,
                  borderRadius: 12,
                  display: "grid",
                  gap: 8,
                }}
              >
                <strong style={{ fontSize: "2rem", lineHeight: 1 }}>
                  {evaluationResult.score}/10
                </strong>
                <p style={{ margin: 0, lineHeight: 1.6 }}>
                  {evaluationResult.feedback}
                </p>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 600, color: "#166534" }}>
                  Concepts covered
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {evaluationResult.concepts_covered.map((concept) => (
                    <span
                      key={concept}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: "#dcfce7",
                        color: "#166534",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 600, color: "#b91c1c" }}>
                  Concepts missed
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {evaluationResult.concepts_missed.map((concept) => (
                    <span
                      key={concept}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: "#fee2e2",
                        color: "#b91c1c",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              </div>

              {evaluationResult.needs_followup ? (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    color: "#b45309",
                  }}
                >
                  {evaluationResult.followup_hint}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
