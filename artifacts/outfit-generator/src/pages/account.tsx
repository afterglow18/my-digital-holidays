import React, { useState } from "react";
import { useAuthContext } from "@/context/AuthContext";
import { Eye, EyeOff, Check, Loader2, TriangleAlert, LogOut } from "lucide-react";

type Section = "email" | "password";

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-black/50">{label}</label>
      <div className="relative">
        <input
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full border-2 border-black rounded-lg px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary bg-white pr-10"
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  emoji,
  onSubmit,
  error,
  success,
  pending,
  children,
}: {
  title: string;
  emoji: string;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
  success: string | null;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
    >
      <div className="px-4 py-3 border-b-2 border-black bg-secondary/20 flex items-center gap-2">
        <span className="text-lg leading-none">{emoji}</span>
        <h2 className="font-display font-bold text-base uppercase tracking-tight">{title}</h2>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {children}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" /> {success}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 py-3
                     border-4 border-black rounded-xl bg-primary font-display font-bold
                     text-sm uppercase tracking-tight
                     shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                     active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>
    </form>
  );
}

export default function AccountPage() {
  const { state, logout } = useAuthContext();
  const currentEmail = state.status === "authenticated" ? state.user?.email ?? "" : "";

  // Email form
  const [emailCurrent, setEmailCurrent] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailPending, setEmailPending] = useState(false);

  // Password form
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwPending, setPwPending] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const token = state.status === "authenticated" ? state.token : null;

  const patchMe = async (body: object) => {
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Something went wrong");
    return data;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);
    if (!newEmail.trim()) { setEmailError("Please enter a new email address"); return; }
    setEmailPending(true);
    try {
      await patchMe({ currentPassword: emailCurrent, newEmail: newEmail.trim() });
      setEmailSuccess("Email updated successfully");
      setEmailCurrent("");
      setNewEmail("");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to update email");
    } finally {
      setEmailPending(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    if (!pwNew) { setPwError("Please enter a new password"); return; }
    if (pwNew.length < 6) { setPwError("New password must be at least 6 characters"); return; }
    if (pwNew !== pwConfirm) { setPwError("Passwords don't match"); return; }
    setPwPending(true);
    try {
      await patchMe({ currentPassword: pwCurrent, newPassword: pwNew });
      setPwSuccess("Password updated successfully");
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setPwPending(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col pt-8 px-4 pb-8 bg-secondary/10">
      <header className="mb-6">
        <h1 className="text-4xl font-display font-bold uppercase tracking-tighter mb-1">Account</h1>
        <p className="font-medium text-muted-foreground text-sm">{currentEmail}</p>
      </header>

      <div className="flex flex-col gap-4">
        {/* Change Email */}
        <Card
          title="Change Email"
          emoji="✉️"
          onSubmit={handleEmailSubmit}
          error={emailError}
          success={emailSuccess}
          pending={emailPending}
        >
          <Field
            label="New Email Address"
            type="email"
            value={newEmail}
            onChange={setNewEmail}
            placeholder="new@email.com"
            autoComplete="email"
          />
          <Field
            label="Current Password"
            type="password"
            value={emailCurrent}
            onChange={setEmailCurrent}
            placeholder="Enter your current password"
            autoComplete="current-password"
          />
        </Card>

        {/* Change Password */}
        <Card
          title="Change Password"
          emoji="🔑"
          onSubmit={handlePasswordSubmit}
          error={pwError}
          success={pwSuccess}
          pending={pwPending}
        >
          <Field
            label="Current Password"
            type="password"
            value={pwCurrent}
            onChange={setPwCurrent}
            placeholder="Enter your current password"
            autoComplete="current-password"
          />
          <Field
            label="New Password"
            type="password"
            value={pwNew}
            onChange={setPwNew}
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
          <Field
            label="Confirm New Password"
            type="password"
            value={pwConfirm}
            onChange={setPwConfirm}
            placeholder="Repeat new password"
            autoComplete="new-password"
          />
        </Card>

        {/* Sign Out */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3
                     rounded-2xl font-display font-bold text-sm uppercase tracking-tight
                     active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          style={{
            background: "linear-gradient(to bottom, #F4D6DD, #D9A7B3)",
            border: "2px solid #D9A7B3",
            color: "#4A3A3A",
            boxShadow: "3px 3px 0 rgba(0,0,0,0.18)",
          }}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>

        {/* Delete Account */}
        <div className="bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          <div className="px-4 py-3 border-b-2 border-black bg-red-50 flex items-center gap-2">
            <span className="text-lg leading-none">🗑️</span>
            <h2 className="font-display font-bold text-base uppercase tracking-tight text-red-700">Delete Account</h2>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {!showDeleteConfirm ? (
              <>
                <p className="text-sm text-black/60 leading-snug">
                  Permanently deletes your account and everything in your closet — clothes, outfits, all of it. This cannot be undone.
                </p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3
                             border-4 border-red-600 rounded-xl bg-white text-red-600
                             font-display font-bold text-sm uppercase tracking-tight
                             shadow-[3px_3px_0px_0px_rgba(220,38,38,1)]
                             active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all
                             hover:bg-red-50"
                >
                  <TriangleAlert className="w-4 h-4" />
                  Delete My Account
                </button>
              </>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setDeleteError(null);
                  if (!deletePassword) { setDeleteError("Enter your password to confirm"); return; }
                  setDeletePending(true);
                  try {
                    const res = await fetch("/api/auth/me", {
                      method: "DELETE",
                      headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({ password: deletePassword }),
                    });
                    if (!res.ok) {
                      const d = await res.json();
                      throw new Error(d.error ?? "Failed to delete account");
                    }
                    logout();
                  } catch (err) {
                    setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
                    setDeletePending(false);
                  }
                }}
                className="flex flex-col gap-3"
              >
                <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                  <TriangleAlert className="w-4 h-4 shrink-0" />
                  This will delete everything permanently.
                </p>
                <Field
                  label="Enter your password to confirm"
                  type="password"
                  value={deletePassword}
                  onChange={setDeletePassword}
                  placeholder="Your current password"
                  autoComplete="current-password"
                />
                {deleteError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {deleteError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); setDeleteError(null); }}
                    className="flex-1 py-3 border-4 border-black rounded-xl bg-white font-display font-bold text-sm uppercase tracking-tight shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deletePending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3
                               border-4 border-red-600 rounded-xl bg-red-600 text-white
                               font-display font-bold text-sm uppercase tracking-tight
                               shadow-[3px_3px_0px_0px_rgba(220,38,38,1)]
                               active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                               disabled:opacity-50 transition-all"
                  >
                    {deletePending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Yes, Delete
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
