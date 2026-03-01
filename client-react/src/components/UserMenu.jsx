/**
 * UserMenu â€“ avatar/nickname pill in the top-right corner.
 * Click â†’ dropdown shows email + nickname + "Endre nickname" button.
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
    if (!trimmed) { setSaveError("Nickname kan ikke vÃ¦re tomt."); return; }
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

  const displayName = profile?.nickname || profile?.username || "â€¢â€¢â€¢";

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
        <span className="overflow-hidden text-ellipsis flex-1">{displayName}</span>
        <span className="text-xs opacity-60 shrink-0">{open ? "â–²" : "â–¼"}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="user-menu-dropdown">
          <div className="pb-0.5">
            <div className="text-base font-bold mb-0.5 break-all">{displayName}</div>
            <div className="text-xs opacity-45 break-all">{profile?.username}</div>
          </div>

          <div className="divider my-2" />

          {!editing ? (
            <button className="user-menu-action" onClick={startEdit}>
              âœï¸ Endre nickname
            </button>
          ) : (
            <form className="flex flex-col gap-1.5" onSubmit={handleSave}>
              <input
                className="input input-sm w-full"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                maxLength={64}
                autoFocus
                placeholder="Nytt nickname"
              />
              {saveError && (
                <div className="text-error text-xs">{saveError}</div>
              )}
              <div className="flex gap-1.5">
                <button type="submit" className="btn btn-primary btn-sm flex-1" disabled={saving}>
                  {saving ? "Lagrerâ€¦" : "Lagre"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm flex-1"
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
