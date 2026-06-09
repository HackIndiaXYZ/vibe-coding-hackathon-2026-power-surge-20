"use client";
import { useEffect, useRef, useState } from "react";

async function mockUploadNotes(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("http://localhost:8000/upload-notes", { method: "POST", body: formData });
  if (!response.ok) throw new Error("Unable to upload notes. Please try again.");
  return response.json();
}

async function mockGenerateQuestion(session_id, difficulty) {
  const response = await fetch("http://localhost:8000/generate-question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, difficulty }),
  });
  if (!response.ok) throw new Error("Unable to generate a question. Please try again.");
  return response.json();
}

async function mockEvaluateAnswer(question_id, answer_text, question_text, expected_concepts) {
  const response = await fetch("http://localhost:8000/evaluate-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_id, question_text, expected_concepts, student_answer: answer_text }),
  });
  if (!response.ok) throw new Error("Unable to evaluate your answer. Please try again.");
  return response.json();
}

async function generateSessionSummary(evaluations, weakTopics, topicsToRevise) {
  const response = await fetch("http://localhost:8000/session-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evaluations, weak_topics: weakTopics, topics_to_revise: topicsToRevise }),
  });
  if (!response.ok) throw new Error("Unable to generate the session summary. Please try again.");
  return response.json();
}

function getScoreCardStyles(score) {
  if (score == null) return null;
  if (score < 4) return { background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.4)", color:"#f87171" };
  if (score < 8) return { background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.4)", color:"#fbbf24" };
  return { background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.4)", color:"#34d399" };
}

function buildReportCard(evaluations, recommendations = []) {
  const topicStats = evaluations.reduce((acc, ev) => {
    const cur = acc[ev.topic] ?? { totalScore: 0, count: 0 };
    cur.totalScore += ev.score; cur.count += 1;
    acc[ev.topic] = cur;
    return acc;
  }, {});
  const strongTopics = [], topicsToRevise = [], weakTopics = [];
  Object.entries(topicStats).forEach(([topic, stats]) => {
    const avg = stats.totalScore / stats.count;
    if (avg >= 7) strongTopics.push(topic);
    else if (avg >= 5) topicsToRevise.push(topic);
    else weakTopics.push(topic);
  });
  const totalScore = evaluations.reduce((sum, ev) => sum + ev.score, 0);
  return {
    total_questions: evaluations.length,
    average_score: evaluations.length > 0 ? (totalScore / evaluations.length).toFixed(1) : "0.0",
    strong_topics: strongTopics,
    topics_to_revise: topicsToRevise,
    weak_topics: weakTopics,
    study_recommendations: Array.isArray(recommendations) ? recommendations : [],
  };
}

async function uploadNotes(file) { return mockUploadNotes(file); }
async function generateQuestion(sessionId, difficulty) { return mockGenerateQuestion(sessionId, difficulty); }
async function evaluateAnswer(questionId, answerText, questionText, expectedConcepts) {
  return mockEvaluateAnswer(questionId, answerText, questionText, expectedConcepts);
}

