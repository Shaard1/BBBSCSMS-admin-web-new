import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  MapPin,
  MapPinned,
  ShieldCheck,
  Smartphone,
  UserCheck,
} from "lucide-react";
import Image from "next/image";
import { SiteHeader } from "@/components/site-header";

const services = [
  {
    id: "documents",
    number: "01",
    title: "Request a document",
    label: "Documents",
    description:
      "Start your certificate or clearance request before your visit to the barangay office.",
    icon: FileText,
    tone: "blue",
    guide: "How to request a document",
    steps: [
      "Sign in to your verified account in the Bancao Connect app.",
      "Open document requests, choose the document you need, and provide the required details.",
      "Submit your request and check the app for the office’s review and collection instructions.",
    ],
    note: "Requirements and processing depend on the document requested.",
  },
  {
    id: "concerns",
    number: "02",
    title: "Report a community concern",
    label: "Community reports",
    description:
      "Let the barangay know about road, drainage, waste, streetlight, or other local concerns.",
    icon: MapPinned,
    tone: "green",
    guide: "How to submit a report",
    steps: [
      "Sign in to the app and open community reports.",
      "Describe the concern and include its location and a photo when available.",
      "Submit your report and follow its progress in the app.",
    ],
    note: "For urgent concerns, contact barangay personnel directly.",
  },
  {
    id: "announcements",
    number: "03",
    title: "Stay in the loop",
    label: "Announcements",
    description:
      "Find barangay advisories, community activities, and public service updates in one place.",
    icon: Bell,
    tone: "yellow",
    guide: "Where to find announcements",
    steps: [
      "Sign in to your verified account in the app.",
      "Open announcements to read notices published by the barangay.",
      "Check each notice for dates, locations, and any instructions from the office.",
    ],
    note: "Check the app regularly for the latest published notices.",
  },
  {
    id: "tracking",
    number: "04",
    title: "Follow your request",
    label: "Progress tracking",
    description:
      "Check the latest status of your submitted reports and document requests without another trip.",
    icon: ClipboardList,
    tone: "red",
    guide: "How to check your progress",
    steps: [
      "Sign in using the account you used to submit your request or report.",
      "Open your document requests or community reports and select the relevant entry.",
      "Review its latest status and any instructions from barangay staff.",
    ],
    note: "Need help with a submission? Coordinate with the barangay office.",
  },
] as const;

const steps = [
  {
    number: "01",
    icon: ArrowDownToLine,
    title: "Get the app",
    description:
      "Download Bancao Connect on your Android phone to get started.",
  },
  {
    number: "02",
    icon: UserCheck,
    title: "Register & get verified",
    description:
      "Submit your resident details and identification for the barangay to review.",
  },
  {
    number: "03",
    icon: FileCheck2,
    title: "Connect with your barangay",
    description:
      "Once approved, send requests, report concerns, and keep up with community updates.",
  },
];

