import { useState, useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { auth, db, storage } from "./firebase.js";

const ETAGES = ["Plaine", "Collinéen", "Montagnard", "Subalpin", "Alpin", "Nival"];
const HABITATS = ["Alpage", "Forêt", "Tourbière", "Prairie", "Lande", "Falaise", "Bord d'eau", "Pelouse sèche", "Éboulis", "Sous-bois"];
const FAMILLES = ["Astéracées", "Fabacées", "Rosacées", "Lamiacées", "Apiacées", "Renonculacées", "Liliacées", "Orchidacées", "Brassicacées", "Géraniacées", "Primulacées", "Saxifragacées", "Autre"];
const MASSIFS = ["Alpes", "Pyrénées", "Vosges", "Jura", "Massif Central", "Corse", "Ardennes", "Bretagne", "Normandie", "Autre"];
const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const emptyForm = {
  id: null,
  photo: null,
  photoPath: null,
  nom: "",
  nomLatin: "",
  famille: "",
  familleSaisie: "",
  lieu: "",
  massif: "",
  massifSaisie: "",
  mois: "",
  annee: new Date().getFullYear(),
  etage: "",
  habitat: [],
  specificites: "",
};

function compress(dataUrl, maxW = 1200) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => res({ dataUrl: canvas.toDataURL("image/jpeg", 0.8), blob }),
        "image/jpeg",
        0.8
      );
    };
    img.src = dataUrl;
  });
}

function Tag({ label, onRemove }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "#c8b89a", color: "#3a2e1e", borderRadius: 12,
      padding: "2px 10px", fontSize: 12, fontFamily: "'Courier Prime', monospace",
    }}>
      {label}
      {onRemove && (
        <button onClick={onRemove} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#3a2e1e", fontWeight: "bold", padding: 0, lineHeight: 1,
        }}>×</button>
      )}
    </span>
  );
}

