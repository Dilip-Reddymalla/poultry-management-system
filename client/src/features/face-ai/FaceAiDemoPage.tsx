import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  analyzeDemoFrame,
  checkFaceAiHealth,
  clearDemoSession,
  getDemoSession,
  type DemoAnalysisResponse,
  type DemoSessionInfo,
  type FaceAiHealthStatus,
} from "../../api/resources.js";
import { useAuth } from "../../auth/use-auth.js";
import {
  AnalyticsIcon,
  EggIcon,
  SparklesIcon,
} from "../../components/icons.js";
import { Button } from "../../components/ui.js";
import "./FaceAiDemoPage.css";

export function FaceAiDemoPage(): React.ReactElement {
  const { user } = useAuth();

  // Mode: 'upload' | 'camera'
  const [activeTab, setActiveTab] = useState<"upload" | "camera">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Webcam state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Enrollment options
  const [shouldEnroll, setShouldEnroll] = useState(false);
  const [enrollLabel, setEnrollLabel] = useState("");

  // Analysis state & results
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DemoAnalysisResponse | null>(null);

  // Status & limits
  const [health, setHealth] = useState<FaceAiHealthStatus | null>(null);
  const [sessionInfo, setSessionInfo] = useState<DemoSessionInfo | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Consistent session ID stored in sessionStorage for the browser tab
  const [sessionId] = useState<string>(() => {
    let id = sessionStorage.getItem("poultryops_demo_session");
    if (!id) {
      id = "demo_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
      sessionStorage.setItem("poultryops_demo_session", id);
    }
    return id;
  });

  // Rate limit countdown effect
  useEffect(() => {
    if (rateLimitSeconds === null || rateLimitSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  // Load health & session on mount
  useEffect(() => {
    let active = true;

    async function loadInitial() {
      try {
        const [h, s] = await Promise.all([
          checkFaceAiHealth().catch(() => null),
          getDemoSession(sessionId).catch(() => null),
        ]);
        if (active) {
          if (h) setHealth(h);
          if (s) setSessionInfo(s);
        }
      } catch {
        // Soft fail
      }
    }

    loadInitial();
    return () => {
      active = false;
    };
  }, [sessionId]);

  // Camera start / stop handlers
  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      setCameraError(err?.message || "Could not access camera. Please allow permission or upload an image.");
      setCameraActive(false);
    }
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  // Handle Tab Switch
  function handleTabChange(tab: "upload" | "camera") {
    setActiveTab(tab);
    if (tab === "upload") {
      stopCamera();
    } else {
      startCamera();
    }
  }

  // File drop / select
  function handleFileSelect(file: File) {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setAnalysisResult(null);
    setErrorMessage(null);
    setBusyMessage(null);
  }

  // Capture frame from webcam
  function captureFrameFromCamera(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!videoRef.current) return resolve(null);
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });
  }

  // Trigger analysis
  async function handleAnalyze() {
    setErrorMessage(null);
    setBusyMessage(null);

    let blobToAnalyze: Blob | File | null = null;
    let filename = "capture.jpg";

    if (activeTab === "camera") {
      blobToAnalyze = await captureFrameFromCamera();
      if (!blobToAnalyze) {
        setErrorMessage("Camera feed not ready to capture.");
        return;
      }
      setPreviewUrl(URL.createObjectURL(blobToAnalyze));
    } else {
      if (!selectedFile) {
        setErrorMessage("Please choose or drag an image first.");
        return;
      }
      blobToAnalyze = selectedFile;
      filename = selectedFile.name;
    }

    setAnalyzing(true);
    try {
      const res = await analyzeDemoFrame(
        blobToAnalyze,
        filename,
        shouldEnroll ? enrollLabel || "Demo Test Subject" : undefined,
        sessionId
      );

      setAnalysisResult(res);

      // Refresh demo session faces
      const updatedSession = await getDemoSession(sessionId).catch(() => null);
      if (updatedSession) setSessionInfo(updatedSession);

      if (shouldEnroll) {
        setEnrollLabel("");
        setShouldEnroll(false);
      }
    } catch (err: any) {
      if (err?.isBusy) {
        setBusyMessage("Pipeline is currently processing another frame. Please retry in 2 seconds.");
      } else if (err?.isRateLimited) {
        setRateLimitSeconds(err.retryAfter || 60);
      } else {
        setErrorMessage(err.message || "Analysis request failed.");
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleClearSession() {
    try {
      await clearDemoSession(sessionId);
      const updated = await getDemoSession(sessionId).catch(() => null);
      if (updated) setSessionInfo(updated);
      setAnalysisResult(null);
    } catch {
      // ignore
    }
  }

  return (
    <div className="face-demo-page">
      {/* Navigation Header */}
      <header className="face-demo-nav">
        <Link to="/" className="face-demo-nav__brand">
          <EggIcon style={{ width: 22, height: 22, color: "var(--clay)" }} />
          <span>
            Poultry<strong>Ops</strong>
          </span>
        </Link>
        <div className="face-demo-nav__actions">
          <Link to="/about">
            <Button variant="secondary">
              About Project
            </Button>
          </Link>
          <Link to="/analytics">
            <Button variant="secondary">
              <AnalyticsIcon style={{ width: 14, height: 14, marginRight: 6 }} />
              Live Analytics
            </Button>
          </Link>
          {user ? (
            <Link to="/dashboard">
              <Button variant="primary">
                Dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button variant="primary">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="face-demo-container">
        {/* Hero Section */}
        <section className="face-demo-hero">
          <div className="face-demo-hero__top">
            <div className="face-demo-hero__badge">
              <SparklesIcon style={{ width: 14, height: 14, marginRight: 4 }} />
              Interactive AI Sandbox
            </div>
            <div className="face-demo-hero__status">
              <span
                className={`face-demo-hero__status-dot ${
                  health?.serviceStatus === "online" ? "status--online" : "status--offline"
                }`}
              />
              <span>
                {health?.serviceStatus === "online"
                  ? "YuNet + MiniFASNet Online"
                  : "Engine Starting / Offline"}
              </span>
            </div>
          </div>

          <h1 className="face-demo-hero__title">EdgeFace Biometric Verification Sandbox</h1>
          <p className="face-demo-hero__desc">
            Test the live facial recognition pipeline: 5-point landmark detection, MiniFASNet anti-spoof
            liveness discrimination, and vector similarity matching directly from your browser.
          </p>

          <div className="face-demo-rules-bar">
            <div className="face-demo-rule-item">
              <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span><strong>Zero Persistence:</strong> Photos & embeddings never saved to database or Cloudinary.</span>
            </div>
            <div className="face-demo-rule-item">
              <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>In-Memory TTL:</strong> Demo faces expire from server RAM after 10 minutes.</span>
            </div>
            <div className="face-demo-rule-item">
              <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>
                <strong>Allowance:</strong> {user ? "Authenticated (60 req/min)" : "Public Guest (20 req/min)"}
              </span>
            </div>
          </div>
        </section>

        {/* Rate limit / Busy alert banners */}
        {busyMessage && (
          <div className="face-demo-alert face-demo-alert--busy">
            <span style={{ fontSize: "1.2rem" }}>⏳</span>
            <span>{busyMessage}</span>
          </div>
        )}

        {rateLimitSeconds !== null && (
          <div className="face-demo-alert face-demo-alert--ratelimit">
            <span style={{ fontSize: "1.2rem" }}>⏱️</span>
            <span>
              <strong>Rate limit reached:</strong> You can submit another analysis in{" "}
              <strong>{rateLimitSeconds}s</strong>. {!user && "Sign in for higher limits (60/min)."}
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="face-demo-alert face-demo-alert--ratelimit">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Interactive Workspace Grid */}
        <div className="face-demo-layout">
          {/* Left Column: Input Controls */}
          <div className="face-demo-panel">
            <div className="face-demo-panel__title">
              <span>Capture or Upload Frame</span>
              {previewUrl && (
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--rust)",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setAnalysisResult(null);
                  }}
                >
                  Clear Photo
                </button>
              )}
            </div>

            {/* Input Tabs */}
            <div className="face-demo-tabs">
              <button
                type="button"
                className={`face-demo-tab ${activeTab === "upload" ? "face-demo-tab--active" : ""}`}
                onClick={() => handleTabChange("upload")}
              >
                Upload Photo
              </button>
              <button
                type="button"
                className={`face-demo-tab ${activeTab === "camera" ? "face-demo-tab--active" : ""}`}
                onClick={() => handleTabChange("camera")}
              >
                Live Webcam
              </button>
            </div>

            {/* Upload Area */}
            {activeTab === "upload" && (
              <div
                className="face-demo-dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/jpeg,image/png,image/webp";
                  input.onchange = (e: any) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  };
                  input.click();
                }}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="face-demo-preview" />
                ) : (
                  <div>
                    <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📸</div>
                    <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>
                      Drop an image here or click to browse
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--ink-faint)" }}>
                      Supports JPG, PNG, WEBP (Max 5MB)
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Camera Area */}
            {activeTab === "camera" && (
              <div className="face-demo-video-wrap">
                <video ref={videoRef} autoPlay playsInline muted className="face-demo-video" />
                {!cameraActive && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      background: "rgba(0,0,0,0.7)",
                      padding: "1rem",
                      textAlign: "center",
                    }}
                  >
                    <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem" }}>
                      {cameraError || "Camera inactive. Click below to start webcam."}
                    </p>
                    <Button variant="secondary" onClick={startCamera}>
                      Activate Camera
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* In-Memory Temporary Face Enrollment */}
            <div className="face-demo-enroll-box">
              <div className="face-demo-enroll-row">
                <input
                  type="checkbox"
                  id="enroll-check"
                  checked={shouldEnroll}
                  onChange={(e) => setShouldEnroll(e.target.checked)}
                />
                <label htmlFor="enroll-check">Enroll face into temporary session memory</label>
              </div>
              {shouldEnroll && (
                <input
                  type="text"
                  placeholder="Subject label (e.g., Jane Doe, Recruiter Test)"
                  value={enrollLabel}
                  onChange={(e) => setEnrollLabel(e.target.value)}
                  className="face-demo-enroll-input"
                  maxLength={40}
                />
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <Button
                variant="primary"
                style={{ flex: 1 }}
                disabled={
                  analyzing ||
                  rateLimitSeconds !== null ||
                  (activeTab === "upload" && !selectedFile) ||
                  (activeTab === "camera" && !cameraActive)
                }
                onClick={handleAnalyze}
              >
                {analyzing ? "Analyzing AI Pipeline..." : "Run Face AI Pipeline"}
              </Button>
            </div>

            {/* Enrolled Test Subjects Badge */}
            {sessionInfo && sessionInfo.enrolledDemoFaces.length > 0 && (
              <div className="face-demo-session-bar">
                <div className="face-demo-session-header">
                  <span>Enrolled In-Memory Test Faces ({sessionInfo.enrolledDemoFaces.length})</span>
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#1e40af",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                    onClick={handleClearSession}
                  >
                    Clear All
                  </button>
                </div>
                <div className="face-demo-chips">
                  {sessionInfo.enrolledDemoFaces.map((f) => (
                    <span key={f.id} className="face-demo-chip">
                      👤 {f.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Pipeline Inspection & Results */}
          <div className="face-demo-panel">
            <div className="face-demo-panel__title">
              <span>Pipeline Inspection Results</span>
              {analysisResult && (
                <span style={{ fontSize: "0.8rem", color: "var(--ink-faint)", fontWeight: 400 }}>
                  Inference: {analysisResult.process_time_ms}ms
                </span>
              )}
            </div>

            {!analysisResult && !analyzing && (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem 1rem",
                  color: "var(--ink-faint)",
                  fontSize: "0.9rem",
                }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>🔍</div>
                <p style={{ margin: 0, fontWeight: 500 }}>No frame analyzed yet.</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem" }}>
                  Upload a photo or capture a camera frame to inspect YuNet detection, MiniFASNet anti-spoof,
                  and EdgeFace vector similarity.
                </p>
              </div>
            )}

            {analyzing && (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--ink-soft)" }}>
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⚙️</div>
                <p style={{ margin: 0, fontWeight: 600 }}>Executing Model Inference</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "var(--ink-faint)" }}>
                  Evaluating landmarks, anti-spoof liveness, and 512-D embeddings...
                </p>
              </div>
            )}

            {analysisResult && (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--surface-sunk)",
                    borderRadius: "4px",
                    marginBottom: "16px",
                    fontSize: "0.82rem",
                  }}
                >
                  <span>
                    Faces Detected: <strong>{analysisResult.face_count}</strong>
                  </span>
                  <span>
                    Dimensions: <strong>{analysisResult.image_width} × {analysisResult.image_height}</strong>
                  </span>
                </div>

                {analysisResult.faces.map((face) => {
                  const isLive = face.liveness?.decision === "LIVE";
                  const livenessScore = face.liveness?.score
                    ? Math.round(face.liveness.score * 100)
                    : null;
                  const isUsable = face.quality?.usable !== false;
                  const qualityScore = face.quality?.quality_score
                    ? Math.round(face.quality.quality_score * 100)
                    : null;

                  return (
                    <div key={face.face_index} className="face-card">
                      <div className="face-card__header">
                        <h3 className="face-card__title">
                          <span>Face #{face.face_index + 1}</span>
                          <span
                            className={`badge ${
                              isLive ? "badge--green" : "badge--red"
                            }`}
                          >
                            {face.liveness?.decision || "ANALYZED"}
                          </span>
                        </h3>
                        <span style={{ fontSize: "0.75rem", color: "var(--ink-faint)" }}>
                          Confidence: {(face.detection_confidence * 100).toFixed(1)}%
                        </span>
                      </div>

                      <div className="face-metrics-grid">
                        <div className="metric-item">
                          <div className="metric-item__label">Liveness Score</div>
                          <div className="metric-item__val" style={{ color: isLive ? "var(--moss)" : "var(--rust)" }}>
                            {livenessScore !== null ? `${livenessScore}%` : "N/A"}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "var(--ink-faint)" }}>MiniFASNet</div>
                        </div>

                        <div className="metric-item">
                          <div className="metric-item__label">Quality Score</div>
                          <div className="metric-item__val" style={{ color: isUsable ? "var(--moss)" : "var(--clay)" }}>
                            {qualityScore !== null ? `${qualityScore}%` : "Pass"}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "var(--ink-faint)" }}>
                            {isUsable ? "Usable for Match" : "Low Quality"}
                          </div>
                        </div>

                        <div className="metric-item">
                          <div className="metric-item__label">Bounding Box</div>
                          <div className="metric-item__val" style={{ fontSize: "0.8rem" }}>
                            {face.bbox.join(", ")}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "var(--ink-faint)" }}>[x, y, w, h]</div>
                        </div>
                      </div>

                      {/* Demo Match Results */}
                      {face.demoMatches && face.demoMatches.length > 0 ? (
                        <div className="match-result-box">
                          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--moss)", marginBottom: "4px" }}>
                            ✅ Verified Session Match Found
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "var(--ink)" }}>
                            Subject: <strong>{face.demoMatches[0]?.label}</strong> ({(
                              (face.demoMatches[0]?.similarity || 0) * 100
                            ).toFixed(1)}% Cosine Similarity)
                          </div>
                        </div>
                      ) : (
                        <div className="match-result-box match-result-box--nomatch">
                          <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                            Identity: No match against current session demo subjects.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Privacy Guarantee Note */}
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--ink-faint)",
                    padding: "8px 12px",
                    background: "rgba(0,0,0,0.03)",
                    borderRadius: "4px",
                    marginTop: "12px",
                  }}
                >
                  🔒 <strong>Privacy Assurance:</strong> Raw 512-D embedding vectors were stripped by the Express proxy
                  before transmission. No image or biometric vector is stored on disk or database.
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
