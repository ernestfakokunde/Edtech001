import { Fragment, useEffect, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp, Check, Copy, Download, FileText, Lightbulb, Paperclip, Play, RotateCcw, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { askLearnTutor, errorMessage, generateStudySetFromText, getLearnChat, listLearnChats, uploadFileProblem, uploadLearnDocument, type AiCreditQuota, type GeneratedSet, type LearnChatMessage, type SavedLearnChat } from "../lib/api";
import { downloadQuestionPaperPdf } from "../lib/questionPdf";

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

function renderTutorProse(content: string): ReactNode {
  const blocks: Array<{ type: "paragraph" | "unordered"; lines: string[] }> = [];
  let separated = false;
  for (const line of displayTutorText(content).split("\n").map((value) => value.replace(/^\s*(?:\u00e2\u20ac\u00a2|\u2022)\s+/, "- "))) {
    if (!line.trim()) { separated = true; continue; }
    const unordered = line.match(/^\s*[-*•]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const type = "unordered";
      const previous = blocks.at(-1);
      if (previous?.type === type && !separated) previous.lines.push((unordered ?? ordered)![1]);
      else blocks.push({ type, lines: [(unordered ?? ordered)![1]] });
      separated = false;
    } else {
      const previous = blocks.at(-1);
      if (previous?.type === "paragraph" && !separated) previous.lines.push(line.trim());
      else blocks.push({ type: "paragraph", lines: [line.trim()] });
      separated = false;
    }
  }

  const readableBlocks: typeof blocks = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const introLine = block.type === "paragraph"
      ? block.lines.findIndex((line) => line.trim().endsWith(":")
        && /\b(?:here are|key characteristics|characteristics|key points|main points|major tasks|steps|following|include|examples|types|features|factors|benefits|reasons|components|elements|methods|stages|criteria)\b/i.test(line))
      : -1;
    if (introLine < 0) { readableBlocks.push(block); continue; }

    if (introLine > 0) readableBlocks.push({ type: "paragraph", lines: block.lines.slice(0, introLine) });
    readableBlocks.push({ type: "paragraph", lines: [block.lines[introLine]] });
    const items: string[] = block.lines.slice(introLine + 1).map((line) => line.trim()).filter(Boolean);
    let next = index + 1;
    let stopped = false;
    while (next < blocks.length && blocks[next].type === "paragraph") {
      for (const line of blocks[next].lines) {
        const item = line.trim();
        if (!item) continue;
        if (item.length > 260 || /^(?:extra context|note|in summary|overall|conclusion)\b/i.test(item)) { stopped = true; break; }
        items.push(item);
      }
      if (stopped) break;
      next += 1;
    }
    if (items.length >= 2) {
      readableBlocks.push({ type: "unordered", lines: items });
      if (stopped) {
        const remainder = blocks[next].lines.slice(blocks[next].lines.findIndex((line) => line.trim().length > 260 || /^(?:extra context|note|in summary|overall|conclusion)\b/i.test(line.trim())));
        if (remainder.length) readableBlocks.push({ type: "paragraph", lines: remainder });
        index = next;
      } else index = next - 1;
    } else {
      if (items.length) readableBlocks.push({ type: "paragraph", lines: items });
    }
  }

  return <div className="learn-answer-content">{readableBlocks.map((block, index) => {
    if (block.type === "unordered") return <ul key={index}>{block.lines.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>;
    return <p key={index}>{block.lines.join(" ")}</p>;
  })}</div>;
}

function TutorCodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const markdown = `\`\`\`${language}\n${code}\n\`\`\``;
  return <div className="learn-code-block">
    <div className="learn-code-header">
      <span>{language || "Code"}</span>
      <button type="button" onClick={() => void copyCode()} aria-label={copied ? "Code copied" : "Copy code"} title={copied ? "Copied" : "Copy code"}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        <span>{copied ? "Copied" : "Copy code"}</span>
      </button>
    </div>
    <ReactMarkdown
      rehypePlugins={[rehypeHighlight]}
      components={{ pre: ({ children }) => <pre>{children}</pre> }}
    >{markdown}</ReactMarkdown>
  </div>;
}

