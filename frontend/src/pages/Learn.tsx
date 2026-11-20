import { useEffect, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, FileText, Lightbulb, Paperclip, RotateCcw, Sparkles } from "lucide-react";
import { askLearnTutor, errorMessage, getLearnChat, listLearnChats, uploadFileProblem, uploadLearnDocument, type AiCreditQuota, type LearnChatMessage, type SavedLearnChat } from "../lib/api";

const DOCUMENT_SUGGESTIONS = ["Summarise the key ideas", "Explain a difficult concept", "Quiz me on this material"];
const TOPIC_SUGGESTIONS = ["Give me a learning roadmap", "Ask me a warm-up question"];

function displayTutorText(content: string) {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s*#+\s*/gm, "")
    .replace(/^\s*\*\s+/gm, "• ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

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
  const [quota, setQuota] = useState<AiCreditQuota | null>(null);
  const [chatId, setChatId] = useState<string | undefined>();
  const [savedChats, setSavedChats] = useState<SavedLearnChat[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const sessionTitle = fileTitle || activeTopic;
  const isTopicSession = Boolean(activeTopic);
  const suggestions = isTopicSession ? TOPIC_SUGGESTIONS : DOCUMENT_SUGGESTIONS;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    listLearnChats().then(({ chats }) => setSavedChats(chats)).catch(() => undefined);
  }, []);

  async function openSavedChat(id: string) {
    setError("");
    setBusy(true);
    try {
      const { chat } = await getLearnChat(id);
      setChatId(chat.id);
      setFileTitle(chat.documentName ?? "");
      setActiveTopic(chat.topic ?? "");
      setDocumentText(chat.documentText ?? "");
      setMessages(chat.messages);
      setQuota(null);
    } catch (reason) { setError(errorMessage(reason, "We could not open that chat. Please try again.")); }
    finally { setBusy(false); }
  }

  function startNewChat() {
    setChatId(undefined);
    setFileTitle(""); setActiveTopic(""); setTopicInput(""); setDocumentText("");
    setMessages([]); setQuestion(""); setError(""); setTruncated(false);
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    setError("");
    const issue = uploadFileProblem(file);
    if (issue) { setError(issue); return; }
    if (!file.name.toLowerCase().endsWith(".pdf")) { setError("Learn with AI currently supports PDF files."); return; }
    setUploading(true);
    try {
      const result = await uploadLearnDocument(file);
      setChatId(undefined);
      setFileTitle(result.title);
      setActiveTopic("");
      setDocumentText(result.documentText);
      setTruncated(result.truncated);
      setMessages([{ role: "assistant", content: `I've read ${result.title}. What would you like to understand or revise? I'll keep my answers grounded in your document.` }]);
      setQuestion("");
    } catch (reason) { setError(errorMessage(reason, "We could not read this PDF. Try another file.")); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function startTopicSession(event: FormEvent) {
    event.preventDefault();
    const topic = topicInput.trim();
    if (topic.length < 2) { setError("Enter a topic with at least two characters."); return; }
    setError("");
    setChatId(undefined);
    setActiveTopic(topic);
    setFileTitle("");
    setDocumentText("");
    setTruncated(false);
    // Keep the student's exact intent visible in the conversation. The server
    // receives the same text and decides how to respond safely.
    setMessages([{ role: "user", content: topic }]);
    setTopicInput("");
    setBusy(true);
    try {
      setMessages((current) => [...current, { role: "assistant", content: "" }]);
      const result = await askLearnTutor({
        topic,
        question: topic,
        history: [],
      }, (chunk) => setMessages((current) => current.map((message, index) => index === current.length - 1 && message.role === "assistant" ? { ...message, content: message.content + chunk } : message)));
      setChatId(result.chatId);
      void listLearnChats().then(({ chats }) => setSavedChats(chats)).catch(() => undefined);
      setQuota(result.quota);
    } catch (reason) {
      setMessages([]);
      setError(errorMessage(reason, "Your tutor could not start this lesson. Please try again."));
    } finally { setBusy(false); }
  }

  async function sendQuestion(event?: FormEvent, suggestion?: string) {
    event?.preventDefault();
    const asked = (suggestion ?? question).trim();
    if (!asked || (!documentText && !activeTopic) || busy) return;
    // Keep every turn within the backend's request validation limit. Tutor
    // replies can be longer than that after streaming a full explanation.
    const history = messages.slice(-20).map((message) => ({ ...message, content: message.content.slice(0, 2000) }));
    setQuestion(""); setError(""); setBusy(true);
    setMessages((current) => [...current, { role: "user", content: asked }]);
    try {
      setMessages((current) => [...current, { role: "assistant", content: "" }]);
      const result = await askLearnTutor({ documentText: documentText || undefined, documentName: fileTitle || undefined, topic: activeTopic || undefined, question: asked, history, chatId }, (chunk) => setMessages((current) => current.map((message, index) => index === current.length - 1 && message.role === "assistant" ? { ...message, content: message.content + chunk } : message)));
      setChatId(result.chatId);
      void listLearnChats().then(({ chats }) => setSavedChats(chats)).catch(() => undefined);
      setQuota(result.quota);
    } catch (reason) {
      setMessages((current) => current.slice(0, -1).filter((message, index, all) => !(index === all.length - 1 && message.role === "user")));
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

  function resetSession() {
    startNewChat();
  }

  return (
    <main
      className={`learn-chat-page flex min-h-[calc(100dvh-64px)] justify-center gap-16 px-[clamp(10px,3vw,24px)] ${dragging ? "bg-pale" : "bg-wash"}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <aside className="flex w-[210px] shrink-0 flex-col border-r border-line py-20 max-760:hidden" aria-label="Past chats">
        <button className="mb-16 flex min-h-38 items-center justify-center gap-7 rounded-10 border border-line bg-white px-10 text-11 font-semibold text-ink hover:border-brand hover:text-brand" onClick={startNewChat}><RotateCcw size={13} /> New chat</button>
        <h2 className="mb-8 px-5 text-10 font-bold uppercase tracking-[.08em] text-muted">Recent chats</h2>
        <nav className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          {savedChats.map((chat) => <button key={chat.id} onClick={() => void openSavedChat(chat.id)} className={`rounded-9 px-9 py-8 text-left transition-colors hover:bg-white ${chat.id === chatId ? "bg-white text-brand shadow-sm" : "text-ink"}`}>
            <span className="block truncate text-11 font-semibold">{chat.title}</span>
            <span className="mt-3 block truncate text-9 text-muted">{chat.preview || "No messages yet"}</span>
          </button>)}
          {!savedChats.length && <p className="px-5 text-10 leading-150 text-muted">Your chats will appear here.</p>}
        </nav>
      </aside>
      <section className="flex w-full max-w-[820px] flex-1 flex-col px-[clamp(10px,2vw,18px)]">
        <details className="mb-8 rounded-10 border border-line bg-white px-11 py-8 md:hidden">
          <summary className="cursor-pointer text-11 font-semibold text-ink">Past chats ({savedChats.length})</summary>
          <div className="mt-8 flex max-h-180 flex-col gap-4 overflow-y-auto">
            <button className="rounded-8 px-8 py-7 text-left text-11 font-semibold text-brand hover:bg-pale" onClick={startNewChat}>＋ New chat</button>
            {savedChats.map((chat) => <button key={chat.id} onClick={() => void openSavedChat(chat.id)} className="rounded-8 px-8 py-7 text-left hover:bg-pale">
              <span className="block truncate text-11 font-semibold text-ink">{chat.title}</span>
              <span className="block truncate text-9 text-muted">{chat.preview}</span>
            </button>)}
          </div>
        </details>
        {sessionTitle && <div className="learn-session-context">
          <div className="flex min-w-0 items-center gap-9">
            <span className="grid size-30 shrink-0 place-items-center rounded-9 bg-pale text-brand">{isTopicSession ? <Lightbulb size={15} /> : <FileText size={15} />}</span>
            <div className="min-w-0"><strong className="block truncate text-11 text-ink">{sessionTitle}</strong><small className="block truncate text-9 text-muted">{truncated ? "Using the first section of your PDF" : "Private study session"}</small></div>
          </div>
          <div className="flex shrink-0 items-center gap-8">{quota && <span className="rounded-full bg-pale px-9 py-6 text-10 font-semibold text-brand">{quota.remaining} credits</span>}<button className="inline-flex shrink-0 items-center gap-6 rounded-9 border border-line bg-white px-10 py-8 text-11 font-semibold text-muted hover:border-brand hover:text-brand" onClick={resetSession}><RotateCcw size={14} /> New chat</button></div>
        </div>}
        <div className={`flex-1 overflow-y-auto py-[clamp(28px,8vh,80px)] ${messages.length ? "content-start" : "grid place-items-center"}`} aria-live="polite">
          {!sessionTitle ? (
            <div className="w-full max-w-[610px] text-center">
              <span className="mx-auto mb-18 grid size-56 place-items-center rounded-18 border border-line bg-white text-brand shadow-card"><Lightbulb size={25} /></span>
              <h1 className="m-0 text-[clamp(26px,5vw,38px)] font-bold tracking-[-.04em] text-ink">What would you like to learn?</h1>
              <p className="mx-auto mt-10 max-w-480 text-14 leading-170 text-muted">Ask anything and learn through a natural conversation. You can also attach a PDF and ask questions about it.</p>
              <button className="mt-14 inline-flex items-center gap-7 text-11 font-semibold text-brand hover:underline" type="button" disabled={uploading} onClick={() => fileInput.current?.click()}><Paperclip size={14} /> {uploading ? "Reading your PDF..." : "Attach a PDF instead"}</button>
            </div>
          ) : (
            <div className="w-full space-y-20">
              {messages.map((message, index) => ({ message, index })).filter(({ message }) => !(busy && message.role === "assistant" && !message.content)).map(({ message, index }) => (
                <article key={`${index}-${message.role}`} className={`flex items-start gap-10 ${message.role === "user" ? "justify-end" : ""}`}>
                  {message.role === "assistant" && <span className="grid size-30 shrink-0 place-items-center rounded-10 bg-pale text-brand"><Sparkles size={14} /></span>}
                  <div className={`max-w-[min(680px,86%)] whitespace-pre-line break-words text-13 leading-160 ${message.role === "user" ? "rounded-14 bg-brand px-14 py-10 text-white" : "pt-5 text-ink"}`}>
                    {message.role === "assistant" ? displayTutorText(message.content) : message.content}
                  </div>
                </article>
              ))}
              {busy && <p className="learn-thinking m-0 flex items-center gap-9 pt-5 text-13 text-muted" role="status" aria-live="polite"><span className="learn-thinking-dots" aria-hidden="true"><i /><i /><i /></span><span>Thinking</span></p>}
              <div ref={bottom} />
            </div>
          )}
        </div>

        {sessionTitle && messages.length <= 1 && <div className="flex flex-wrap gap-7 pb-12"><span className="w-full text-10 text-muted">Try asking</span>{suggestions.map((item) => <button className="rounded-full border border-line bg-white px-10 py-8 text-10 font-semibold text-brand hover:border-brand" key={item} disabled={busy} onClick={() => void sendQuestion(undefined, item)}>{item}<ArrowUp className="ml-5 inline" size={12} /></button>)}</div>}
        {error && <p className="m-0 pb-9 text-12 text-danger">{error}</p>}

        <form className="sticky bottom-0 mb-8 grid grid-cols-[auto_1fr_auto] items-end gap-8 rounded-15 border border-line bg-white px-12 py-10 shadow-card focus-within:border-outline focus-within:shadow-focus" onSubmit={(event) => sessionTitle ? void sendQuestion(event) : void startTopicSession(event)}>
          <button className="grid size-34 place-items-center rounded-10 text-muted hover:bg-pale hover:text-brand" type="button" aria-label="Attach a PDF" disabled={uploading} onClick={() => fileInput.current?.click()}><Paperclip size={17} /></button>
          <textarea className="max-h-120 min-h-34 resize-none border-0 bg-transparent py-8 text-13 leading-150 text-ink outline-0 placeholder:text-muted" rows={1} value={sessionTitle ? question : topicInput} onChange={(event) => sessionTitle ? setQuestion(event.target.value) : setTopicInput(event.target.value)} onKeyDown={sessionTitle ? onComposerKeyDown : undefined} placeholder={sessionTitle ? (isTopicSession ? `Ask about ${activeTopic}...` : "Ask a question about your PDF...") : "Start with a topic..." } disabled={busy || uploading} aria-label={sessionTitle ? "Ask your AI tutor" : "Topic to learn"} aria-keyshortcuts={sessionTitle ? "Enter" : undefined} />
          <button className="grid size-34 place-items-center rounded-10 bg-brand text-white disabled:cursor-not-allowed disabled:opacity-40" type="submit" aria-label={sessionTitle ? "Send question" : "Start learning"} disabled={sessionTitle ? (!question.trim() || busy) : topicInput.trim().length < 2}><ArrowUp size={17} /></button>
        </form>
        <p className="mb-14 text-center text-10 text-muted">AI can make mistakes. Check important details against your original material.</p>
        <input ref={fileInput} className="hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => void chooseFile(event.target.files?.[0])} />
      </section>
    </main>
  );
}
