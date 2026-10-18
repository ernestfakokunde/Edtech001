import { ArrowLeft, ArrowUpRight, ShieldCheck, Scale } from "lucide-react";
import type { ReactNode } from "react";
import { go } from "../components/Layout";

function LegalFrame({ kind, children }: { kind: "privacy" | "terms"; children: ReactNode }) {
  const privacy = kind === "privacy";
  return <main className="legal-page">
    <button className="legal-back" onClick={() => go("home")}><ArrowLeft size={15} /> Back to RecappEdu</button>
    <header className="legal-heading">
      <span className="legal-icon">{privacy ? <ShieldCheck size={21} /> : <Scale size={21} />}</span>
      <p className="eyebrow">RecappEdu · {privacy ? "Your information" : "Using the platform"}</p>
      <h1>{privacy ? "Privacy, in plain language." : "A fair way to study together."}</h1>
      <p>{privacy ? "Here’s what we collect when you use RecappEdu, why we need it, and the choices you have." : "These terms explain what you can expect from RecappEdu and what we ask of everyone who uses it."}</p>
      <small>Last updated 17 October 2026</small>
    </header>
    <article className="legal-content">{children}</article>
    <aside className="legal-contact"><div><strong>Need help or want to ask about this page?</strong><span>Email the RecappEdu team and we’ll get back to you.</span><a href="mailto:ernest.dev10@gmail.com">ernest.dev10@gmail.com</a></div><a className="legal-contact-action" href="mailto:ernest.dev10@gmail.com">Send an email <ArrowUpRight size={15} /></a></aside>
  </main>;
}

export function PrivacyPage() {
  return <LegalFrame kind="privacy">
    <section><h2>1. Who this applies to</h2><p>This notice covers your use of RecappEdu, including the website, course repository, paper uploads, and study tools. RecappEdu is designed to help students turn past papers into practice material.</p></section>
    <section><h2>2. Information you give us</h2><p>When you create an account, we use your name, email address, and password. Your password is stored as a derived hash, not as readable text. You may also add a username, university, faculty, and saved courses.</p><p>If you upload a paper, we receive the file and the details you provide about its course, year, level, semester, and description. Uploaded papers remain private to your account unless you choose to submit them for repository review. Approved submissions may be made available to other students.</p></section>
    <section><h2>3. Study activity and information collected automatically</h2><p>We store generated study sets, quiz attempts, saved-course choices, rewards, and account activity so the app can show your progress and provide its features. Quiz history may also be saved in this browser so it remains available if the connection is interrupted. You can clear browser storage in your device settings.</p><p>For Learn with AI, readable text from your PDF or the topic you choose, along with your questions, is sent to the configured AI service to create answers. The document text and chat stay in the active page session and are not saved as a Learn with AI conversation by RecappEdu; leaving the page clears that session.</p><p>Our server receives ordinary technical information needed to handle requests and protect accounts, such as IP address, browser request details, and session activity. The session is carried in an HTTP-only cookie.</p></section>
    <section><h2>4. How we use information</h2><p>We use information to create and secure accounts, store your study materials, generate practice sets, show your history, moderate shared submissions, provide rewards, process optional Pro payments, and troubleshoot the service. Uploaded documents may be sent to the configured document-processing and AI services to extract text and create study materials. Do not upload sensitive personal information or documents you do not have permission to use.</p></section>
    <section><h2>5. When information is shared</h2><p>We do not make your private uploads visible to other students. If you submit a paper and it is approved, its document and associated course details can be shared in the repository. Administrators can review submissions and account activity to operate and moderate the service.</p><p>We rely on service providers for hosting, database and file storage, AI processing, and payment processing. They receive only the information needed to provide those services and handle it under their own terms. A payment provider may process payment details; RecappEdu does not store your full card details.</p></section>
    <section><h2>6. How long we keep information</h2><p>We keep account information and study content while your account is active and as needed to operate the service. You can request account deletion from your profile. Deletion removes your profile, owned papers and generated sets, and ends your session. Some deletion records may be retained for up to 6 months under our data retention policy. Browser-stored quiz history is separate and may need to be cleared on your device.</p></section>
    <section><h2>7. Your choices</h2><p>You can update your profile and school details, remove saved courses, delete eligible uploads, and request account deletion from your profile. You can choose whether to submit a private upload for review. You may also stop using the service and clear site data from your browser.</p></section>
    <section><h2>8. Keeping your account safe</h2><p>Use a unique password and sign out on shared devices. We take steps to protect accounts and files, but no website or internet transmission can be guaranteed completely secure. Tell us if you believe someone has accessed your account without permission.</p></section>
    <section><h2>9. Changes and questions</h2><p>We may update this notice as the service changes. We will update the date at the top when we do. For questions or privacy requests, sign in and contact the RecappEdu team.</p></section>
  </LegalFrame>;
}

export function TermsPage() {
  return <LegalFrame kind="terms">
    <section><h2>1. What RecappEdu provides</h2><p>RecappEdu offers tools for browsing course materials, uploading papers, and generating flashcards or quizzes for personal study. Features may change as we improve the platform. AI-generated material can contain errors, so check it against your source and course guidance.</p></section>
    <section><h2>2. Your account</h2><p>Give accurate account details, keep your password private, and tell us if you suspect unauthorised access. You are responsible for activity carried out through your account. We may restrict access when needed to protect users, the platform, or its materials.</p></section>
    <section><h2>3. Papers and permissions</h2><p>Only upload materials you have the right to use. By keeping a paper private, you make it available to your own account for study features. If you submit it and it is approved, you ask us to host and display it in the shared repository so other students can study from it. Do not submit confidential exams, personal data, or material that you are not permitted to share.</p><p>We may review, reject, remove, or limit access to content to protect students, respect rights, and keep the repository useful. Uploading a document does not transfer ownership of it to RecappEdu.</p></section>
    <section><h2>4. Appropriate use</h2><p>Use the service for lawful learning. Do not upload malware, infringe someone’s rights, harass others, attempt to access another person’s account, disrupt the service, or misuse generated content. Do not present AI-generated questions or answers as official course material.</p></section>
    <section><h2>5. Study tools and availability</h2><p>Generated content is a study aid, not an official answer key, academic advice, or a guarantee of exam results. You are responsible for checking answers and following your institution’s rules. We work to keep RecappEdu available, but maintenance, network issues, or provider outages may temporarily interrupt a feature.</p></section>
    <section><h2>6. Free and paid features</h2><p>Some features may have usage limits. Optional Pro access and its price, duration, and included features are shown before checkout. Payments are handled by the payment provider shown during checkout. Any refund or cancellation rights that apply under local law remain unaffected by these terms.</p></section>
    <section><h2>7. Your content and account deletion</h2><p>You keep your rights to materials you upload. You are responsible for having permission to use them as described above. You can delete your account from your profile; this removes your profile, owned papers, and generated sets. Some deletion records may be retained for up to 6 months under our data retention policy.</p></section>
    <section><h2>8. Changes to these terms</h2><p>We may update these terms when RecappEdu changes. The date at the top shows when this page was last updated. Continued use after an update means you accept the revised terms where applicable.</p></section>
    <section><h2>9. Questions</h2><p>If something is unclear or you need to report a problem, sign in and contact the RecappEdu team.</p></section>
  </LegalFrame>;
}
