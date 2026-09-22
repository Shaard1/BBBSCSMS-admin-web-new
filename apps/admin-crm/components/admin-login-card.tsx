"use client";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Brand } from "@/components/brand";
import {
  clearAdminServerSession,
  createAdminServerSession,
  signInAsOfficeUser,
} from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export function AdminLoginCard() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<"admin" | "staff">("staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage("");
    try {
      const result = await signInAsOfficeUser(email, password);
      if (!result.ok) throw new Error(result.message);
      const session = await createAdminServerSession(loginMode);
      if (!session.ok) {
        await Promise.all([clearAdminServerSession(), supabase.auth.signOut()]);
        throw new Error(session.message);
      }
      router.replace("/admin/dashboard");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="office-login-layout">
      <section className="office-login-story">
        <Brand />
        <div>
          <p className="eyebrow">Barangay Bancao-Bancao</p>
          <h2>
            Good service starts
            <br />
            with connection.
          </h2>
          <p>One workspace for the people who keep our community moving.</p>
          <div className="login-service-list">
            <span>Resident services</span>
            <span>Community reports</span>
            <span>Public announcements</span>
          </div>
        </div>
        <small>Official staff &amp; administrator workspace</small>
      </section>
      <section className="office-login-card">
        <span className="login-shield">
          <ShieldCheck size={24} />
        </span>
        <h1>Welcome back</h1>
        <p>Sign in with your assigned office account.</p>
        <form onSubmit={handleSubmit}>
          <fieldset className="login-role-choice" disabled={isSubmitting}>
            <legend>Account access</legend>
            {(["staff", "admin"] as const).map((mode) => (
              <label key={mode}>
                <input
                  type="radio"
                  name="access"
                  value={mode}
                  checked={loginMode === mode}
                  onChange={() => setLoginMode(mode)}
                />
                <span>{mode === "staff" ? "Staff" : "Administrator"}</span>
              </label>
            ))}
          </fieldset>
          <label className="field-label" htmlFor="office-email">
            Email address
          </label>
          <input
            id="office-email"
            type="email"
            autoComplete="username"
            placeholder="you@barangay.gov.ph"
            required
            disabled={isSubmitting}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label className="field-label" htmlFor="office-password">
            Password
          </label>
          <div className="office-password-field">
            <input
              id="office-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              disabled={isSubmitting}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {message ? (
            <p className="form-message" role="alert">
              {message}
            </p>
          ) : null}
          <button
            className="primary-admin-button login-submit"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Checking access…" : "Sign in"}
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="login-help">
          Need access or a password reset? Contact your barangay administrator.
        </p>
        <small>
          For authorized personnel only. Resident services are available in the
          Bancao-Connect mobile app.
        </small>
      </section>
    </div>
  );
}
