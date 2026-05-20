"use client";

import { ArrowLeft, Eye, EyeOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  createAdminServerSession,
  signInAsOfficeUser
} from "@/lib/auth";

type AdminLoginCardProps = {
  onClose?: () => void;
};

export function AdminLoginCard({ onClose }: AdminLoginCardProps) {
  const isModal = Boolean(onClose);
  const router = useRouter();
  const [step, setStep] = useState<"chooser" | "form">(isModal ? "chooser" : "form");
  const [loginMode, setLoginMode] = useState<"admin" | "staff">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const result = await signInAsOfficeUser(email, password, loginMode);
    setIsSubmitting(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    const sessionResult = await createAdminServerSession();
    if (!sessionResult.ok) {
      setMessage(sessionResult.message);
      return;
    }

    router.push("/admin/dashboard");
  }

  if (isModal && step === "chooser") {
    return (
      <section className="login-card modal-login-card modal-login-chooser modal-card-enter">
        <button className="login-close-button" onClick={onClose} type="button" aria-label="Close admin login">
          <X size={24} />
        </button>
        <div className="modal-login-heading">
          <h1>Log in</h1>
        </div>
        <button
          className="chooser-secondary"
          onClick={() => {
            setLoginMode("staff");
            setStep("form");
          }}
          type="button"
        >
          Staff log in
        </button>
        <button
          className="chooser-primary"
          onClick={() => {
            setLoginMode("admin");
            setStep("form");
          }}
          type="button"
        >
          Admin log in
        </button>
      </section>
    );
  }

  return (
    <section
      className={`login-card modal-card-enter ${isModal ? "modal-login-card" : ""} ${isModal ? `modal-login-form modal-login-${loginMode}` : ""}`}
    >
      {isModal ? (
        <button className="login-back-button" onClick={() => setStep("chooser")} type="button" aria-label="Back to login options">
          <ArrowLeft size={24} />
        </button>
      ) : null}
      {onClose ? (
        <button className="login-close-button" onClick={onClose} type="button" aria-label="Close admin login">
          <X size={24} />
        </button>
      ) : null}
      {isModal ? (
        <div className="modal-login-heading">
          <h1>{loginMode === "admin" ? "Administrator access" : "Staff Login"}</h1>
          <p>{loginMode === "admin" ? "System configuration and security protocols" : "Access services and public record management"}</p>
        </div>
      ) : null}
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          placeholder="Email"
          aria-label="Email address"
        />
        <div className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
          />
          <button
            type="button"
            className="password-visibility-button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {message ? <p className="form-message">{message}</p> : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Checking access..." : "Log In"}
        </button>
      </form>
    </section>
  );
}
