import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase.js";
import Login from "./Login.jsx";
import Herbier from "./Herbier.jsx";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u ?? null));
  }, []);

  if (user === undefined) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f0e8d4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Courier Prime', monospace",
          color: "#7a6a54",
          fontSize: 14,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        Chargement…
      </div>
    );
  }

  if (!user) return <Login />;
  return <Herbier user={user} />;
}