function renderTutorText(content: string): ReactNode {
  const fencePattern = /```([^\n]*)\n([\s\S]*?)(?:```|$)/g;
  const output: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = fencePattern.exec(content))) {
    if (match.index > cursor) output.push(<Fragment key={key++}>{renderTutorProse(content.slice(cursor, match.index))}</Fragment>);
    const language = match[1].trim().split(/\s+/)[0] ?? "";
    output.push(<TutorCodeBlock key={key++} language={language} code={match[2].replace(/\n$/, "")} />);
    cursor = fencePattern.lastIndex;
  }
  if (cursor < content.length) output.push(<Fragment key={key++}>{renderTutorProse(content.slice(cursor))}</Fragment>);
  return output.length ? <div className="learn-answer-content">{output}</div> : renderTutorProse(content);
}

export function LearnWithAI({ onTakeQuiz }: { onTakeQuiz: (set: GeneratedSet) => void }) {
  const [topicInput, setTopicInput] = useState("");
  const [activeTopic, setActiveTopic] = useState("");
  const [fileTitle, setFileTitle] = useState("");
  const [attachment, setAttachment] = useState<{ title: string; documentText?: string; truncated?: boolean } | null>(null);
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
  const uploadRequestId = useRef(0);

  const sessionTitle = attachment?.title || fileTitle || activeTopic;
  const isTopicSession = Boolean(activeTopic && !attachment && !fileTitle);
  const suggestions = isTopicSession ? TOPIC_SUGGESTIONS : DOCUMENT_SUGGESTIONS;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    listLearnChats().then(({ chats }) => setSavedChats(chats)).catch(() => undefined);
  }, []);

  async function openSavedChat(id: string) {
    uploadRequestId.current += 1;
    setUploading(false);
    setAttachment(null);
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
    uploadRequestId.current += 1;
    setUploading(false);
    setChatId(undefined);
    setFileTitle(""); setActiveTopic(""); setTopicInput(""); setDocumentText("");
    setAttachment(null);
    setMessages([]); setQuestion(""); setError(""); setTruncated(false);
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    setError("");
    const issue = uploadFileProblem(file);
    if (issue) { setError(issue); return; }
    if (!/\.(pdf|docx)$/i.test(file.name)) { setError("Learn with AI supports PDF and DOCX files."); return; }
    const requestId = ++uploadRequestId.current;
    setAttachment({ title: file.name });
    setUploading(true);
    try {
      const result = await uploadLearnDocument(file);
      if (requestId !== uploadRequestId.current) return;
      setAttachment({ title: result.title, documentText: result.documentText, truncated: result.truncated });
    } catch (reason) {
      if (requestId === uploadRequestId.current) { setAttachment(null); setError(errorMessage(reason, "We could not read this document. Try another file.")); }
    } finally {
      if (requestId === uploadRequestId.current) setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
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
    if (!asked || (!attachment?.documentText && !documentText && !activeTopic) || uploading || busy) return;
    // Keep every turn within the backend's request validation limit. Tutor
    // replies can be longer than that after streaming a full explanation.
    const history = messages.slice(-20).map((message) => ({ ...message, content: message.content.slice(0, 2000) }));
    const makeQuiz = /\b(?:create|make|generate|build|prepare)\b.{0,45}\b(?:quiz|test|multiple.choice questions?)\b|\bquiz\b.{0,45}\b(?:create|make|generate|build|prepare)\b/i.test(asked);
    const quizSource = attachment?.documentText ?? documentText ?? (activeTopic ? `Topic: ${activeTopic}\n\nCreate a practice quiz that assesses its key concepts, definitions, processes, and applications. Student request: ${asked}` : "");
    setQuestion(""); setError(""); setBusy(true);
    setMessages((current) => [...current, { role: "user", content: asked, ...(attachment?.documentText ? { attachmentName: attachment.title } : {}) }]);
    let createdQuizSet: GeneratedSet | undefined;
    try {
      setMessages((current) => [...current, { role: "assistant", content: "" }]);
      const quizSet = makeQuiz ? await generateStudySetFromText({
        documentText: quizSource,
        title: attachment?.title ?? fileTitle ?? activeTopic ?? "Study material",
        type: "QUIZ",
        length: 10,
        timePerQuestion: 60,
      }) : undefined;
      createdQuizSet = quizSet;
      const result = await askLearnTutor({ documentText: attachment?.documentText ?? (documentText || undefined), documentName: attachment?.title ?? (fileTitle || undefined), appendDocument: Boolean(attachment?.documentText && chatId && documentText), attachmentName: attachment?.documentText ? attachment.title : undefined, topic: activeTopic || undefined, question: asked, history, chatId, quizSetId: quizSet?.id }, (chunk) => setMessages((current) => current.map((message, index) => index === current.length - 1 && message.role === "assistant" ? { ...message, content: message.content + chunk } : message)));
      if (quizSet) setMessages((current) => current.map((message, index) => index === current.length - 1 && message.role === "assistant" ? { ...message, quizSet } : message));
      setChatId(result.chatId);
      if (attachment?.documentText) {
        setDocumentText(documentText ? `${documentText}\n\n[Additional document: ${attachment.title}]\n${attachment.documentText}` : attachment.documentText);
        setFileTitle(fileTitle ? `${fileTitle}, ${attachment.title}`.slice(0, 255) : attachment.title);
        setTruncated((documentText ? truncated : false) || Boolean(attachment.truncated));
        setAttachment(null);
      }
      void listLearnChats().then(({ chats }) => setSavedChats(chats)).catch(() => undefined);
      setQuota(result.quota);
    } catch (reason) {
      if (createdQuizSet) {
        setMessages((current) => [...current.slice(0, -1), { role: "assistant", content: "Your quiz is ready. I could not finish the chat reply, but you can take it or download the PDF below.", quizSet: createdQuizSet }]);
        setError("");
      } else {
        setMessages((current) => current.slice(0, -1).filter((message, index, all) => !(index === all.length - 1 && message.role === "user")));
        setQuestion(asked);
        setError(errorMessage(reason, "Your tutor could not answer just now. Please try again."));
      }
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
      <aside className="sticky top-64 flex h-[calc(100dvh-64px)] w-[210px] shrink-0 self-start flex-col border-r border-line py-20 max-480:top-60 max-480:h-[calc(100dvh-60px)] max-760:hidden" aria-label="Past chats">
        <button className="mb-16 flex min-h-40 items-center justify-center gap-7 rounded-10 border border-line bg-white px-10 text-12 font-semibold text-ink hover:border-brand hover:text-brand" onClick={startNewChat}><RotateCcw size={14} /> New chat</button>
        <h2 className="mb-8 px-5 text-12 font-bold uppercase tracking-[.08em] text-muted">Recent chats</h2>
        <nav className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          {savedChats.map((chat) => <button key={chat.id} onClick={() => void openSavedChat(chat.id)} className={`rounded-9 border-2 border-line px-9 py-8 text-left transition-colors hover:border-brand hover:bg-white ${chat.id === chatId ? "bg-white text-brand shadow-sm" : "text-ink"}`}>
            <span className="block truncate text-13 font-semibold">{chat.title}</span>
            <span className="mt-3 block truncate text-12 text-muted">{chat.preview || "No messages yet"}</span>
          </button>)}
          {!savedChats.length && <p className="px-5 text-10 leading-150 text-muted">Your chats will appear here.</p>}
        </nav>
      </aside>
      <section className="flex w-full max-w-[820px] flex-1 flex-col px-[clamp(10px,2vw,18px)]">
        <details className="sticky top-64 z-10 mb-8 rounded-10 border border-line bg-white px-11 py-8 max-480:top-60 md:hidden">
          <summary className="cursor-pointer text-11 font-semibold text-ink">Past chats ({savedChats.length})</summary>
          <div className="mt-8 flex max-h-180 flex-col gap-4 overflow-y-auto">
            <button className="rounded-8 px-8 py-7 text-left text-11 font-semibold text-brand hover:bg-pale" onClick={startNewChat}>＋ New chat</button>
            {savedChats.map((chat) => <button key={chat.id} onClick={() => void openSavedChat(chat.id)} className="rounded-8 border-2 border-line px-8 py-7 text-left hover:border-brand hover:bg-pale">
              <span className="block truncate text-11 font-semibold text-ink">{chat.title}</span>
              <span className="block truncate text-10 text-muted">{chat.preview}</span>
            </button>)}
          </div>
        </details>
        {sessionTitle && <div className="learn-session-context">
        <div className="flex min-w-0 items-center gap-9">
            <span className="grid size-30 shrink-0 place-items-center rounded-9 bg-pale text-brand">{isTopicSession ? <Lightbulb size={15} /> : <FileText size={15} />}</span>
            <div className="min-w-0"><strong className="block truncate text-13 text-ink">{sessionTitle}</strong><small className="block truncate text-11 text-muted">{truncated ? "Using the first section of your document" : "Private study session"}</small></div>
          </div>
          <div className="flex shrink-0 items-center gap-8">{quota && <span className="rounded-full bg-pale px-10 py-7 text-12 font-semibold text-brand">{quota.remaining} credits</span>}<button className="inline-flex min-h-40 shrink-0 items-center gap-6 rounded-9 border border-line bg-white px-10 py-8 text-12 font-semibold text-muted hover:border-brand hover:text-brand" onClick={resetSession}><RotateCcw size={14} /> New chat</button></div>
        </div>}
        <div className={`flex-1 overflow-y-auto py-[clamp(28px,8vh,80px)] ${messages.length ? "content-start" : "grid place-items-center"}`} aria-live="polite">
          {!sessionTitle ? (
            <div className="w-full max-w-[610px] text-center">
              <span className="mx-auto mb-18 grid size-56 place-items-center rounded-18 border border-line bg-white text-brand shadow-card"><Lightbulb size={25} /></span>
              <h1 className="m-0 text-[clamp(26px,5vw,38px)] font-bold tracking-[-.04em] text-ink">What would you like to learn?</h1>
              <p className="mx-auto mt-10 max-w-480 text-16 leading-170 text-muted">Ask anything and learn through a natural conversation. You can also attach a PDF or DOCX and ask questions about it.</p>
              <button className="mt-14 inline-flex min-h-40 items-center gap-7 text-13 font-semibold text-brand hover:underline" type="button" disabled={uploading} onClick={() => fileInput.current?.click()}><Paperclip size={16} /> {uploading ? "Reading your document..." : "Attach a PDF or DOCX"}</button>
            </div>
          ) : (
            <div className="w-full space-y-20">
              {messages.map((message, index) => ({ message, index })).filter(({ message }) => !(busy && message.role === "assistant" && !message.content)).map(({ message, index }) => (
                <article key={`${index}-${message.role}`} className={`flex items-start gap-10 ${message.role === "user" ? "justify-end" : ""}`}>
                  {message.role === "assistant" && <span className="grid size-30 shrink-0 place-items-center rounded-10 bg-pale text-brand"><Sparkles size={14} /></span>}
                  <div className={`flex max-w-[min(680px,94%)] max-760:max-w-[96%] flex-col gap-7 ${message.role === "user" ? "items-end" : "items-start"}`}>
                    {message.role === "user" && message.attachmentName && <div className="flex w-[min(220px,78vw)] items-start gap-9 rounded-12 border border-line bg-white px-12 py-10 text-left text-12 text-ink shadow-sm"><FileText size={16} className="mt-1 shrink-0 text-brand" /><span className="min-w-0 flex-1"><strong className="block break-words font-semibold">{message.attachmentName}</strong><small className="mt-2 block text-11 text-muted">{message.attachmentName.split(".").pop()?.toUpperCase() ?? "FILE"}</small></span></div>}
                    <div className={`learn-chat-message whitespace-pre-line break-words ${message.role === "user" ? "rounded-14 bg-brand px-14 py-10 text-white" : "pt-5 text-ink"}`}>
                      {message.role === "assistant" ? renderTutorText(message.content) : message.content}
                    </div>
                    {message.role === "assistant" && message.quizSet && <div className="learn-quiz-card">
                      <span className="grid size-38 shrink-0 place-items-center rounded-10 bg-pale text-brand"><FileText size={18} /></span>
                      <div className="min-w-0 flex-1"><strong className="block truncate text-13 text-ink">{message.quizSet.title}</strong><span className="mt-3 block text-11 text-muted">{message.quizSet.items.length}-question quiz · Interactive quiz and PDF</span></div>
                      <button type="button" onClick={() => onTakeQuiz(message.quizSet!)}><Play size={15} /> Take quiz</button>
                      <button type="button" onClick={() => downloadQuestionPaperPdf(message.quizSet!.title, message.quizSet!)}><Download size={15} /> Download PDF</button>
                    </div>}
                  </div>
                </article>
              ))}
              {busy && <p className="learn-thinking m-0 flex items-center gap-9 pt-5 text-16 text-muted" role="status" aria-live="polite"><span className="learn-thinking-dots" aria-hidden="true"><i /><i /><i /></span><span>Thinking</span></p>}
              <div ref={bottom} />
            </div>
          )}
        </div>

        {sessionTitle && messages.length <= 1 && <div className="flex flex-wrap gap-8 pb-12"><span className="w-full text-12 text-muted">Try asking</span>{suggestions.map((item) => <button className="min-h-40 rounded-full border border-line bg-white px-12 py-8 text-12 font-semibold text-brand hover:border-brand" key={item} disabled={busy} onClick={() => void sendQuestion(undefined, item)}>{item}<ArrowUp className="ml-5 inline" size={13} /></button>)}</div>}
        {error && <p className="m-0 pb-9 text-14 text-danger">{error}</p>}

        <form className="learn-chat-composer sticky bottom-0 mb-8 grid grid-cols-[auto_1fr_auto] items-end gap-8 rounded-15 border border-line bg-white px-12 py-10 shadow-card focus-within:border-outline focus-within:shadow-focus" onSubmit={(event) => sessionTitle ? void sendQuestion(event) : void startTopicSession(event)}>
          {attachment && <div className="col-span-3 flex min-w-0 items-center gap-9 rounded-9 bg-pale px-12 py-10 text-13 text-ink" role="status"><FileText size={17} className="shrink-0 text-brand" /><span className="min-w-0 flex-1 truncate">{attachment.title}</span><span className="shrink-0 text-12 text-muted">{uploading ? "Uploading…" : attachment.documentText ? "Ready" : "Preparing…"}</span><button type="button" className="grid size-32 shrink-0 place-items-center rounded-6 text-muted hover:bg-white hover:text-ink disabled:opacity-40" aria-label="Remove attached document" disabled={uploading} onClick={() => { uploadRequestId.current += 1; setAttachment(null); }}><span aria-hidden="true">×</span></button></div>}
          <button className="grid size-40 max-760:size-44 place-items-center rounded-10 text-muted hover:bg-pale hover:text-brand" type="button" aria-label="Attach a document" disabled={uploading || Boolean(attachment)} onClick={() => fileInput.current?.click()}><Paperclip size={19} /></button>
          <textarea className="learn-chat-input max-h-140 min-h-40 resize-none border-0 bg-transparent py-8 text-16 leading-150 text-ink outline-0 placeholder:text-muted" rows={1} value={sessionTitle ? question : topicInput} onChange={(event) => sessionTitle ? setQuestion(event.target.value) : setTopicInput(event.target.value)} onKeyDown={sessionTitle ? onComposerKeyDown : undefined} placeholder={sessionTitle ? (isTopicSession ? `Ask about ${activeTopic}...` : "Ask a question about your document...") : "Start with a topic..." } disabled={busy} aria-label={sessionTitle ? "Ask your AI tutor" : "Topic to learn"} aria-keyshortcuts={sessionTitle ? "Enter" : undefined} />
          <button className="grid size-40 max-760:size-44 place-items-center rounded-10 bg-brand text-white disabled:cursor-not-allowed disabled:opacity-40" type="submit" aria-label={sessionTitle ? "Send question" : "Start learning"} disabled={sessionTitle ? (!question.trim() || busy || uploading || (!attachment?.documentText && !documentText && !activeTopic)) : topicInput.trim().length < 2}><ArrowUp size={19} /></button>
        </form>
        <p className="mb-14 text-center text-12 text-muted">AI can make mistakes. Check important details against your original material.</p>
        <input ref={fileInput} className="hidden" type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" onChange={(event) => void chooseFile(event.target.files?.[0])} />
      </section>
    </main>
  );
}