const faqs = [
  {
    question: "Who can use Bancao Connect?",
    answer:
      "Bancao Connect is for residents of Barangay Bancao-Bancao, Puerto Princesa City. Register in the Android app and submit your details for barangay verification to access resident services.",
  },
  {
    question: "Can I submit a request on this website?",
    answer:
      "This website helps you explore services and get started. Document requests, community reports, account registration, and progress tracking are available in the Bancao Connect Android app.",
  },
  {
    question: "What do I need to register?",
    answer:
      "Prepare your name, contact details, residential address, and valid identification. Follow the registration instructions in the app and provide the information requested for residency verification.",
  },
  {
    question: "Why does my account need approval?",
    answer:
      "Barangay staff review your details to confirm your residency before granting access. If your account is still pending or you need to correct your information, coordinate with the barangay office.",
  },
  {
    question: "Is the app available for iPhone?",
    answer:
      "The download provided here is an Android APK. It cannot be installed on an iPhone. You can still use this website to learn about services and visit the barangay office for assistance.",
  },
  {
    question: "What if my concern is urgent?",
    answer:
      "Contact barangay personnel directly for urgent concerns. Reports submitted in the app are reviewed through the barangay’s regular workflow and are not an emergency response channel.",
  },
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <Services />
        <GettingStarted />
        <ResidentCare />
        <Help />
        <Download />
      </main>
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-heading">
      <div className="hero-stage">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="official-kicker">Official Digital Services Portal</p>
            <h1 id="hero-heading">
              <span className="hero-title-line">
                <strong>One</strong> Barangay.
              </span>{" "}
              <span className="hero-title-line">
                <strong>One</strong> Digital Home.
              </span>
            </h1>
            <p className="hero-description">
              Bringing Bancao-Bancao services closer to every resident through a
              faster, safer, and more connected digital experience.
            </p>
            <div className="button-row">
              <a className="button button-primary" href="#download">
                <Smartphone size={18} aria-hidden="true" /> Get the resident app{" "}
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
              <a className="button button-secondary" href="#features">
                Explore services <ArrowDown size={17} aria-hidden="true" />
              </a>
            </div>
            <p className="hero-location">
              <MapPin size={15} aria-hidden="true" /> Barangay Bancao-Bancao,
              Puerto Princesa City
            </p>
          </div>
          <div className="hero-phone">
            <Image
              src="/assets/Holding-the-phone.png"
              alt="A hand holding a phone displaying the Bancao Connect resident app."
              width={1920}
              height={1080}
              sizes="(min-width: 107.15em) 1200px, (min-width: 64em) 70vw, (min-width: 44em) 1056px, (min-width: 28em) 150vw, 672px"
              priority
            />
          </div>
        </div>
      </div>
      <div className="container assurance-strip">
        <div>
          <Building2 size={19} aria-hidden="true" />
          <span>Your barangay, online</span>
        </div>
        <div>
          <ShieldCheck size={19} aria-hidden="true" />
          <span>Verified resident access</span>
        </div>
        <div>
          <ClipboardList size={19} aria-hidden="true" />
          <span>Clearer request follow-ups</span>
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section
      className="section services-section"
      id="features"
      aria-labelledby="services-heading"
    >
      <div className="container">
        <div className="section-heading heading-row">
          <div>
            <p className="eyebrow">Resident services</p>
            <h2 id="services-heading">What can we help you with?</h2>
          </div>
          <p>
            Everyday barangay services.
            <br />
            One familiar place to start.
          </p>
        </div>
        <div className="services-grid">
          {services.map(
            ({
              id,
              number,
              title,
              description,
              icon: Icon,
              tone,
              guide,
              steps: guideSteps,
              note,
            }) => (
              <article className="service-card" id={id} key={id}>
                <div className="service-card-top">
                  <span className={`icon-box tone-${tone}`}>
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <span className="service-number" aria-hidden="true">
                    {number}
                  </span>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <details className="service-guide">
                  <summary>
                    {guide}
                    <ChevronDown size={17} aria-hidden="true" />
                  </summary>
                  <div className="guide-content">
                    <ol>
                      {guideSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <p>{note}</p>
                    <a className="text-link" href="#download">
                      Get the Android app{" "}
                      <ArrowRight size={16} aria-hidden="true" />
                    </a>
                  </div>
                </details>
              </article>
            ),
          )}
        </div>
        <p className="service-footnote">
          <Smartphone size={17} aria-hidden="true" /> These services are
          available in the Bancao Connect app after account approval.
        </p>
      </div>
    </section>
  );
}

