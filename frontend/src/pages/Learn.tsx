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

  return <main className="mx-auto w-full max-w-[1080px] px-[clamp(18px,4vw,44px)] pb-64 pt-38 max-680:px-15 max-680:pb-42 max-680:pt-25">
    <header className="mb-28 flex items-center justify-between gap-24 max-680:mb-21 max-680:items-start [&>div:first-child>.eyebrow]:mb-11 [&>div:first-child>.eyebrow]:gap-7 [&>div:first-child>h1]:m-0 [&>div:first-child>h1]:text-[clamp(31px,4vw,42px)] [&>div:first-child>h1]:leading-[1.1] [&>div:first-child>h1]:text-ink [&>div:first-child>p:last-child]:mt-11 [&>div:first-child>p:last-child]:max-w-[600px] [&>div:first-child>p:last-child]:text-14 [&>div:first-child>p:last-child]:leading-[1.65] [&>div:first-child>p:last-child]:text-muted max-680:[&>div:first-child>p:last-child]:text-13">
      <div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand"><Sparkles size={14} /> Your personal study tutor</p><h1>Learn with AI</h1><p>Type anything you want to learn, or bring your notes. Get clear explanations at your own pace.</p></div>
      <div className="relative grid size-64 shrink-0 place-items-center rounded-20 border border-[#dbeafe] bg-[linear-gradient(145deg,#fff,#eff6ff)] text-brand shadow-[0_12px_28px_#1d4ed814] max-680:size-49 max-680:rounded-15 [&>svg:last-child]:absolute [&>svg:last-child]:-right-5 [&>svg:last-child]:-top-5 [&>svg:last-child]:size-22 [&>svg:last-child]:rounded-full [&>svg:last-child]:border-2 [&>svg:last-child]:border-white [&>svg:last-child]:bg-brand [&>svg:last-child]:p-3 [&>svg:last-child]:text-white"><MessageCircle size={25} /><Sparkles size={15} /></div>
    </header>

    {!sessionTitle ? <section className={`mx-auto max-w-[850px] rounded-[24px] border bg-white p-[clamp(24px,5vw,46px)] text-center shadow-[0_18px_48px_#1e3a8a0b] transition max-680:rounded-[19px] max-680:px-18 max-680:py-25 ${dragging ? "border-[#3b82f6] bg-[#f4f8ff]" : "border-[#e1e9f5]"} [&>h2]:m-0 [&>h2]:text-[22px] [&>h2]:tracking-[-.03em] [&>h2]:text-ink max-680:[&>h2]:text-[20px] [&>p:not(.learn-error)]:mx-auto [&>p:not(.learn-error)]:mb-19 [&>p:not(.learn-error)]:mt-9 [&>p:not(.learn-error)]:max-w-[510px] [&>p:not(.learn-error)]:text-13 [&>p:not(.learn-error)]:leading-[1.65] [&>p:not(.learn-error)]:text-muted [&>input[type=file]]:hidden [&>.primary-button]:min-h-45 [&>.primary-button]:px-17`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <span className="mx-auto mb-17 grid size-52 place-items-center rounded-17 border border-[#dbeafe] bg-[#eff6ff] text-brand"><Lightbulb size={23} /></span>
      <h2>What would you like to learn?</h2>
      <p>Type any subject, skill, or idea. Your AI tutor will explain it clearly and follow your curiosity.</p>
      <form className="mx-auto mt-20 max-w-[630px] text-left [&>label]:mb-7 [&>label]:ml-2 [&>label]:block [&>label]:text-11 [&>label]:font-bold [&>label]:text-ink [&>div]:flex [&>div]:gap-9 max-680:[&>div]:flex-col max-680:[&>div]:items-stretch [&_input]:h-45 [&_input]:min-w-0 [&_input]:flex-1 [&_input]:rounded-10 [&_input]:border [&_input]:border-[#dbe4f0] [&_input]:bg-white [&_input]:px-13 [&_input]:text-13 [&_input]:text-ink [&_input]:outline-none [&_input:focus]:border-outline [&_input:focus]:shadow-focus [&_.primary-button]:min-h-45 [&_.primary-button]:whitespace-nowrap [&_.primary-button]:px-14 max-680:[&_input]:w-full max-680:[&_.primary-button]:w-full" onSubmit={startTopicSession}>
        <label htmlFor="learn-topic">Enter a topic to get started</label>
        <div><input id="learn-topic" maxLength={200} value={topicInput} onChange={(event) => setTopicInput(event.target.value)} placeholder="e.g. Photosynthesis, algebra, Nigerian history..." /><button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" type="submit" disabled={topicInput.trim().length < 2}><Sparkles size={15} /> Start learning</button></div>
      </form>
      <span className="mt-11 block text-11 text-slate-icon">Ask follow-up questions or change direction whenever you like.</span>
      <div className="mx-auto mt-24 flex max-w-[630px] flex-wrap items-center justify-center gap-x-12 gap-y-9 border-t border-[#eef2f7] pt-19 [&>span]:text-11 [&>span]:text-muted [&>button]:inline-flex [&>button]:items-center [&>button]:gap-7 [&>button]:rounded-9 [&>button]:border [&>button]:border-[#dbe4f0] [&>button]:bg-white [&>button]:px-11 [&>button]:py-8 [&>button]:text-11 [&>button]:font-bold [&>button]:text-brand [&>button:hover]:border-[#bfdbfe] [&>button:hover]:bg-[#f8fbff] [&>button:disabled]:opacity-65 [&>small]:basis-full [&>small]:text-10 [&>small]:text-slate-icon"><span>Have notes or an exam PDF?</span><button type="button" disabled={uploading} onClick={() => fileInput.current?.click()}><Upload size={14} /> {uploading ? "Reading your PDF..." : "Upload a PDF instead"}</button><input ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={(event) => void chooseFile(event.target.files?.[0])} /><small>PDF up to 10 MB; selectable text required.</small></div>

      {error && <p className="mx-auto mt-12 text-12 leading-150 text-red-700">{error}</p>}
      <div className="mt-34 grid grid-cols-3 gap-12 border-t border-[#eef2f7] pt-24 text-left max-680:mt-25 max-680:grid-cols-1 max-680:gap-15 max-680:pt-20 [&>div]:flex [&>div]:items-start [&>div]:gap-10 [&>div]:text-brand [&_span]:grid [&_span]:gap-4 [&_strong]:text-11 [&_strong]:text-ink [&_small]:text-10 [&_small]:leading-145 [&_small]:text-slate-icon"><div><BookOpen size={16} /><span><strong>Made for understanding</strong><small>Clear explanations and useful examples</small></span></div><div><Lightbulb size={16} /><span><strong>Learn at your pace</strong><small>Ask follow-ups whenever you need</small></span></div><div><MessageCircle size={16} /><span><strong>Private study session</strong><small>Chat is cleared when you leave this page</small></span></div></div>
    </section> : <section className="mx-auto min-h-[540px] max-w-[850px] overflow-hidden rounded-20 border border-[#e2eaf4] bg-white shadow-[0_18px_48px_#1e3a8a0b] max-680:min-h-[500px] max-680:rounded-16">
      <div className="flex items-center justify-between gap-12 border-b border-[#e9eef6] bg-[#fbfdff] px-19 py-15 max-680:p-12"><div className="flex min-w-0 items-center gap-10 [&>span]:grid [&>span]:size-37 [&>span]:shrink-0 [&>span]:place-items-center [&>span]:rounded-11 [&>span]:bg-[#eff6ff] [&>span]:text-brand [&>div]:grid [&>div]:min-w-0 [&>div]:gap-3 [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-12 [&_strong]:text-ink [&_small]:text-10 [&_small]:text-muted max-680:[&_strong]:max-w-[48vw]"><span>{isTopicSession ? <Lightbulb size={16} /> : <FileText size={16} />}</span><div><strong>{sessionTitle}</strong><small>{isTopicSession ? "Topic-based learning" : truncated ? "Using the first section of the PDF" : "Ready for your questions"}</small></div></div><button className="inline-flex shrink-0 items-center gap-6 rounded-9 border border-[#e2e8f0] bg-white px-10 py-8 text-11 font-semibold text-muted hover:border-[#bfdbfe] hover:text-brand max-680:p-7 max-680:text-[0px] max-680:[&_svg]:size-16" onClick={resetSession}><RotateCcw size={14} /> Start over</button></div>
      {truncated && <p className="m-0 bg-amber-50 px-18 py-9 text-11 text-amber-800">This file is long, so the tutor is using its first section. Ask about the topics covered there.</p>}
      <div className="grid min-h-[280px] max-h-[min(52vh,540px)] content-start gap-20 overflow-y-auto px-[clamp(15px,4vw,30px)] py-23 max-680:min-h-[250px] max-680:max-h-[48vh] max-680:gap-15 max-680:px-12 max-680:py-18" aria-live="polite">
        {messages.map((message, index) => <article key={`${index}-${message.role}`} className={`flex items-start gap-10 max-680:gap-7 ${message.role === "user" ? "flex-row-reverse" : ""}`}><span className="grid size-31 shrink-0 place-items-center rounded-11 border border-[#dbeafe] bg-[#eff6ff] text-[9px] font-bold text-brand max-680:size-28">{message.role === "assistant" ? <Sparkles size={15} /> : "You"}</span><div className={`grid max-w-[min(680px,86%)] gap-2 rounded-[4px_14px_14px_14px] border border-[#e9eef6] bg-[#f8fafc] px-13 py-10 max-680:max-w-[88%] max-680:px-10 max-680:py-9 [&>small]:text-[9px] [&>small]:font-bold [&>small]:uppercase [&>small]:tracking-[.05em] [&>small]:text-muted [&>p]:mt-5 [&>p]:whitespace-pre-wrap [&>p]:break-words [&>p]:text-13 [&>p]:leading-170 [&>p]:text-ink max-680:[&>p]:text-12 ${message.role === "user" ? "rounded-[14px_4px_14px_14px] border-[#dbeafe] bg-[#eff6ff]" : ""}`}><small>{message.role === "assistant" ? "AI tutor" : "You"}</small><p>{message.content}</p></div></article>)}
        {busy && <article className="flex items-start gap-10 max-680:gap-7"><span className="grid size-31 shrink-0 place-items-center rounded-11 border border-[#dbeafe] bg-[#eff6ff] text-[9px] font-bold text-brand max-680:size-28"><Sparkles size={15} /></span><div className="grid max-w-[min(680px,86%)] gap-2 rounded-[4px_14px_14px_14px] border border-[#e9eef6] bg-[#f8fafc] px-13 py-10 max-680:max-w-[88%] max-680:px-10 max-680:py-9 [&>small]:text-[9px] [&>small]:font-bold [&>small]:uppercase [&>small]:tracking-[.05em] [&>small]:text-muted [&>p]:mt-5 [&>p]:text-13 [&>p]:leading-170 [&>p]:text-ink"><small>AI tutor</small><p className="inline-flex items-center gap-8 text-muted"><LoaderCircle className="animate-spin" size={15} /> Thinking...</p></div></article>}
        <div ref={bottom} />
      </div>
      {messages.length <= 1 && <div className="flex flex-wrap items-center gap-7 px-[clamp(15px,4vw,30px)] pb-14 max-680:gap-6 max-680:px-12 [&>span]:w-full [&>span]:text-10 [&>span]:text-slate-icon [&>button]:inline-flex [&>button]:items-center [&>button]:gap-7 [&>button]:rounded-full [&>button]:border [&>button]:border-[#dbeafe] [&>button]:bg-[#f8fbff] [&>button]:px-10 [&>button]:py-8 [&>button]:text-10 [&>button]:font-semibold [&>button]:text-brand [&>button:hover]:bg-[#eff6ff] max-680:[&>button]:text-[9px]"><span>Try asking</span>{suggestions.map((item) => <button key={item} disabled={busy} onClick={() => void sendQuestion(undefined, item)}>{item}<ArrowUp size={13} /></button>)}</div>}
      {error && <p className="mx-19 mb-9 text-12 leading-150 text-red-700 max-680:mx-10">{error}</p>}
      <form className="relative mx-19 grid grid-cols-[1fr_36px] items-center gap-8 rounded-14 border border-[#dbe4f0] bg-white px-14 pb-23 pt-9 shadow-[0_5px_15px_#0f172a08] focus-within:border-outline focus-within:shadow-focus max-680:mx-10 [&>textarea]:max-h-100 [&>textarea]:w-full [&>textarea]:resize-y [&>textarea]:border-0 [&>textarea]:text-13 [&>textarea]:leading-150 [&>textarea]:text-ink [&>textarea]:outline-0 [&>textarea]:placeholder:text-slate-icon [&>button]:grid [&>button]:size-34 [&>button]:place-items-center [&>button]:rounded-11 [&>button]:bg-brand [&>button]:text-white [&>button:disabled]:cursor-not-allowed [&>button:disabled]:bg-[#e2e8f0] [&>button:disabled]:text-slate-icon [&>small]:absolute [&>small]:bottom-5 [&>small]:left-15 [&>small]:text-[9px] [&>small]:text-muted" onSubmit={(event) => void sendQuestion(event)}><textarea aria-label="Ask your AI tutor" maxLength={2000} rows={1} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={onComposerKeyDown} placeholder={isTopicSession ? `Ask about ${activeTopic}...` : "Ask a question about your PDF..."} disabled={busy} /><button type="submit" aria-label="Send question" disabled={!question.trim() || busy}><ArrowUp size={17} /></button><small>Enter to send Â· Shift + Enter for a new line</small></form>
      <p className="mx-18 mb-15 mt-9 text-center text-10 text-muted">AI can make mistakes. Check important details against your original material.</p>
    </section>}
  </main>;
}
