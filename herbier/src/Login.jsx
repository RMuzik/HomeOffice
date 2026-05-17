import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase.js";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") {
        setError(e.message || "Connexion impossible.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
        body { margin: 0; }
      `}</style>
      <div
        style={{
          minHeight: "100vh",
          background: "#f0e8d4",
          backgroundImage: `
            radial-gradient(ellipse at 20% 50%, rgba(200,180,140,0.25) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(160,140,100,0.18) 0%, transparent 50%)
          `,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          fontFamily: "'Courier Prime', monospace",
        }}
      >
        <div
          style={{
            background: "rgba(255,253,245,0.9)",
            border: "2px solid #c8b89a",
            borderRadius: 6,
            padding: "44px 36px",
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 8px 40px rgba(30,20,10,0.15)",
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 8 }}>🌿</div>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 3,
              color: "#9a8a74",
              marginBottom: 4,
            }}
          >
            Mon
          </div>
          <h1
            style={{
              margin: "0 0 24px",
              fontFamily: "'Playfair Display', serif",
              fontSize: 38,
              color: "#3a2e1e",
              letterSpacing: 1,
            }}
          >
            Herbier
          </h1>
          <p
            style={{
              color: "#7a6a54",
              fontSize: 13,
              lineHeight: 1.6,
              marginBottom: 28,
            }}
          >
            Carnet botanique personnel.
            <br />
            Connectez-vous pour retrouver vos fleurs sur tous vos appareils.
          </p>
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              background: "#3a2e1e",
              color: "#f0e8d4",
              border: "1px solid #3a2e1e",
              borderRadius: 3,
              padding: "12px 24px",
              cursor: loading ? "wait" : "pointer",
              fontFamily: "'Courier Prime', monospace",
              fontSize: 14,
              fontWeight: "bold",
              letterSpacing: 1,
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              opacity: loading ? 0.7 : 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 7.9-11.3 7.9-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.1-5.1C33.6 6.2 29 4.4 24 4.4 13.2 4.4 4.4 13.2 4.4 24S13.2 43.6 24 43.6c11 0 19.6-8 19.6-19.6 0-1.2-.1-2.3-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.1l5.9 4.3c1.6-3.9 5.4-6.6 9.8-6.6 3 0 5.8 1.1 7.9 3l5.1-5.1C33.6 6.2 29 4.4 24 4.4c-7.5 0-14 4.3-17.7 9.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 43.6c5 0 9.5-1.7 13-4.6l-6-5.1c-1.9 1.4-4.3 2.2-7 2.2-5.3 0-9.7-3.4-11.3-8l-5.9 4.6C9.7 39.2 16.3 43.6 24 43.6z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.2-2.2 4.1-4 5.5l6 5.1c-.4.4 6.4-4.7 6.4-14.3 0-1.2-.1-2.3-.4-3.4z"
              />
            </svg>
            {loading ? "Connexion…" : "Continuer avec Google"}
          </button>
          {error && (
            <div
              style={{
                marginTop: 16,
                color: "#8b3a3a",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