function GettingStarted() {
  return (
    <section
      className="section getting-started"
      id="how-it-works"
      aria-labelledby="steps-heading"
    >
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">A little setup. A closer connection.</p>
          <h2 id="steps-heading">Your first steps start here.</h2>
          <p>
            From download to your first request, here’s how to get connected.
          </p>
        </div>
        <ol className="steps-grid">
          {steps.map(({ number, icon: Icon, title, description }) => (
            <li key={number} className="step">
              <div className="step-top">
                <span className="step-number">{number}</span>
                <Icon size={23} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
        <div className="registration-note">
          <span className="icon-box tone-blue">
            <UserCheck size={23} aria-hidden="true" />
          </span>
          <div>
            <h3>Before you begin</h3>
            <p>
              Have your contact details, Bancao-Bancao address, and valid
              identification ready.
            </p>
          </div>
          <a className="text-link" href="#faq">
            Registration help <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

function ResidentCare() {
  return (
    <section
      className="section community-section"
      id="about"
      aria-labelledby="community-heading"
    >
      <div className="container community-grid">
        <div className="office-card">
          <p className="eyebrow">Here for our barangay</p>
          <h2 id="community-heading">
            Digital convenience.
            <br />A familiar helping hand.
          </h2>
          <p>
            Bancao Connect brings everyday services closer. And when you need a
            little extra help, your barangay office is still here for you.
          </p>
          <div className="office-detail">
            <MapPin size={21} aria-hidden="true" />
            <div>
              <h3>Barangay Bancao-Bancao</h3>
              <p>Puerto Princesa City, Palawan</p>
            </div>
          </div>
          <div className="office-detail">
            <Clock3 size={21} aria-hidden="true" />
            <div>
              <h3>Visit during regular office hours</h3>
              <p>
                Monday to Friday. Confirm availability with the office before
                your visit.
              </p>
            </div>
          </div>
          <a className="text-link" href="#faq">
            Find answers before your visit{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
        <div className="privacy-card" id="security">
          <span className="icon-box tone-green">
            <ShieldCheck size={26} aria-hidden="true" />
          </span>
          <p className="eyebrow">Built on trust</p>
          <h2>
            Your information.
            <br />
            Handled with care.
          </h2>
          <p>
            Resident verification helps the barangay connect the right people
            with the right services.
          </p>
          <ul className="trust-list">
            <li>
              <Check size={17} aria-hidden="true" />
              <div>
                <strong>Verified resident accounts</strong>
                <span>
                  Barangay staff review registration details before granting
                  access.
                </span>
              </div>
            </li>
            <li>
              <Check size={17} aria-hidden="true" />
              <div>
                <strong>Access for authorized staff</strong>
                <span>
                  Office tools and resident services have separate access
                  levels.
                </span>
              </div>
            </li>
            <li>
              <Check size={17} aria-hidden="true" />
              <div>
                <strong>Your account, your updates</strong>
                <span>
                  Sign in to view your own submitted reports and requests.
                </span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Help() {
  return (
    <section
      className="section help-section"
      id="faq"
      aria-labelledby="help-heading"
    >
      <div className="container help-grid">
        <div className="section-heading">
          <p className="eyebrow">A helping hand</p>
          <h2 id="help-heading">
            A few things
            <br />
            you might be asking.
          </h2>
          <p>
            Getting started should feel simple. Here are answers to common
            resident questions.
          </p>
          <div className="help-note">
            <Building2 size={22} aria-hidden="true" />
            <div>
              <strong>Still need assistance?</strong>
              <p>
                Visit the barangay office for help with your account or a
                submitted request.
              </p>
              <a className="text-link" href="#about">
                Barangay office details{" "}
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
        <div className="faq-list">
          {faqs.map(({ question, answer }, index) => (
            <details key={question} name="resident-faq">
              <summary>
                <span className="faq-number" aria-hidden="true">
                  0{index + 1}
                </span>
                <span>{question}</span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Download() {
  return (
    <section
      className="download-section"
      id="download"
      aria-labelledby="download-heading"
    >
      <div className="container">
        <div className="download-panel">
          <div>
            <p className="eyebrow">Your barangay, in your pocket</p>
            <h2 id="download-heading">Let’s get you connected.</h2>
            <p>
              Download Bancao Connect and take the first step toward easier
              everyday barangay services.
            </p>
            <div className="button-row">
              <a
                className="button button-light"
                href="/downloads/BancaoConnect.apk"
                download
              >
                <ArrowDownToLine size={19} aria-hidden="true" /> Download for
                Android <ArrowUpRight size={17} aria-hidden="true" />
              </a>
              <a className="download-help" href="#how-it-works">
                Getting started guide{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
            <p className="download-note">
              Android APK · Resident account approval required
            </p>
          </div>
          <div className="download-brand" aria-hidden="true">
            <Image
              src="/assets/bancao-connect-mark-community.svg"
              alt=""
              width={100}
              height={100}
            />
            <strong>
              Bancao
              <br />
              Connect.
            </strong>
            <span>Closer to your community.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <a className="brand" href="#top" aria-label="Bancao Connect home">
              <Image
                src="/assets/bancao-connect-mark-community.svg"
                alt=""
                width={40}
                height={40}
              />
              <span>
                Bancao
                <br />
                Connect.
              </span>
            </a>
            <p>
              A closer connection between
              <br />
              our barangay and our community.
            </p>
          </div>
          <nav aria-label="Resident services">
            <h2>Explore</h2>
            <a href="#features">Resident services</a>
            <a href="#how-it-works">Getting started</a>
            <a href="#download">Download the app</a>
          </nav>
          <nav aria-label="Help and information">
            <h2>We’re here to help</h2>
            <a href="#about">Barangay office</a>
            <a href="#faq">Common questions</a>
            <a href="#security">Privacy & access</a>
          </nav>
          <div className="footer-location">
            <span className="icon-box tone-blue">
              <Building2 size={23} aria-hidden="true" />
            </span>
            <h2>Barangay Bancao-Bancao</h2>
            <p>
              Puerto Princesa City
              <br />
              Palawan, Philippines
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Bancao Connect.</span>
          <span>Built for a more connected barangay.</span>
          <a href="#top">
            Back to top <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}
