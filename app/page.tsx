"use client";

import {
  AlignJustify,
  Bell,
  Building2,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  Landmark,
  LockKeyhole,
  MapPinned,
  Megaphone,
  PhoneCall,
  ShieldCheck,
  UserCheck,
  UsersRound
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { AdminLoginCard } from "@/components/admin-login-card";

const navLinks = [
  { label: "Office", href: "#about" },
  { label: "Services", href: "#features" },
  { label: "Process", href: "#how-it-works" },
  { label: "Privacy", href: "#security" },
  { label: "Help", href: "#faq" }
];

const footerLinks = [
  { label: "Barangay Office", href: "#about" },
  { label: "Available Services", href: "#features" },
  { label: "Account Process", href: "#how-it-works" },
  { label: "Privacy and Security", href: "#security" },
  { label: "Admin Login", action: "admin-login" as const }
];

const contactItems = [
  { label: "Barangay Office", value: "Bancao-Bancao, Puerto Princesa City", icon: Building2 },
  { label: "Service Hours", value: "Monday to Friday, regular office hours", icon: Clock3 },
  { label: "Urgent Concerns", value: "Coordinate directly with barangay personnel", icon: PhoneCall }
];

const values = [
  { title: "Official barangay channel", icon: Landmark, tone: "blue" },
  { title: "Verified resident records", icon: FileCheck2, tone: "green" },
  { title: "Faster office coordination", icon: Clock3, tone: "yellow" },
  { title: "Resident-centered service", icon: UserCheck, tone: "red" }
];

const problems = [
  {
    title: "Office Queueing",
    description:
      "Residents can prepare requests and check updates before visiting the barangay office.",
    icon: UsersRound,
    tone: "red"
  },
  {
    title: "Paper Records",
    description: "Digital submission helps the office keep cleaner records for reports and requests.",
    icon: FileText,
    tone: "yellow"
  },
  {
    title: "Status Follow-ups",
    description:
      "Residents can see whether a concern is pending, in progress, or resolved.",
    icon: ClipboardList,
    tone: "blue"
  },
  {
    title: "Public Advisories",
    description:
      "Official barangay announcements are kept in one verified digital channel.",
    icon: Megaphone,
    tone: "green"
  }
];

const features = [
  {
    title: "Community Concern Reporting",
    description: "Report road issues, waste concerns, drainage problems, streetlights, and other local matters.",
    icon: MapPinned
  },
  {
    title: "Barangay Document Requests",
    description: "Start requests for certificates and clearances with organized details for office review.",
    icon: FileText
  },
  {
    title: "Official Announcements",
    description: "Receive advisories, reminders, activity notices, and public safety updates from the barangay.",
    icon: Bell
  },
  {
    title: "Resident Verification",
    description: "Submit account details and valid identification for barangay staff validation.",
    icon: UserCheck
  },
  {
    title: "Request and Case Tracking",
    description: "Monitor submitted reports and requests from review to completion.",
    icon: ClipboardList
  },
  {
    title: "Barangay Staff Workspace",
    description: "Authorized staff can review residents, manage reports, publish notices, and monitor workload.",
    icon: ShieldCheck
  }
];

const steps = [
  {
    number: "01",
    title: "Register as a Resident",
    description: "Create an account with your name, contact details, address, and supporting identification."
  },
  {
    number: "02",
    title: "Barangay Staff Verification",
    description: "The office checks submitted details before granting resident access."
  },
  {
    number: "03",
    title: "Use Digital Services",
    description:
      "Approved residents can submit reports, request services, and receive official updates."
  }
];

const security = [
  {
    title: "Verified Resident Access",
    description: "Resident services are available only after barangay account approval.",
    icon: UserCheck
  },
  {
    title: "Role-Based Office Access",
    description: "Residents and authorized staff use separate access levels.",
    icon: ShieldCheck
  },
  {
    title: "Secure Sign In",
    description: "Account sessions are protected through authenticated access.",
    icon: LockKeyhole
  },
  {
    title: "Controlled Records Handling",
    description:
      "Submitted information is handled through organized barangay review workflows.",
    icon: ClipboardList
  }
];

const faqs = [
  {
    question: "What is Bancao Connect?",
    answer:
      "Bancao Connect is the digital service portal for Barangay Bancao-Bancao residents to access selected services, reports, requests, and official announcements."
  },
  {
    question: "Who can use Bancao Connect?",
    answer:
      "It is intended for Barangay Bancao-Bancao residents with verified resident accounts."
  },
  {
    question: "Why does my account need approval?",
    answer:
      "Approval helps the barangay confirm that account access is granted to valid residents."
  },
  {
    question: "Can I track my submitted reports?",
    answer:
      "Yes. Residents can view the progress of submitted community concerns and follow their latest status."
  },
  {
    question: "Can I request barangay documents through the app?",
    answer:
      "Yes. Residents can start document requests through the app, subject to barangay office review and processing."
  }
];

export default function Home() {
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "login") {
      setIsAdminLoginOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <main>
      <Navbar onAdminLogin={() => setIsAdminLoginOpen(true)} />
      <Hero />
      <About />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorks />
      <SecuritySection />
      <FaqSection />
      <CtaSection />
      <Footer onAdminLogin={() => setIsAdminLoginOpen(true)} />
      {isAdminLoginOpen ? (
        <AdminLoginOverlay onClose={() => setIsAdminLoginOpen(false)} />
      ) : null}
    </main>
  );
}