function scoreDotColor(score) {
  if (score == null) return "rgba(100,120,150,0.4)";
  if (score < 4) return "#f87171";
  if (score < 8) return "#fbbf24";
  return "#10b981";
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [questionResult, setQuestionResult] = useState(null);
  const [pendingFollowup, setPendingFollowup] = useState(null);
  const [isCurrentQuestionFollowup, setIsCurrentQuestionFollowup] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState("medium");
  const [answerText, setAnswerText] = useState("");
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [sessionEvaluations, setSessionEvaluations] = useState([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [reportCard, setReportCard] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
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
  const [questionTimer, setQuestionTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const questionTimerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    if (questionResult && !evaluationResult) {
      setQuestionTimer(0);
      setTimerActive(true);
      questionTimerRef.current = setInterval(() => setQuestionTimer((s) => s + 1), 1000);
    } else {
      setTimerActive(false);
    }
    return () => { if (questionTimerRef.current) clearInterval(questionTimerRef.current); };
  }, [questionResult?.question_id]);

  useEffect(() => {
    if (evaluationResult && questionTimerRef.current) {
      clearInterval(questionTimerRef.current);
      questionTimerRef.current = null;
      setTimerActive(false);
    }
  }, [evaluationResult]);

  function speakText(text) {
    if (typeof window === "undefined" || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file); setUploadError(""); setQuestionError(""); setEvaluationError("");
    setUploadResult(null); setQuestionResult(null); setPendingFollowup(null);
    setIsCurrentQuestionFollowup(false); setAnswerText(""); setEvaluationResult(null);
    setSessionEvaluations([]); setSessionEnded(false); setReportCard(null);
    setIsGeneratingSummary(false); setQuestionTimer(0); setTimerActive(false);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError(""); setQuestionError(""); setEvaluationError("");
    setUploadResult(null); setQuestionResult(null); setPendingFollowup(null);
    setIsCurrentQuestionFollowup(false); setAnswerText(""); setEvaluationResult(null);
    setSessionEvaluations([]); setSessionEnded(false); setReportCard(null);
    setIsGeneratingSummary(false); setQuestionTimer(0); setTimerActive(false);
    try { setUploadResult(await uploadNotes(selectedFile)); }
    catch (error) { setUploadError(error instanceof Error ? error.message : "Unable to upload notes. Please try again."); }
    finally { setIsUploading(false); }
  }

  async function handleGenerateQuestion() {
    if (!uploadResult?.session_id) return;
    if (pendingFollowup) {
      const followupQuestion = {
        question_id: `followup_${Date.now()}`,
        question_text: pendingFollowup.hint,
        topic: `${pendingFollowup.parent_topic} (follow-up)`,
        difficulty: pendingFollowup.parent_difficulty,
        expected_concepts: questionResult?.expected_concepts ?? [],
        question_type: "conceptual",
      };
      setQuestionError(""); setQuestionResult(followupQuestion);
      setIsCurrentQuestionFollowup(true); setPendingFollowup(null);
      setAnswerText(""); setEvaluationResult(null); setEvaluationError("");
      if (autoPlay) speakText(followupQuestion.question_text);
      return;
    }
    setIsGenerating(true);
    setQuestionError(""); setQuestionResult(null); setPendingFollowup(null);
    setIsCurrentQuestionFollowup(false); setEvaluationError(""); setAnswerText(""); setEvaluationResult(null);
    try {
      const result = await generateQuestion(uploadResult.session_id, selectedDifficulty);
      setQuestionResult(result); setIsCurrentQuestionFollowup(false);
      if (autoPlay) speakText(result.question_text);
    }
    catch (error) { setQuestionError(error instanceof Error ? error.message : "Unable to generate a question. Please try again."); }
    finally { setIsGenerating(false); }
  }

  async function handleEvaluateAnswer() {
    if (!questionResult?.question_id) return;
    setIsEvaluating(true); setEvaluationError(""); setEvaluationResult(null);
    try {
      const result = await evaluateAnswer(
        questionResult.question_id, answerText, questionResult.question_text, questionResult.expected_concepts
      );
      setEvaluationResult(result);
      setSessionEvaluations((prev) => [...prev, {
        question_text: questionResult.question_text,
        topic: questionResult.topic.replace(" (follow-up)", ""),
        student_answer: answerText,
        score: result.score,
        concepts_missed: result.concepts_missed,
        response_time: questionTimer,
      }]);
      if (isCurrentQuestionFollowup) {
        setPendingFollowup(null);
      } else if (result.needs_followup === true && result.followup_hint) {
        setPendingFollowup({ hint: result.followup_hint, parent_topic: questionResult.topic, parent_difficulty: questionResult.difficulty });
      } else {
        setPendingFollowup(null);
      }
    }
    catch (error) { setEvaluationError(error instanceof Error ? error.message : "Unable to evaluate your answer. Please try again."); }
    finally { setIsEvaluating(false); }
  }

  async function handleEndSession() {
    if (sessionEvaluations.length < 1 || isGeneratingSummary) return;
    setIsGeneratingSummary(true); setEvaluationError("");
    const basicReportCard = buildReportCard(sessionEvaluations);
    try {
      const response = await generateSessionSummary(sessionEvaluations, basicReportCard.weak_topics, basicReportCard.topics_to_revise);
      setReportCard(buildReportCard(sessionEvaluations, response.recommendations));
      setSessionEnded(true);
    } catch (error) {
      setEvaluationError(error instanceof Error ? error.message : "Unable to generate the session summary.");
      setReportCard(basicReportCard); setSessionEnded(true);
    } finally { setIsGeneratingSummary(false); }
  }

  function handleStartNewSession() {
    stopSpeaking();
    if (questionTimerRef.current) { clearInterval(questionTimerRef.current); questionTimerRef.current = null; }
    setSessionEvaluations([]); setSessionEnded(false); setReportCard(null);
    setSelectedFile(null); setUploadResult(null); setQuestionResult(null);
    setAnswerText(""); setEvaluationResult(null); setPendingFollowup(null);
    setIsCurrentQuestionFollowup(false); setUploadError(""); setQuestionError("");
    setEvaluationError(""); setIsGeneratingSummary(false); setIsRecording(false);
    setIsTranscribing(false); setRecordingSeconds(0); setQuestionTimer(0); setTimerActive(false);
    audioChunksRef.current = [];
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }

  async function handleTranscribe() {
    setIsTranscribing(true); setEvaluationError("");
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      const response = await fetch("http://localhost:8000/transcribe-audio", { method: "POST", body: formData });
      if (!response.ok) { setEvaluationError("Could not transcribe. Please try again or type your answer."); return; }
      const data = await response.json();
      setAnswerText(data.transcription);
    } catch { setEvaluationError("Could not transcribe. Please try again or type your answer."); }
    finally { setIsTranscribing(false); }
  }

  async function handleRecordToggle() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
      setIsRecording(false); return;
    }
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setEvaluationError("Microphone access denied. Please allow mic permission or type your answer."); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorderOptions = MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : undefined;
      const mediaRecorder = recorderOptions ? new MediaRecorder(stream, recorderOptions) : new MediaRecorder(stream);
      audioChunksRef.current = []; mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => { void handleTranscribe(); };
      mediaRecorder.start();
      setEvaluationError(""); setIsRecording(true); setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      setEvaluationError("Microphone access denied. Please allow mic permission or type your answer.");
    }
  }
    // ── derived values ──
  const previewText = uploadResult?.preview ? uploadResult.preview.slice(0, 200) : "";
  const trimmedAnswerLength = answerText.trim().length;
  const canSubmitAnswer = !!questionResult?.question_id && trimmedAnswerLength >= 10 && !isEvaluating && !isRecording && !isTranscribing;
  const canEndSession = sessionEvaluations.length >= 1 && !isGeneratingSummary;
  const formattedRecordingTime = `${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`;
  const formattedQuestionTime = `${Math.floor(questionTimer / 60)}:${String(questionTimer % 60).padStart(2, "0")}`;
  const recordingStatusText = isTranscribing ? "Transcribing..." : isRecording ? `Recording... ${formattedRecordingTime}` : questionResult?.question_id ? "Click record and speak your answer" : "";
  const scoreCardStyles = getScoreCardStyles(evaluationResult?.score ?? null);
  const reportScoreStyles = getScoreCardStyles(reportCard ? Number(reportCard.average_score) : null);
  const sessionAvg = sessionEvaluations.length > 0
    ? (sessionEvaluations.reduce((s, e) => s + e.score, 0) / sessionEvaluations.length).toFixed(1)
    : null;

  const difficultyConfig = [
    { label:"Easy",   value:"easy",   color:"#10b981", glow:"rgba(16,185,129,0.3)"  },
    { label:"Medium", value:"medium", color:"#fbbf24", glow:"rgba(251,191,36,0.3)"  },
    { label:"Hard",   value:"hard",   color:"#f87171", glow:"rgba(248,113,113,0.3)" },
  ];

  const mono = "'JetBrains Mono','Courier New',monospace";
  const orbitron = "'Orbitron',sans-serif";

  const card = (accent, bg) => ({
    position:"relative", borderRadius:16, padding:24, display:"grid", gap:20,
    background: bg ?? "rgba(8,14,32,0.75)",
    backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
    border:`1px solid ${accent}30`, boxShadow:`0 0 40px ${accent}08`,
  });

  const corners = (accent) =>
    [{top:0,left:0,borderTop:`1px solid ${accent}`,borderLeft:`1px solid ${accent}`},
     {top:0,right:0,borderTop:`1px solid ${accent}`,borderRight:`1px solid ${accent}`},
     {bottom:0,left:0,borderBottom:`1px solid ${accent}`,borderLeft:`1px solid ${accent}`},
     {bottom:0,right:0,borderBottom:`1px solid ${accent}`,borderRight:`1px solid ${accent}`}]
    .map((s,i) => <div key={i} style={{ position:"absolute", width:16, height:16, ...s }} />);

  const stageLabel = (accent) => ({
    fontSize:11, fontWeight:700, letterSpacing:"0.2em", textTransform:"uppercase",
    fontFamily:mono, color:accent, background:`${accent}14`, border:`1px solid ${accent}40`,
    padding:"2px 10px", borderRadius:4, display:"inline-block",
  });

  const neonBtn = (accent, disabled) => ({
    padding:"11px 22px", borderRadius:10, fontSize:12, fontWeight:700,
    letterSpacing:"0.15em", textTransform:"uppercase", fontFamily:mono,
    cursor:disabled?"not-allowed":"pointer", transition:"all 0.25s",
    background:disabled?"rgba(30,40,60,0.6)":`${accent}18`,
    border:disabled?"1px solid rgba(100,120,150,0.25)":`1px solid ${accent}60`,
    color:disabled?"rgba(100,130,160,0.5)":accent,
    boxShadow:disabled?"none":`0 0 18px ${accent}18`,
  });

  const pill = (color, bg, border) => ({
    padding:"4px 10px", borderRadius:999, fontSize:12, fontWeight:700,
    fontFamily:mono, background:bg, border:`1px solid ${border}`, color,
    display:"inline-block",
  });

  const errorBox = {
    padding:14, borderRadius:10, fontSize:13, fontFamily:mono,
    background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.35)", color:"#f87171",
  };

  const generateBtnAccent = pendingFollowup ? "#fbbf24" : "#a855f7";
  const generateBtnLabel = isGenerating ? "◌ SYNTHESIZING..."
    : pendingFollowup ? "🔁 ASK FOLLOW-UP"
    : questionResult ? "▶ NEXT QUESTION"
    : "▶ GENERATE QUESTION";

  return (
    <main style={{ minHeight:"100vh", background:"transparent", color:"rgba(210,225,245,0.9)", padding:"56px 20px", fontFamily:"'Inter',Arial,sans-serif" }}>
      <div style={{ maxWidth:760, margin:"0 auto", display:"grid", gap:28 }}>

        {/* HEADER */}
        <header style={{ textAlign:"center", display:"grid", gap:12 }}>
          <p style={{ margin:0, fontSize:11, fontWeight:700, letterSpacing:"0.3em", textTransform:"uppercase", fontFamily:mono, color:"#00d4ff" }}>◈ Offline AI System v2.0 ◈</p>
          <h1 style={{ margin:0, fontSize:"clamp(1.8rem,5vw,2.6rem)", fontWeight:900, fontFamily:orbitron, lineHeight:1.2, background:"linear-gradient(135deg,#00d4ff 0%,#a855f7 50%,#f472b6 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
            VIVA EXAMINER
          </h1>
          <p style={{ margin:"0 auto", fontSize:14, color:"rgba(180,200,220,0.65)", lineHeight:1.7, maxWidth:460 }}>
            Upload your study matrix and let the AI generate precision viva questions from your knowledge base.
          </p>
          <div style={{ display:"flex", justifyContent:"center", gap:12, flexWrap:"wrap" }}>
            {[["SYSTEM ONLINE","#10b981"],["AI READY","#00d4ff"],["OFFLINE MODE","#a855f7"]].map(([label,color]) => (
              <span key={label} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", borderRadius:999, fontSize:11, fontWeight:700, fontFamily:mono, background:`${color}14`, border:`1px solid ${color}40`, color }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:color, boxShadow:`0 0 6px ${color}` }} />{label}
              </span>
            ))}
          </div>
        </header>

        {/* SESSION SCORE BAR */}
        {sessionEvaluations.length > 0 && !sessionEnded && (
          <div style={{ ...card("#a855f7"), padding:"16px 20px", gap:12 }}>
            {corners("#a855f7")}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:11, fontFamily:mono, letterSpacing:"0.15em", textTransform:"uppercase", color:"rgba(168,85,247,0.6)" }}>SESSION STREAK</span>
                <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                  {sessionEvaluations.map((ev, i) => {
                    const c = scoreDotColor(ev.score);
                    return <div key={i} title={`Q${i+1}: ${ev.score}/10`} style={{ width:10, height:10, borderRadius:"50%", background:c, boxShadow:`0 0 6px ${c}` }} />;
                  })}
                  <div style={{ width:10, height:10, borderRadius:"50%", background:"rgba(168,85,247,0.15)", border:"1px dashed rgba(168,85,247,0.4)" }} />
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:900, fontFamily:orbitron, color: Number(sessionAvg) >= 7 ? "#34d399" : Number(sessionAvg) >= 5 ? "#fbbf24" : "#f87171" }}>{sessionAvg}/10</div>
                  <div style={{ fontSize:10, fontFamily:mono, color:"rgba(168,85,247,0.5)", textTransform:"uppercase", letterSpacing:"0.1em" }}>avg score</div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:900, fontFamily:orbitron, color:"rgba(200,160,255,0.9)" }}>{sessionEvaluations.length}</div>
                  <div style={{ fontSize:10, fontFamily:mono, color:"rgba(168,85,247,0.5)", textTransform:"uppercase", letterSpacing:"0.1em" }}>answered</div>
                </div>
                <button type="button" onClick={handleEndSession} disabled={!canEndSession}
                  style={{ padding:"8px 16px", borderRadius:999, fontSize:11, fontWeight:700, letterSpacing:"0.15em", textTransform:"uppercase", fontFamily:mono, cursor:canEndSession?"pointer":"not-allowed", background:canEndSession?"rgba(239,68,68,0.15)":"rgba(30,40,60,0.6)", border:canEndSession?"1px solid rgba(239,68,68,0.5)":"1px solid rgba(100,120,150,0.2)", color:canEndSession?"#f87171":"rgba(100,130,160,0.5)", boxShadow:canEndSession?"0 0 16px rgba(239,68,68,0.2)":"none" }}>
                  {isGeneratingSummary ? "◌ LOADING..." : "⏹ END SESSION"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SESSION REPORT CARD */}
        {sessionEnded && reportCard ? (
          <section style={{ ...card("#a855f7", "rgba(10,6,24,0.85)"), boxShadow:"0 0 60px rgba(168,85,247,0.1)" }}>
            {corners("#a855f7")}
              <div style={{ textAlign:"center" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:8 }}>
                <span style={stageLabel("#a855f7")}>SESSION REPORT</span>
              </div>
              <h2 style={{ margin:0, fontSize:"1.2rem", fontWeight:700, fontFamily:orbitron, color:"#f0e0ff", letterSpacing:"0.05em" }}>NEURAL PERFORMANCE MATRIX</h2>
              <p style={{ margin:"4px 0 0", fontSize:13, color:"rgba(180,150,220,0.6)" }}>Review your performance across the full practice session.</p>
            </div>

            {evaluationError && <div style={errorBox}>⚠ {evaluationError}</div>}

            <div style={{ ...(reportScoreStyles ?? { background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.35)", color:"#c084fc" }), padding:24, borderRadius:14, display:"grid", gap:6, textAlign:"center", justifyItems:"center" }}>
              <strong style={{ fontSize:"3rem", lineHeight:1, fontFamily:orbitron, fontWeight:900, display:"block" }}>{reportCard.average_score}/10</strong>
              <span style={{ fontSize:13, fontWeight:600, fontFamily:mono, opacity:0.75 }}>Questions answered: {reportCard.total_questions}</span>
            </div>

             <div style={{ display:"grid", gap:8, justifyItems:"center", textAlign:"center" }}>
              <p style={{ margin:0, fontSize:11, fontFamily:mono, letterSpacing:"0.12em", textTransform:"uppercase", color:"rgba(168,85,247,0.5)" }}>Score History</p>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end", justifyContent:"center" }}>
                {sessionEvaluations.map((ev, i) => {
                  const c = scoreDotColor(ev.score);
                  return (
                    <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                      <div style={{ width:12, height:12, borderRadius:"50%", background:c, boxShadow:`0 0 8px ${c}` }} />
                      <span style={{ fontSize:9, fontFamily:mono, color:"rgba(180,180,200,0.5)" }}>{ev.score}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {sessionEvaluations.some((ev) => ev.response_time != null) && (
              <div style={{ display:"grid", gap:8, justifyItems:"center", textAlign:"center" }}>
                <p style={{ margin:0, fontSize:11, fontFamily:mono, letterSpacing:"0.12em", textTransform:"uppercase", color:"rgba(0,212,255,0.5)" }}>Response Times</p>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
                  {sessionEvaluations.map((ev, i) => (
                    <span key={i} style={pill("rgba(0,212,255,0.7)","rgba(0,212,255,0.06)","rgba(0,212,255,0.2)")}>
                      Q{i+1}: {Math.floor(ev.response_time/60)}:{String(ev.response_time%60).padStart(2,"0")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {reportCard.strong_topics.length > 0 && (
              <div style={{ display:"grid", gap:10 }}>
                <span style={{ fontSize:11, fontWeight:700, fontFamily:mono, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(52,211,153,0.8)" }}>✓ Strong Topics</span>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {reportCard.strong_topics.map((t) => <span key={t} style={pill("#34d399","rgba(16,185,129,0.12)","rgba(16,185,129,0.4)")}>{t}</span>)}
                </div>
              </div>
            )}

            {reportCard.topics_to_revise.length > 0 && (
              <div style={{ display:"grid", gap:10, justifyItems:"center", textAlign:"center" }}>
                <span style={{ fontSize:11, fontWeight:700, fontFamily:mono, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(251,191,36,0.8)" }}>◈ Topics to Revise</span>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
                  {reportCard.topics_to_revise.map((t) => <span key={t} style={pill("#fbbf24","rgba(245,158,11,0.12)","rgba(245,158,11,0.4)")}>{t}</span>)}
                </div>
              </div>
            )}

            {reportCard.weak_topics.length > 0 && (
              <div style={{ display:"grid", gap:10 }}>
                <span style={{ fontSize:11, fontWeight:700, fontFamily:mono, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(248,113,113,0.8)" }}>✗ Weak Topics</span>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {reportCard.weak_topics.map((t) => <span key={t} style={pill("#f87171","rgba(239,68,68,0.1)","rgba(239,68,68,0.4)")}>{t}</span>)}
                </div>
              </div>
            )}

            {reportCard.study_recommendations.length > 0 && (
              <div style={{ padding:18, borderRadius:14, background:"rgba(0,212,255,0.05)", border:"1px solid rgba(0,212,255,0.2)", display:"grid", gap:10 }}>
                <span style={{ fontSize:11, fontWeight:700, fontFamily:mono, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(0,212,255,0.7)" }}>◈ AI Study Recommendations</span>
                <ul style={{ margin:0, paddingLeft:20, color:"rgba(180,220,240,0.8)", lineHeight:1.9, fontSize:13, fontFamily:mono }}>
                  {reportCard.study_recommendations.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            )}

           <div style={{ display:"flex", justifyContent:"center" }}>
              <button type="button" onClick={handleStartNewSession} style={neonBtn("#00d4ff", false)}>◈ START NEW SESSION</button>
            </div>
          </section>
          ) : !sessionEnded && (
          <>
            {/* STAGE 1 — KNOWLEDGE UPLOAD */}
            <section style={card("#00d4ff")}>
              {corners("#00d4ff")}
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                  <span style={stageLabel("#00d4ff")}>STAGE 01</span>
                  <div style={{ flex:1, height:1, background:"linear-gradient(90deg,rgba(0,212,255,0.5),transparent)" }} />
                </div>
                <h2 style={{ margin:0, fontSize:"1.2rem", fontWeight:700, fontFamily:orbitron, color:"#e0f4ff", letterSpacing:"0.05em" }}>KNOWLEDGE UPLOAD</h2>
                <p style={{ margin:"4px 0 0", fontSize:13, color:"rgba(150,190,220,0.6)" }}>Select a PDF or text file to inject into the neural matrix.</p>
              </div>
              <label style={{ display:"grid", gap:8 }}>
                <span style={{ fontSize:12, fontWeight:700, fontFamily:mono, color:"rgba(0,212,255,0.7)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Select notes file</span>
                <input type="file" accept=".pdf,.txt" onChange={handleFileChange}
                  style={{ padding:12, borderRadius:10, border:"1px solid rgba(0,212,255,0.25)", background:"rgba(0,212,255,0.04)", color:"rgba(180,210,240,0.8)", fontFamily:mono, fontSize:12, cursor:"pointer" }} />
              </label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center" }}>
                <button type="button" onClick={handleUpload} disabled={!selectedFile||isUploading} style={neonBtn("#00d4ff",!selectedFile||isUploading)}>
                  {isUploading ? "◌ UPLOADING..." : "UPLOAD MATRIX"}
                </button>
                {selectedFile && <span style={{ fontSize:12, fontFamily:mono, color:"rgba(0,212,255,0.6)" }}>◈ {selectedFile.name}</span>}
              </div>
              {uploadError && <div style={errorBox}>⚠ {uploadError}</div>}
              {uploadResult && (
                <div style={{ display:"grid", gap:12, padding:18, borderRadius:12, background:"rgba(0,212,255,0.05)", border:"1px solid rgba(0,212,255,0.25)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:13, fontWeight:700, fontFamily:mono, color:"#00d4ff" }}>✓ UPLOAD SUCCESSFUL</span>
                    <span style={pill("#10b981","rgba(16,185,129,0.1)","rgba(16,185,129,0.3)")}>{uploadResult.char_count?.toLocaleString()} CHARS</span>
                  </div>
                  {previewText && (
                    <div style={{ display:"grid", gap:6 }}>
                      <span style={{ fontSize:10, fontFamily:mono, letterSpacing:"0.1em", color:"rgba(0,212,255,0.45)", textTransform:"uppercase" }}>Content Preview</span>
                      <p style={{ margin:0, fontSize:12, fontFamily:mono, lineHeight:1.7, color:"rgba(180,210,240,0.7)" }}>{previewText}</p>
                    </div>
                  )}
                </div>
              )}
            </section>
            {/* STAGE 2 — NEURAL SYNTHESIS */}
            <section style={card("#a855f7", "rgba(12,8,32,0.75)")}>
              {corners("#a855f7")}
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                  <span style={stageLabel("#a855f7")}>STAGE 02</span>
                  <div style={{ flex:1, height:1, background:"linear-gradient(90deg,rgba(168,85,247,0.5),transparent)" }} />
                </div>
                <h2 style={{ margin:0, fontSize:"1.2rem", fontWeight:700, fontFamily:orbitron, color:"#f0e0ff", letterSpacing:"0.05em" }}>NEURAL SYNTHESIS</h2>
                <p style={{ margin:"4px 0 0", fontSize:13, color:"rgba(180,150,220,0.6)" }}>Generate a viva-style question using the uploaded notes session.</p>
              </div>
              {!pendingFollowup && (
                <div style={{ display:"grid", gap:8 }}>
                  <p style={{ margin:0, fontSize:11, fontFamily:mono, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(168,85,247,0.55)" }}>Difficulty Level</p>
                  <div style={{ display:"flex", gap:8 }}>
                    {difficultyConfig.map(({ label, value, color, glow }) => (
                      <button key={value} type="button" onClick={() => setSelectedDifficulty(value)}
                        style={{ padding:"8px 18px", borderRadius:8, fontSize:11, fontWeight:700, letterSpacing:"0.15em", textTransform:"uppercase", fontFamily:mono, cursor:"pointer", transition:"all 0.2s", background: selectedDifficulty === value ? `${color}22` : "rgba(255,255,255,0.03)", border: selectedDifficulty === value ? `1px solid ${color}` : "1px solid rgba(168,85,247,0.2)", color: selectedDifficulty === value ? color : "rgba(160,130,200,0.5)", boxShadow: selectedDifficulty === value ? `0 0 16px ${glow}` : "none", transform: selectedDifficulty === value ? "translateY(-1px)" : "none" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {pendingFollowup && (
                <div style={{ padding:"12px 16px", borderRadius:10, background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.4)", color:"#fbbf24", fontSize:13, fontFamily:mono }}>
                  ◈ Follow-up ready — the AI wants to probe your previous answer deeper.
                </div>
              )}
              <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between" }}>
                <label style={{ display:"inline-flex", alignItems:"center", gap:10, padding:"8px 16px", borderRadius:999, border:"1px solid rgba(168,85,247,0.35)", background:"rgba(168,85,247,0.07)", color:"rgba(200,160,255,0.85)", fontWeight:600, fontSize:13, cursor:"pointer" }}>
                  <input type="checkbox" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} style={{ margin:0, accentColor:"#a855f7" }} />
                  <span>Auto-play questions</span>
                </label>
                <div style={{ display:"flex", gap:10 }}>
                  {questionResult && !isSpeaking && (
                    <button type="button" onClick={() => speakText(questionResult.question_text)} style={neonBtn("#10b981",false)}>🔊 LISTEN</button>
                  )}
                  {isSpeaking && (
                    <button type="button" onClick={stopSpeaking} style={neonBtn("#f87171",false)}>⏹ STOP</button>
                  )}
                </div>
              </div>
              <div>
                <button type="button" onClick={handleGenerateQuestion} disabled={!uploadResult?.session_id||isGenerating}
                  style={{ ...neonBtn(generateBtnAccent, !uploadResult?.session_id||isGenerating), ...(pendingFollowup && uploadResult?.session_id && !isGenerating ? { boxShadow:"0 0 24px rgba(245,158,11,0.3),0 0 48px rgba(124,58,237,0.15)" } : {}) }}>
                  {generateBtnLabel}
                </button>
              </div>
              {questionError && <div style={errorBox}>⚠ {questionError}</div>}
              {questionResult && (
                <div style={{ display:"grid", gap:14, padding:20, borderRadius:12, background:"rgba(168,85,247,0.05)", border:"1px solid rgba(168,85,247,0.28)" }}>
                  {isCurrentQuestionFollowup && (
                    <div style={{ padding:"10px 14px", borderRadius:10, background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.35)", color:"#fbbf24", fontSize:13, fontFamily:mono, fontWeight:600 }}>
                      ↳ Follow-up — probing your previous answer.
                    </div>
                  )}
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", gap:8 }}>
                      <span style={pill("#c084fc","rgba(168,85,247,0.14)","rgba(168,85,247,0.35)")}>{questionResult.topic}</span>
                      <span style={pill("#34d399","rgba(16,185,129,0.1)","rgba(16,185,129,0.35)")}>{questionResult.difficulty?.toUpperCase()}</span>
                    </div>
                    {timerActive && (
                      <span style={{ fontSize:12, fontFamily:mono, color:"rgba(0,212,255,0.6)", background:"rgba(0,212,255,0.06)", border:"1px solid rgba(0,212,255,0.2)", padding:"3px 10px", borderRadius:6 }}>
                        ⏱ {formattedQuestionTime}
                      </span>
                    )}
                  </div>
                  <p style={{ margin:0, fontSize:"1.35rem", fontWeight:600, lineHeight:1.6, color:"#f0e8ff" }}>{questionResult.question_text}</p>
                </div>
              )}
            </section>
            {/* STAGE 3 — ANSWER EVALUATION */}
            <section style={{ ...card("#10b981"), background:"rgba(4,18,14,0.75)" }}>
              {corners("#10b981")}
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                  <span style={stageLabel("#10b981")}>STAGE 03</span>
                  <div style={{ flex:1, height:1, background:"linear-gradient(90deg,rgba(16,185,129,0.5),transparent)" }} />
                </div>
                <h2 style={{ margin:0, fontSize:"1.2rem", fontWeight:700, fontFamily:orbitron, color:"#e0fff4", letterSpacing:"0.05em" }}>ANSWER EVALUATION</h2>
                <p style={{ margin:"4px 0 0", fontSize:13, color:"rgba(130,200,170,0.6)" }}>Record or write your answer, then submit for AI evaluation feedback.</p>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                <button type="button" onClick={handleRecordToggle} disabled={isTranscribing}
                  style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"11px 20px", borderRadius:10, fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:mono, cursor:isTranscribing?"not-allowed":"pointer", transition:"all 0.25s", background:isRecording?"rgba(239,68,68,0.14)":"rgba(16,185,129,0.1)", border:isRecording?"1px solid rgba(239,68,68,0.5)":"1px solid rgba(16,185,129,0.4)", color:isRecording?"#f87171":"#34d399", boxShadow:isRecording?"0 0 18px rgba(239,68,68,0.18)":"0 0 18px rgba(16,185,129,0.12)", opacity:isTranscribing?0.6:1 }}>
                  <span aria-hidden="true" style={{ width:10, height:10, borderRadius:"50%", background:isRecording?"#f87171":"#34d399", boxShadow:isRecording?"0 0 0 5px rgba(248,113,113,0.2)":"none", transition:"box-shadow 0.3s" }} />
                  {isRecording ? "⏹ STOP" : "🎙 RECORD"}
                </button>
                <span style={{ fontSize:13, fontFamily:mono, color:isRecording?"#f87171":"rgba(100,160,140,0.7)", fontWeight:isRecording||isTranscribing?600:400, minHeight:24 }}>
                  {recordingStatusText}
                </span>
              </div>
              <label style={{ display:"grid", gap:8 }}>
                <span style={{ fontSize:12, fontWeight:700, fontFamily:mono, color:"rgba(16,185,129,0.7)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Your Answer</span>
                <textarea rows={6} placeholder="Type your answer here..." value={answerText} onChange={(e) => setAnswerText(e.target.value)}
                  style={{ width:"100%", padding:14, borderRadius:10, border:"1px solid rgba(16,185,129,0.25)", background:"rgba(16,185,129,0.04)", color:"rgba(200,240,220,0.85)", resize:"vertical", fontFamily:mono, fontSize:13, lineHeight:1.7, boxSizing:"border-box", outline:"none" }} />
              </label>
              <div>
                <button type="button" onClick={handleEvaluateAnswer} disabled={!canSubmitAnswer} style={neonBtn("#10b981",!canSubmitAnswer)}>
                  {isEvaluating ? "◌ EVALUATING..." : "SUBMIT ANSWER"}
                </button>
              </div>
              {evaluationError && <div style={errorBox}>⚠ {evaluationError}</div>}
              {evaluationResult && scoreCardStyles && (
                <div style={{ display:"grid", gap:16, padding:20, borderRadius:12, background:"rgba(16,185,129,0.04)", border:"1px solid rgba(16,185,129,0.2)" }}>
                  <div style={{ ...scoreCardStyles, padding:18, borderRadius:12, display:"grid", gap:8 }}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                      <strong style={{ fontSize:"2.2rem", lineHeight:1, fontFamily:orbitron, fontWeight:900 }}>{evaluationResult.score}/10</strong>
                      <span style={pill("rgba(0,212,255,0.8)","rgba(0,212,255,0.06)","rgba(0,212,255,0.25)")}>⏱ {formattedQuestionTime}</span>
                    </div>
                    <p style={{ margin:0, lineHeight:1.7, fontSize:14 }}>{evaluationResult.feedback}</p>
                  </div>
                  <div style={{ display:"grid", gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, fontFamily:mono, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(52,211,153,0.7)" }}>Concepts Covered</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                      {evaluationResult.concepts_covered.map((c) => (
                        <span key={c} style={pill("#34d399","rgba(16,185,129,0.12)","rgba(16,185,129,0.35)")}>{c}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:"grid", gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, fontFamily:mono, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(248,113,113,0.7)" }}>Concepts Missed</span>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                      {evaluationResult.concepts_missed.map((c) => (
                        <span key={c} style={pill("#f87171","rgba(239,68,68,0.1)","rgba(239,68,68,0.35)")}>{c}</span>
                      ))}
                    </div>
                  </div>
                  {evaluationResult.needs_followup && (
                    <div style={{ padding:14, borderRadius:10, background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.35)", color:"#fbbf24", fontSize:13, fontFamily:mono }}>
                      ◈ {evaluationResult.followup_hint}
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}
        <p style={{ textAlign:"center", fontSize:11, fontFamily:mono, letterSpacing:"0.15em", color:"rgba(80,110,150,0.4)", paddingBottom:16 }}>
          ◈ NEURAL EXAMINATION SYSTEM ◈ OFFLINE MODE ◈
        </p>
      </div>
    </main>
  );
}