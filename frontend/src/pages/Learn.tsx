import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type DragEvent } from "react";
import { ArrowUp, BookOpen, FileText, Lightbulb, LoaderCircle, MessageCircle, RotateCcw, Sparkles, Upload } from "lucide-react";
import { askLearnTutor, errorMessage, uploadFileProblem, uploadLearnDocument, type LearnChatMessage } from "../lib/api";

const DOCUMENT_SUGGESTIONS = ["Summarise the key ideas", "Explain a difficult concept", "Quiz me on this material"];
const TOPIC_SUGGESTIONS = ["Teach me the basics", "Give me a learning roadmap", "Ask me a warm-up question"];

export function LearnWithAI() {
  const [topicInput, setTopicInput] = useState("");
  const [activeTopic, setActiveTopic] = useState("");
  const [fileTitle, setFileTitle] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [messages, setMessages] = useState<LearnChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const sessionTitle = fileTitle || activeTopic;
  const isTopicSession = Boolean(activeTopic);
  const suggestions = isTopicSession ? TOPIC_SUGGESTIONS : DOCUMENT_SUGGESTIONS;

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  async function chooseFile(file?: File) {
    if (!file) return;
    setError("");
    const issue = uploadFileProblem(file);
    if (issue) { setError(issue); return; }
    if (!file.name.toLowerCase().endsWith(".pdf")) { setError("Learn with AI currently supports PDF files."); return; }
    setUploading(true);
    try {
      const result = await uploadLearnDocument(file);
      setFileTitle(result.title);
      setActiveTopic("");
      setDocumentText(result.documentText);
      setTruncated(result.truncated);
      setMessages([{ role: "assistant", content: `I've read ${result.title}. What would you like to understand or revise? I'll keep my answers grounded in your document.` }]);
      setQuestion("");
    } catch (reason) { setError(errorMessage(reason, "We could not read this PDF. Try another file.")); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  function startTopicSession(event: FormEvent) {
    event.preventDefault();
    const topic = topicInput.trim();
    if (topic.length < 2) { setError("Enter a topic with at least two characters."); return; }
    setError("");
    setActiveTopic(topic);
    setFileTitle("");
    setDocumentText("");
    setTruncated(false);
    setMessages([{ role: "assistant", content: `Let's learn about ${topic}. Tell me what you already know, or choose a prompt below and we'll start from there.` }]);
  }

  async function sendQuestion(event?: FormEvent, suggestion?: string) {
    event?.preventDefault();
    const asked = (suggestion ?? question).trim();
    if (!asked || (!documentText && !activeTopic) || busy) return;
    setQuestion(""); setError(""); setBusy(true);
    try {
      const result = await askLearnTutor({ documentText: documentText || undefined, topic: activeTopic || undefined, question: asked, history: messages.slice(-8) });
      setMessages((current) => [...current, { role: "user", content: asked }, { role: "assistant", content: result.answer }]);
    } catch (reason) {
      setQuestion(asked);
      setError(errorMessage(reason, "Your tutor could not answer just now. Please try again."));
    } finally { setBusy(false); }
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault(); setDragging(false); void chooseFile(event.dataTransfer.files[0]);
  }
  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendQuestion(); }
  }
  function resetSession() { setFileTitle(""); setActiveTopic(""); setTopicInput(""); setDocumentText(""); setMessages([]); setQuestion(""); setError(""); setTruncated(false); }

  return <main className="learn-page">
    <header className="learn-heading">
      <div><p className="eyebrow"><Sparkles size={14} /> Your personal study tutor</p><h1>Learn with AI</h1><p>Type anything you want to learn, or bring your notes. Get clear explanations at your own pace.</p></div>
      <div className="learn-heading-mark"><MessageCircle size={25} /><Sparkles size={15} /></div>
    </header>

    {!sessionTitle ? <section className={`learn-upload-card ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <span className="learn-upload-icon"><Lightbulb size={23} /></span>
      <h2>What would you like to learn?</h2>
      <p>Type any subject, skill, or idea. Your AI tutor will explain it clearly and follow your curiosity.</p>
      <form className="learn-topic-form" onSubmit={startTopicSession}>
        <label htmlFor="learn-topic">Enter a topic to get started</label>
        <div><input id="learn-topic" maxLength={200} value={topicInput} onChange={(event) => setTopicInput(event.target.value)} placeholder="e.g. Photosynthesis, algebra, Nigerian history..." /><button className="primary-button" type="submit" disabled={topicInput.trim().length < 2}><Sparkles size={15} /> Start learning</button></div>
      </form>
      <span className="learn-upload-hint">Ask follow-up questions or change direction whenever you like.</span>
      <div className="learn-pdf-option"><span>Have notes or a past paper?</span><button type="button" disabled={uploading} onClick={() => fileInput.current?.click()}><Upload size={14} /> {uploading ? "Reading your PDF..." : "Upload a PDF instead"}</button><input ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={(event) => void chooseFile(event.target.files?.[0])} /><small>PDF up to 10 MB; selectable text required.</small></div>

      {error && <p className="learn-error">{error}</p>}
      <div className="learn-benefits"><div><BookOpen size={16} /><span><strong>Made for understanding</strong><small>Clear explanations and useful examples</small></span></div><div><Lightbulb size={16} /><span><strong>Learn at your pace</strong><small>Ask follow-ups whenever you need</small></span></div><div><MessageCircle size={16} /><span><strong>Private study session</strong><small>Chat is cleared when you leave this page</small></span></div></div>
    </section> : <section className="learn-workspace">
      <div className="learn-workspace-top"><div className="learn-document-chip"><span>{isTopicSession ? <Lightbulb size={16} /> : <FileText size={16} />}</span><div><strong>{sessionTitle}</strong><small>{isTopicSession ? "Topic-based learning" : truncated ? "Using the first section of the PDF" : "Ready for your questions"}</small></div></div><button className="learn-new-doc" onClick={resetSession}><RotateCcw size={14} /> Start over</button></div>
      {truncated && <p className="learn-truncated-note">This file is long, so the tutor is using its first section. Ask about the topics covered there.</p>}
      <div className="learn-messages" aria-live="polite">
        {messages.map((message, index) => <article key={`${index}-${message.role}`} className={`learn-message ${message.role}`}><span className="learn-message-avatar">{message.role === "assistant" ? <Sparkles size={15} /> : "You"}</span><div className="learn-message-body"><small>{message.role === "assistant" ? "AI tutor" : "You"}</small><p>{message.content}</p></div></article>)}
        {busy && <article className="learn-message assistant"><span className="learn-message-avatar"><Sparkles size={15} /></span><div className="learn-message-body"><small>AI tutor</small><p className="learn-thinking"><LoaderCircle className="spin" size={15} /> Thinking...</p></div></article>}
        <div ref={bottom} />
      </div>
      {messages.length <= 1 && <div className="learn-suggestions"><span>Try asking</span>{suggestions.map((item) => <button key={item} disabled={busy} onClick={() => void sendQuestion(undefined, item)}>{item}<ArrowUp size={13} /></button>)}</div>}
      {error && <p className="learn-error learn-chat-error">{error}</p>}
      <form className="learn-composer" onSubmit={(event) => void sendQuestion(event)}><textarea aria-label="Ask your AI tutor" maxLength={2000} rows={1} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={onComposerKeyDown} placeholder={isTopicSession ? `Ask about ${activeTopic}...` : "Ask a question about your PDF..."} disabled={busy} /><button type="submit" aria-label="Send question" disabled={!question.trim() || busy}><ArrowUp size={17} /></button><small>Enter to send · Shift + Enter for a new line</small></form>
      <p className="learn-disclaimer">AI can make mistakes. Check important details against your original material.</p>
    </section>}
  </main>;
}
