/**
 * UserMenu – avatar/nickname pill in the top-right corner.
 * Click → dropdown shows email + nickname + "Endre nickname" button.
 */
import { useEffect, useRef, useState } from "react";
import { usePlayerApi } from "../lib/usePlayerApi";

export default function UserMenu({ token }) {
  const { profile, updateNickname } = usePlayerApi(token);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setEditing(false);
        setSaveError("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function startEdit() {
    setInputVal(profile?.nickname || "");
    setSaveError("");
    setEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) { setSaveError("Nickname kan ikke være tomt."); return; }
    if (trimmed.length > 64) { setSaveError("Maks 64 tegn."); return; }
    setSaving(true);
    setSaveError("");
    try {
      await updateNickname(trimmed);
      setEditing(false);
      setOpen(false);
    } catch (err) {
      setSaveError(err.message || "Noe gikk galt.");
    } finally {
      setSaving(false);
    }
  }

  const displayName = profile?.nickname || profile?.username || "•••";

  return (
    <div className="user-menu" ref={menuRef}>
      {/* Trigger pill */}
      <button
        className="user-menu-trigger"
        onClick={() => { setOpen(v => !v); setEditing(false); setSaveError(""); }}
        aria-haspopup="true"
        aria-expanded={open}
        title="Min profil"
      >
        <span className="user-menu-avatar">{displayName[0]?.toUpperCase()}</span>
        <span className="user-menu-name">{displayName}</span>
        <span className="user-menu-chevron">{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-info">
            <div className="user-menu-nickname">{displayName}</div>
            <div className="user-menu-email">{profile?.username}</div>
          </div>

          <div className="user-menu-divider" />

          {!editing ? (
            <button className="user-menu-action" onClick={startEdit}>
              ✏️ Endre nickname
            </button>
          ) : (
            <form className="user-menu-edit-form" onSubmit={handleSave}>
              <input
                className="user-menu-input"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                maxLength={64}
                autoFocus
                placeholder="Nytt nickname"
              />
              {saveError && (
                <div className="user-menu-error">{saveError}</div>
              )}
              <div className="user-menu-edit-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Lagrer…" : "Lagre"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => { setEditing(false); setSaveError(""); }}
                >
                  Avbryt
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
