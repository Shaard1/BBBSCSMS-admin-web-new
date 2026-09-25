"use client";

import Image from "next/image";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const links = [
  { label: "Home", id: "top" },
  { label: "Services", id: "features" },
  { label: "Getting started", id: "how-it-works" },
  { label: "Our barangay", id: "about" },
  { label: "Help", id: "faq" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("top");
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sections = links.map(({ id }) => document.getElementById(id));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: 0 },
    );
    sections.forEach((section) => {
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButton.current?.focus();
    }
    const desktop = window.matchMedia("(min-width: 64em)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [menuOpen]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <a
          className="brand"
          href="#top"
          aria-label="Bancao Connect home"
          onClick={() => setMenuOpen(false)}
        >
          <Image
            src="/assets/bancao-connect-mark-community.svg"
            width={42}
            height={42}
            alt=""
            priority
          />
          <span>
            Bancao
            <br />
            Connect.
          </span>
        </a>
        <nav className="desktop-navigation" aria-label="Main navigation">
          {links.map(({ label, id }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={activeSection === id ? "location" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <a
          className="button button-primary header-download"
          href="#download"
          onClick={() => setMenuOpen(false)}
        >
          Get the app <ArrowUpRight size={16} aria-hidden="true" />
        </a>
        <button
          ref={menuButton}
          className="menu-toggle"
          type="button"
          aria-label={
            menuOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-controls="mobile-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? (
            <X size={23} aria-hidden="true" />
          ) : (
            <Menu size={23} aria-hidden="true" />
          )}
        </button>
      </div>
      <nav
        id="mobile-navigation"
        className="mobile-navigation"
        aria-label="Mobile navigation"
        hidden={!menuOpen}
      >
        {links.map(({ label, id }) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={activeSection === id ? "location" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            {label}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        ))}
        <a
          className="mobile-download"
          href="#download"
          onClick={() => setMenuOpen(false)}
        >
          Get the Android app <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </nav>
    </header>
  );
}