function FleurCard({ fleur, onClick }) {
  return (
    <div onClick={() => onClick(fleur)} style={{
      background: "rgba(255,253,245,0.85)",
      border: "1px solid #c8b89a",
      borderRadius: 4,
      overflow: "hidden",
      cursor: "pointer",
      boxShadow: "2px 3px 8px rgba(90,60,20,0.12)",
      transition: "transform 0.15s, box-shadow 0.15s",
      fontFamily: "'Courier Prime', monospace",
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "3px 6px 16px rgba(90,60,20,0.2)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "2px 3px 8px rgba(90,60,20,0.12)"; }}
    >
      <div style={{ height: 180, background: "#e8dcc8", overflow: "hidden", position: "relative" }}>
        {fleur.photo ? (
          <img src={fleur.photo} alt={fleur.nom} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 48, color: "#c8b89a" }}>🌸</div>
        )}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "linear-gradient(transparent, rgba(58,46,30,0.6))",
          padding: "20px 10px 8px",
        }}>
          {fleur.famille && (
            <span style={{ fontSize: 10, color: "#f0e6d0", textTransform: "uppercase", letterSpacing: 1 }}>{fleur.famille}</span>
          )}
        </div>
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ fontSize: 15, fontWeight: "bold", color: "#3a2e1e", marginBottom: 2 }}>{fleur.nom || "Sans nom"}</div>
        {fleur.nomLatin && <div style={{ fontSize: 11, fontStyle: "italic", color: "#7a6a54", marginBottom: 6 }}>{fleur.nomLatin}</div>}
        <div style={{ fontSize: 11, color: "#7a6a54" }}>
          {[fleur.lieu, fleur.massif].filter(Boolean).join(" · ")}
        </div>
        {fleur.mois && (
          <div style={{ fontSize: 11, color: "#9a8a74", marginTop: 2 }}>
            {MOIS[parseInt(fleur.mois) - 1]} {fleur.annee}
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({ fleur, onClose, onEdit, onDelete }) {
  if (!fleur) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(30,20,10,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#faf6ee",
        border: "2px solid #c8b89a",
        borderRadius: 6,
        maxWidth: 560, width: "100%",
        maxHeight: "90vh", overflow: "auto",
        fontFamily: "'Courier Prime', monospace",
        boxShadow: "0 8px 40px rgba(30,20,10,0.4)",
      }}>
        {fleur.photo && (
          <div style={{ height: 280, overflow: "hidden" }}>
            <img src={fleur.photo} alt={fleur.nom} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        <div style={{ padding: "20px 24px 24px" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#9a8a74", marginBottom: 4 }}>
            {fleur.famille}
          </div>
          <h2 style={{ margin: "0 0 4px", fontSize: 24, color: "#3a2e1e", fontFamily: "'Playfair Display', serif" }}>
            {fleur.nom || "Sans nom"}
          </h2>
          {fleur.nomLatin && (
            <div style={{ fontStyle: "italic", color: "#7a6a54", marginBottom: 16 }}>{fleur.nomLatin}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {fleur.lieu && <InfoBlock label="Lieu" value={fleur.lieu} />}
            {fleur.massif && <InfoBlock label="Massif" value={fleur.massif} />}
            {fleur.mois && <InfoBlock label="Période" value={`${MOIS[parseInt(fleur.mois)-1]} ${fleur.annee}`} />}
            {fleur.etage && <InfoBlock label="Étage" value={fleur.etage} />}
          </div>

          {fleur.habitat?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#9a8a74", marginBottom: 6 }}>Habitat</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {fleur.habitat.map(h => <Tag key={h} label={h} />)}
              </div>
            </div>
          )}

          {fleur.specificites && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#9a8a74", marginBottom: 6 }}>Spécificités</div>
              <p style={{ margin: 0, color: "#3a2e1e", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{fleur.specificites}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
            <button onClick={() => onEdit(fleur)} style={btnStyle("#c8b89a", "#3a2e1e")}>Modifier</button>
            <button onClick={() => { if (confirm("Supprimer cette entrée ?")) onDelete(fleur); }} style={btnStyle("#8b3a3a", "#fff")}>Supprimer</button>
            <button onClick={onClose} style={btnStyle("#3a2e1e", "#faf6ee")}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#9a8a74", marginBottom: 2 }}>{label}</div>
      <div style={{ color: "#3a2e1e", fontSize: 14 }}>{value}</div>
    </div>
  );
}

const btnStyle = (bg, color) => ({
  background: bg, color, border: `1px solid ${bg === "#faf6ee" ? "#c8b89a" : bg}`,
  borderRadius: 3, padding: "6px 14px", cursor: "pointer",
  fontFamily: "'Courier Prime', monospace", fontSize: 13, fontWeight: "bold",
});

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#7a6a54", marginBottom: 4, fontFamily: "'Courier Prime', monospace" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,253,245,0.9)", border: "1px solid #c8b89a",
  borderRadius: 3, padding: "7px 10px", fontSize: 14,
  color: "#3a2e1e", fontFamily: "'Courier Prime', monospace",
  outline: "none",
};

const selectStyle = { ...inputStyle };

export default function Herbier({ user }) {
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [view, setView] = useState("gallery");
  const [form, setForm] = useState(emptyForm);
  const [pendingPhotoBlob, setPendingPhotoBlob] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ famille: "", massif: "", habitat: "", search: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    const q = query(
      collection(db, "users", user.uid, "fleurs"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setEntriesLoading(false);
      },
      (err) => {
        console.error("Firestore error:", err);
        setEntriesLoading(false);
      }
    );
    return unsub;
  }, [user.uid]);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const { dataUrl, blob } = await compress(ev.target.result);
        setForm((f) => ({ ...f, photo: dataUrl }));
        setPendingPhotoBlob(blob);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.nom.trim()) return alert("Le nom est requis.");
    setSaving(true);
    try {
      const famille = form.famille === "Autre" ? form.familleSaisie : form.famille;
      const massif = form.massif === "Autre" ? form.massifSaisie : form.massif;

      let photo = form.photo;
      let photoPath = form.photoPath ?? null;

      if (pendingPhotoBlob) {
        if (form.id && form.photoPath) {
          try { await deleteObject(storageRef(storage, form.photoPath)); } catch (e) { /* ignore */ }
        }
        const newPath = `users/${user.uid}/herbier/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const sref = storageRef(storage, newPath);
        await uploadBytes(sref, pendingPhotoBlob, { contentType: "image/jpeg" });
        photo = await getDownloadURL(sref);
        photoPath = newPath;
      }

      const data = {
        nom: form.nom.trim(),
        nomLatin: form.nomLatin || "",
        famille: famille || "",
        lieu: form.lieu || "",
        massif: massif || "",
        mois: form.mois || "",
        annee: form.annee || "",
        etage: form.etage || "",
        habitat: form.habitat || [],
        specificites: form.specificites || "",
        photo: photo || null,
        photoPath,
        updatedAt: serverTimestamp(),
      };

      if (form.id) {
        await updateDoc(doc(db, "users", user.uid, "fleurs", form.id), data);
      } else {
        await addDoc(collection(db, "users", user.uid, "fleurs"), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }

      setView("gallery");
      setForm(emptyForm);
      setPendingPhotoBlob(null);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement : " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (fleur) => {
    setSelected(null);
    const famille = FAMILLES.includes(fleur.famille) ? fleur.famille : (fleur.famille ? "Autre" : "");
    const familleSaisie = famille === "Autre" ? fleur.famille : "";
    const massif = MASSIFS.includes(fleur.massif) ? fleur.massif : (fleur.massif ? "Autre" : "");
    const massifSaisie = massif === "Autre" ? fleur.massif : "";
    setForm({
      ...emptyForm,
      ...fleur,
      famille,
      familleSaisie,
      massif,
      massifSaisie,
    });
    setPendingPhotoBlob(null);
    setView("form");
  };

  const handleDelete = async (fleur) => {
    try {
      if (fleur.photoPath) {
        try { await deleteObject(storageRef(storage, fleur.photoPath)); } catch (e) { /* ignore */ }
      }
      await deleteDoc(doc(db, "users", user.uid, "fleurs", fleur.id));
      setSelected(null);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression : " + (err.message || err));
    }
  };

  const toggleHabitat = (h) => {
    setForm(f => ({
      ...f,
      habitat: f.habitat.includes(h) ? f.habitat.filter(x => x !== h) : [...f.habitat, h],
    }));
  };

  const handleLogout = async () => {
    if (!confirm("Se déconnecter ?")) return;
    await signOut(auth);
  };

  const filtered = entries.filter(e => {
    if (filters.famille && e.famille !== filters.famille) return false;
    if (filters.massif && e.massif !== filters.massif) return false;
    if (filters.habitat && !e.habitat?.includes(filters.habitat)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (![e.nom, e.nomLatin, e.lieu, e.specificites].some(v => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const familles = [...new Set(entries.map(e => e.famille).filter(Boolean))];
  const massifsList = [...new Set(entries.map(e => e.massif).filter(Boolean))];
  const habitatsList = [...new Set(entries.flatMap(e => e.habitat || []).filter(Boolean))];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #e8dcc8; }
        ::-webkit-scrollbar-thumb { background: #c8b89a; border-radius: 3px; }
        input:focus, select:focus, textarea:focus { border-color: #8a7a5a !important; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#f0e8d4",
        backgroundImage: `
          radial-gradient(ellipse at 20% 50%, rgba(200,180,140,0.15) 0%, transparent 60%),
          radial-gradient(ellipse at 80% 20%, rgba(160,140,100,0.1) 0%, transparent 50%)
        `,
        fontFamily: "'Courier Prime', monospace",
      }}>

        <header style={{
          background: "rgba(58,46,30,0.95)",
          borderBottom: "3px solid #8a7a5a",
          padding: "0 20px",
          position: "sticky", top: 0, zIndex: 100,
        }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, color: "#c8b89a" }}>Mon</div>
              <h1 style={{ margin: 0, fontSize: 26, color: "#f0e8d4", fontFamily: "'Playfair Display', serif", letterSpacing: 1 }}>
                Herbier
              </h1>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#c8b89a", fontSize: 12 }}>{entries.length} fleur{entries.length !== 1 ? "s" : ""}</span>
              {view === "gallery" ? (
                <button onClick={() => { setForm(emptyForm); setPendingPhotoBlob(null); setView("form"); }} style={{
                  ...btnStyle("#c8b89a", "#3a2e1e"), display: "flex", alignItems: "center", gap: 4,
                }}>
                  + Ajouter
                </button>
              ) : (
                <button onClick={() => { setView("gallery"); setForm(emptyForm); setPendingPhotoBlob(null); }} style={btnStyle("#8a7a5a", "#f0e8d4")}>
                  ← Retour
                </button>
              )}
              <button
                onClick={handleLogout}
                title={user.displayName || user.email || "Se déconnecter"}
                style={{
                  background: "transparent",
                  border: "1px solid #8a7a5a",
                  borderRadius: "50%",
                  width: 32, height: 32,
                  padding: 0,
                  cursor: "pointer",
                  overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ color: "#c8b89a", fontSize: 14, fontWeight: "bold" }}>
                    {(user.displayName || user.email || "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>

          {view === "gallery" && (
            <>
              <div style={{
                background: "rgba(255,253,245,0.6)",
                border: "1px solid #c8b89a",
                borderRadius: 4, padding: "14px 16px",
                marginBottom: 24,
                display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
              }}>
                <input
                  placeholder="Rechercher..."
                  value={filters.search}
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                  style={{ ...inputStyle, width: 180 }}
                />
                <select value={filters.famille} onChange={e => setFilters(f => ({ ...f, famille: e.target.value }))} style={{ ...selectStyle, width: 160 }}>
                  <option value="">Toutes familles</option>
                  {familles.map(f => <option key={f}>{f}</option>)}
                </select>
                <select value={filters.massif} onChange={e => setFilters(f => ({ ...f, massif: e.target.value }))} style={{ ...selectStyle, width: 160 }}>
                  <option value="">Tous massifs</option>
                  {massifsList.map(m => <option key={m}>{m}</option>)}
                </select>
                <select value={filters.habitat} onChange={e => setFilters(f => ({ ...f, habitat: e.target.value }))} style={{ ...selectStyle, width: 160 }}>
                  <option value="">Tous habitats</option>
                  {habitatsList.map(h => <option key={h}>{h}</option>)}
                </select>
                {Object.values(filters).some(Boolean) && (
                  <button onClick={() => setFilters({ famille: "", massif: "", habitat: "", search: "" })} style={{ ...btnStyle("#e8dcc8", "#7a6a54"), fontSize: 12 }}>
                    ✕ Effacer
                  </button>
                )}
              </div>

              {entriesLoading ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#9a8a74" }}>
                  <p style={{ fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>Chargement…</p>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#9a8a74" }}>
                  {entries.length === 0 ? (
                    <>
                      <div style={{ fontSize: 64, marginBottom: 16 }}>🌿</div>
                      <p style={{ fontSize: 18, fontFamily: "'Playfair Display', serif" }}>Votre herbier est vide</p>
                      <p style={{ fontSize: 14 }}>Commencez par ajouter votre première fleur</p>
                    </>
                  ) : (
                    <p>Aucune fleur ne correspond aux filtres.</p>
                  )}
                </div>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 16,
                }}>
                  {filtered.map(f => <FleurCard key={f.id} fleur={f} onClick={setSelected} />)}
                </div>
              )}
            </>
          )}

          {view === "form" && (
            <div style={{ maxWidth: 620, margin: "0 auto" }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#3a2e1e", marginBottom: 24, fontSize: 22 }}>
                {form.id ? "Modifier la fiche" : "Nouvelle fiche"}
              </h2>

              <FormField label="Photo">
                <div
                  onClick={() => fileRef.current.click()}
                  style={{
                    border: "2px dashed #c8b89a", borderRadius: 4,
                    height: 200, display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", overflow: "hidden", background: "rgba(255,253,245,0.5)",
                    position: "relative",
                  }}
                >
                  {form.photo ? (
                    <img src={form.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ textAlign: "center", color: "#9a8a74" }}>
                      <div style={{ fontSize: 36 }}>{uploading ? "⏳" : "📷"}</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        {uploading ? "Traitement..." : "Cliquer pour ajouter une photo"}
                      </div>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
              </FormField>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <FormField label="Nom commun *">
                    <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} style={inputStyle} placeholder="ex: Anémone des Alpes" />
                  </FormField>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <FormField label="Nom latin">
                    <input value={form.nomLatin} onChange={e => setForm(f => ({ ...f, nomLatin: e.target.value }))} style={inputStyle} placeholder="ex: Anemone alpina" />
                  </FormField>
                </div>

                <FormField label="Famille">
                  <select value={form.famille} onChange={e => setForm(f => ({ ...f, famille: e.target.value }))} style={selectStyle}>
                    <option value="">— Choisir —</option>
                    {FAMILLES.map(f => <option key={f}>{f}</option>)}
                  </select>
                  {form.famille === "Autre" && (
                    <input value={form.familleSaisie} onChange={e => setForm(f => ({ ...f, familleSaisie: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }} placeholder="Famille..." />
                  )}
                </FormField>

                <FormField label="Massif / Région">
                  <select value={form.massif} onChange={e => setForm(f => ({ ...f, massif: e.target.value }))} style={selectStyle}>
                    <option value="">— Choisir —</option>
                    {MASSIFS.map(m => <option key={m}>{m}</option>)}
                  </select>
                  {form.massif === "Autre" && (
                    <input value={form.massifSaisie} onChange={e => setForm(f => ({ ...f, massifSaisie: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }} placeholder="Région..." />
                  )}
                </FormField>

                <div style={{ gridColumn: "1/-1" }}>
                  <FormField label="Lieu exact">
                    <input value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))} style={inputStyle} placeholder="ex: Col du Galibier, 2600m" />
                  </FormField>
                </div>

                <FormField label="Mois">
                  <select value={form.mois} onChange={e => setForm(f => ({ ...f, mois: e.target.value }))} style={selectStyle}>
                    <option value="">— Mois —</option>
                    {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </FormField>

                <FormField label="Année">
                  <input type="number" value={form.annee} onChange={e => setForm(f => ({ ...f, annee: e.target.value }))} style={inputStyle} min={1990} max={2099} />
                </FormField>

                <div style={{ gridColumn: "1/-1" }}>
                  <FormField label="Étage de végétation">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {ETAGES.map(e => (
                        <button key={e} onClick={() => setForm(f => ({ ...f, etage: f.etage === e ? "" : e }))} style={{
                          ...btnStyle(form.etage === e ? "#3a2e1e" : "#e8dcc8", form.etage === e ? "#f0e8d4" : "#7a6a54"),
                          fontSize: 12, padding: "4px 10px",
                        }}>{e}</button>
                      ))}
                    </div>
                  </FormField>
                </div>

                <div style={{ gridColumn: "1/-1" }}>
                  <FormField label="Habitat (plusieurs possibles)">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {HABITATS.map(h => (
                        <button key={h} onClick={() => toggleHabitat(h)} style={{
                          ...btnStyle(form.habitat.includes(h) ? "#3a2e1e" : "#e8dcc8", form.habitat.includes(h) ? "#f0e8d4" : "#7a6a54"),
                          fontSize: 12, padding: "4px 10px",
                        }}>{h}</button>
                      ))}
                    </div>
                  </FormField>
                </div>

                <div style={{ gridColumn: "1/-1" }}>
                  <FormField label="Spécificités / Anecdotes">
                    <textarea
                      value={form.specificites}
                      onChange={e => setForm(f => ({ ...f, specificites: e.target.value }))}
                      style={{ ...inputStyle, height: 100, resize: "vertical" }}
                      placeholder="Caractéristiques remarquables, anecdotes, confusion possible avec..."
                    />
                  </FormField>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  onClick={() => { setView("gallery"); setForm(emptyForm); setPendingPhotoBlob(null); }}
                  disabled={saving}
                  style={{ ...btnStyle("#e8dcc8", "#7a6a54"), opacity: saving ? 0.6 : 1 }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || uploading}
                  style={{ ...btnStyle("#3a2e1e", "#f0e8d4"), opacity: (saving || uploading) ? 0.6 : 1, cursor: saving ? "wait" : "pointer" }}
                >
                  {saving ? "Enregistrement…" : form.id ? "Enregistrer" : "Ajouter à l'herbier"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <Modal fleur={selected} onClose={() => setSelected(null)} onEdit={handleEdit} onDelete={handleDelete} />
    </>
  );
}
