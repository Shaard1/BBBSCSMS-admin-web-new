"use client";
import { ArrowRight, Eye, EyeOff } from "@/components/crm-icons";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Brand } from "@/components/brand";
import {
  clearAdminServerSession,
  createAdminServerSession,
  signInAsOfficeUser,
} from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export function AdminLoginCard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const messageElement = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message && !isSubmitting) messageElement.current?.focus();
  }, [message, isSubmitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setHasSubmitted(true);
    const normalizedEmail = email.trim();
    const errors = {
      email: !normalizedEmail
        ? "Enter your email address."
        : emailInput.current?.validity.typeMismatch
          ? "Enter a valid email address, such as name@example.com."
          : "",
      password: password.length === 0 ? "Enter your password." : "",
    };
    setFieldErrors(errors);
    setMessage("");
    if (errors.email || errors.password) {
      (errors.email ? emailInput : passwordInput).current?.focus();
      return;
    }
    setEmail(normalizedEmail);
    setIsSubmitting(true);
    try {
      const result = await signInAsOfficeUser(normalizedEmail, password);
      if (!result.ok) throw new Error(result.message);
      const session = await createAdminServerSession();
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
        <Image className="office-login-illustration" src="/assets/office-document-exchange.webp?v=2" width={900} height={900} alt="" priority sizes="(max-width: 800px) 1px, (max-width: 1200px) 50vw, 600px" />
      </section>
      <section className="office-login-card">
        <div className="office-login-brand">
          <Brand />
        </div>
        <h1>Welcome back</h1>
        <p>Sign in with your assigned office account.</p>
        <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
          <label className="field-label" htmlFor="office-email">
            Email address
          </label>
          <input
            id="office-email"
            ref={emailInput}
            type="email"
            autoComplete="username"
            placeholder="Enter your email address"
            autoCapitalize="none"
            spellCheck={false}
            onBlur={(event) => {
              if (!hasSubmitted) return;
              const input = event.currentTarget;
              const error = !input.value.trim()
                ? "Enter your email address."
                : input.validity.typeMismatch
                  ? "Enter a valid email address, such as name@example.com."
                  : "";
              setFieldErrors((current) => ({ ...current, email: error }));
            }}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "office-email-error" : undefined}
            required
            disabled={isSubmitting}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (event.target.validity.valid) {
                setFieldErrors((current) => ({ ...current, email: "" }));
              }
              setMessage("");
            }}
          />
          {fieldErrors.email ? <p className="login-field-error" id="office-email-error" role="alert">{fieldErrors.email}</p> : null}
          <label className="field-label" htmlFor="office-password">
            Password
          </label>
          <div className="office-password-field">
            <input
              id="office-password"
              ref={passwordInput}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "office-password-error" : undefined}
              disabled={isSubmitting}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: "" }));
                setMessage("");
              }}
            />
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {fieldErrors.password ? <p className="login-field-error" id="office-password-error" role="alert">{fieldErrors.password}</p> : null}
          {message ? (
            <p className="form-message" ref={messageElement} tabIndex={-1} role="alert">
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
          Need access or a password reset?<br />
          <strong>Contact your barangay administrator.</strong>
        </p>
      </section>
    </div>
  );
}