function Navbar({ onAdminLogin }: { onAdminLogin: () => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  function handleAdminLogin() {
    closeMenu();
    onAdminLogin();
  }

  return (
    <header className="navbar">
      <div className="nav-inner">
        <a className="brand" href="#top" aria-label="Bancao Connect home">
          <Image src="/assets/BBBC.png" alt="" width={42} height={42} />
          <span>Bancao<br />Connect.</span>
        </a>
        <nav className="nav-links" aria-label="Main navigation">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href}>{link.label}</a>
          ))}
        </nav>
        <div className="nav-actions">
          <button className="login-button" onClick={onAdminLogin} type="button">
            Log in
          </button>
          <a className="download-outline-button" href="/downloads/BancaoConnect.apk" download>
            Download App
          </a>
        </div>
        <button
          aria-controls="mobile-navigation"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          className={`mobile-menu-toggle ${isMenuOpen ? "open" : ""}`}
          onClick={() => setIsMenuOpen((value) => !value)}
          type="button"
        >
          <AlignJustify size={22} />
        </button>
      </div>
      <div className={`mobile-nav-panel ${isMenuOpen ? "open" : ""}`} id="mobile-navigation">
        <nav className="mobile-nav-links" aria-label="Mobile navigation">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} onClick={closeMenu}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="mobile-nav-actions">
          <button className="login-button" onClick={handleAdminLogin} type="button">
            Log in
          </button>
          <a
            className="download-outline-button"
            href="/downloads/BancaoConnect.apk"
            download
            onClick={closeMenu}
          >
            Download App
          </a>
        </div>
      </div>
    </header>
  );
}

function AdminLoginOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="admin-login-overlay" role="dialog" aria-modal="true">
      <button className="admin-login-scrim" onClick={onClose} type="button" aria-label="Close admin login" />
      <div className="admin-login-pop-card">
        <AdminLoginCard onClose={onClose} />
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <span className="official-kicker">Official Digital Services Portal</span>
        <h1><strong>One</strong> Barangay.<br /><strong>One</strong> Digital Home.</h1>
        <p>
          Bringing Bancao-Bancao services closer to every resident through a faster,
          safer, and more connected digital experience.
        </p>
      </div>
      <div className="hero-phone" aria-hidden="true">
        <Image
          src="/assets/Holding-the-phone.png"
          alt=""
          width={760}
          height={620}
          priority
        />
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="section section-white" id="about">
      <div className="section-inner about-grid">
        <div>
          <SectionHeading eyebrow="Barangay office" title="Digital service support for local governance" align="left" />
          <p className="lead-text">
            Bancao Connect helps Barangay Bancao-Bancao provide clearer access to
            resident services, community issue reporting, and official public
            information. It supports office staff with organized records while
            giving residents a practical way to coordinate with the barangay.
          </p>
          <div className="contact-strip">
            {contactItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label}>
                  <Icon size={18} />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.value}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="value-grid">
          {values.map((value) => <ValueCard key={value.title} {...value} />)}
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="section section-muted">
      <div className="section-inner">
        <SectionHeading
          eyebrow="Public service needs"
          title="Built for everyday barangay transactions"
          description="The portal supports common resident concerns that require clear records, accountable follow-up, and official communication."
        />
        <div className="card-grid four-columns">
          {problems.map((item) => <InfoCard key={item.title} {...item} />)}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="section section-white" id="features">
      <div className="section-inner">
        <SectionHeading
          eyebrow="Services"
          title="Barangay services available through the portal"
          description="Residents can start key transactions digitally while authorized barangay staff manage verification, reporting, and public notices."
        />
        <div className="card-grid three-columns">
          {features.map((item) => <InfoCard key={item.title} {...item} tone="blue" />)}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="section section-muted" id="how-it-works">
      <div className="section-inner">
        <SectionHeading
          eyebrow="Process"
          title="How resident access is approved"
          description="The flow is designed to protect barangay records while keeping residents informed about what happens next."
        />
        <div className="steps">
          {steps.map((step) => <StepCard key={step.number} {...step} />)}
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  return (
    <section className="section security-section" id="security">
      <div className="section-inner security-grid">
        <div>
          <SectionHeading
            eyebrow="Privacy and security"
            title="Resident data is handled through controlled access"
            align="left"
          />
          <p className="lead-text">
            The portal separates resident access from staff access, limits
            administrative tools to authorized accounts, and keeps submitted
            records inside structured barangay workflows.
          </p>
          <div className="security-badge">
            <ShieldCheck size={20} />
            <span>Verified access and role-based controls</span>
          </div>
        </div>
        <div className="card-grid two-columns">
          {security.map((item) => <InfoCard key={item.title} {...item} tone="blue" compact />)}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="section section-white" id="faq">
      <div className="section-inner faq-wrap">
        <SectionHeading
          eyebrow="Help"
          title="Common resident questions"
          description="Short answers for residents using Bancao Connect for the first time."
        />
        <div className="faq-list">
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="section section-muted" id="download">
      <div className="section-inner">
        <div className="cta">
          <div>
            <h2>Use the official barangay digital service channel</h2>
            <p>
              Download Bancao Connect to register as a resident, submit
              community concerns, request services, and receive verified
              barangay announcements.
            </p>
            <div className="cta-actions">
              <a className="light-button" href="/downloads/BancaoConnect.apk" download>
                Download App
              </a>
              <a className="outline-button" href="#faq">Need Help?</a>
            </div>
          </div>
          <Image src="/assets/Holding-the-phone.png" alt="" width={340} height={250} />
        </div>
      </div>
    </section>
  );
}

function Footer({ onAdminLogin }: { onAdminLogin: () => void }) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <a className="brand footer-brand" href="#top">
            <Image src="/assets/BBBC.png" alt="" width={42} height={42} />
            <span>Bancao<br />Connect.</span>
          </a>
          <p>Official digital service support for Barangay Bancao-Bancao residents.</p>
        </div>
        <div>
          <h3>Portal links</h3>
          {footerLinks.map((link) =>
            link.action === "admin-login" ? (
              <button className="footer-link-button" key={link.label} onClick={onAdminLogin} type="button">
                {link.label}
              </button>
            ) : (
              <a key={link.label} href={link.href}>{link.label}</a>
            )
          )}
        </div>
        <div>
          <h3>Barangay office</h3>
          <p>Barangay Bancao-Bancao, Puerto Princesa City</p>
        </div>
      </div>
      <div className="copyright">© 2026 Bancao Connect. All rights reserved.</div>
    </footer>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center"
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`section-heading ${align === "left" ? "align-left" : ""}`}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

function ValueCard({
  title,
  icon: Icon,
  tone
}: {
  title: string;
  icon: typeof UsersRound;
  tone: string;
}) {
  return (
    <article className={`value-card tone-${tone}`}>
      <span><Icon size={21} /></span>
      <h3>{title}</h3>
    </article>
  );
}

function InfoCard({
  title,
  description,
  icon: Icon,
  tone = "blue",
  compact = false
}: {
  title: string;
  description: string;
  icon: typeof UsersRound;
  tone?: string;
  compact?: boolean;
}) {
  return (
    <article className={`info-card ${compact ? "compact" : ""}`}>
      <span className={`icon-badge tone-${tone}`}><Icon size={21} /></span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </article>
  );
}

function StepCard({
  number,
  title,
  description
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <article className="step-card">
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}
