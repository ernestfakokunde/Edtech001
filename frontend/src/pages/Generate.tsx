import { useEffect, useState } from "react";
import {
  Check,
  Clock3,
  Download,
  FlipHorizontal2,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { PageFrame, go } from "../components/Layout";
import {
  addMyCourse,
  errorMessage,
  generateStudySet,
  getGenerationQuota,
  getMyCourses,
  MAX_UPLOAD_LABEL,
  uploadFileProblem,
  type GeneratedSet,
  type GenerationQuota,
  type MySchool,
} from "../lib/api";
import { downloadQuestionPaperPdf } from "../lib/questionPdf";
import type { Mode } from "../types";

const LENGTH_OPTIONS = [5, 10, 15, 20];
const MAX_CUSTOM_LENGTH = 60;
const TIME_OPTIONS = [30, 60] as const;

type CourseOption = { id: string; code: string; title: string };

/**
 * The "Generate for me" screen. Course context arrives through routing
 * Course grouping is optional; uploads can start immediately without a course.
 * Uploads the file as multipart/form-data and follows the backend contract for
 * POST /api/generation exactly (including timePerQuestion, shown only when
 * Quiz is selected).
 */
export function GenerateFlow({
  courseId,
  onComplete,
}: {
  courseId?: string;
  onComplete: (set: GeneratedSet) => void;
}) {
  const [course, setCourse] = useState<CourseOption | null>(null);
  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([]);
  const [courseLoading, setCourseLoading] = useState(true);
  // Inline "add a course": just a code and a title. The backend files it under
  // the student's saved school (set once on the Profile page), so no
  // University → Faculty → Department walk happens here.
  const [school, setSchool] = useState<MySchool>(null);
  const [addingCourse, setAddingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({ code: "", title: "" });
  const [addingCourseBusy, setAddingCourseBusy] = useState(false);
  const [addCourseError, setAddCourseError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("flashcards");
  const [length, setLength] = useState(LENGTH_OPTIONS[0]);
  const [customLength, setCustomLength] = useState(25);
  const [timePerQuestion, setTimePerQuestion] = useState<30 | 60>(30);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState("");
  const [quota, setQuota] = useState<GenerationQuota>({ tier: "FREE", limit: 20, used: 0, remaining: 20, resetsAt: "" });

  useEffect(() => {
    let alive = true;
    // Upload is available immediately; load saved courses in the background
    // only to populate the optional grouping control. The quota request is
    // independent, so a slow quota response must not keep the course control
    // stuck on "Loading saved courses".
    getMyCourses()
      .catch(() => null)
      .then((saved) => {
        if (!alive) return;
        if (saved) {
          setSchool(saved.school);
          setCourseOptions(saved.courses);
          const match = courseId ? saved.courses.find((item) => item.id === courseId) ?? null : null;
          setCourse(match);
        }
        setCourseLoading(false);
      });
    getGenerationQuota()
      .catch(() => null)
      .then((quotaValue) => {
        if (alive && quotaValue) setQuota(quotaValue);
      });
    return () => {
      alive = false;
    };
  }, [courseId]);

  // The inline add form: opens instantly, fetches nothing, and posts one
  // code + title pair. Errors (school missing, cap reached) surface inline.
  function openAddForm() {
    setAddingCourse(true);
    setAddCourseError("");
  }
  function closeAddForm() {
    setAddingCourse(false);
    setAddCourseError("");
    setNewCourse({ code: "", title: "" });
  }
  async function addCourseHandler() {
    if (!newCourse.code.trim() || !newCourse.title.trim()) {
      setAddCourseError("Enter the course code and title.");
      return;
    }
    setAddingCourseBusy(true);
    setAddCourseError("");
    try {
      const result = await addMyCourse({ code: newCourse.code.trim(), title: newCourse.title.trim() });
      const created: CourseOption = result.course;
      setCourse(created);
      closeAddForm();
      setCourseOptions((current) => (current.some((item) => item.id === created.id) ? current : [...current, created].sort((a, b) => a.code.localeCompare(b.code))));
    } catch (reason) {
      setAddCourseError(errorMessage(reason, "Could not save the course."));
    } finally {
      setAddingCourseBusy(false);
    }
  }

  async function submit() {
    if (!selectedFile) return;
    setBusy(true);
    setError("");
    try {
      const set = await generateStudySet({
        file: selectedFile,
        ...(course ? { courseId: course.id } : {}),
        type: mode === "quiz" ? "QUIZ" : "FLASHCARD",
        length,
        ...(mode === "quiz" ? { timePerQuestion } : {}),
      });
      onComplete(set);
      setQuota((current) => ({ ...current, used: current.used + 1, remaining: Math.max(0, current.remaining - 1) }));
    } catch (reason) {
      setError(errorMessage(reason, "Could not generate the study set."));
      setBusy(false);
    }

  }

  async function downloadQuestionPaper() {
    if (!selectedFile || fileProblem || pdfBusy || quota.remaining === 0) return;
    setPdfBusy(true);
    setError("");
    try {
      const set = await generateStudySet({
        file: selectedFile,
        ...(course ? { courseId: course.id } : {}),
        type: "QUIZ",
        length,
        timePerQuestion: 60,
      });
      downloadQuestionPaperPdf(selectedFile.name, set);
      setQuota((current) => ({ ...current, used: current.used + 1, remaining: Math.max(0, current.remaining - 1) }));
    } catch (reason) {
      setError(errorMessage(reason, "Could not create the question paper."));
    } finally {
      setPdfBusy(false);
    }
  }

  if (busy) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-[1180px] items-center justify-center px-[clamp(20px,4vw,40px)] py-40 max-680:px-18">
        <div className="panel grid w-full max-w-[460px] justify-items-center gap-10 px-28 py-34 text-center text-muted">
          <span className="mb-4 grid size-54 place-items-center rounded-14 bg-pale text-brand"><Loader2 size={28} className="animate-spin" /></span>
          <strong className="font-grotesk text-18 font-bold text-ink">Generating your {mode === "quiz" ? "quiz" : "flashcard"} set</strong>
          <span className="max-w-[320px] text-12 leading-160">{mode === "quiz"
            ? "Quiz generation usually takes less than a minute. We’re reading your material, writing exam-style questions, and checking the answer choices. Larger files may take a little longer, so please keep this page open."
            : `We’re reading your material and creating ${length} concise study cards. Smaller sets finish faster.`}</span>
          <div className="mt-12 flex flex-wrap justify-center gap-8">
            {/* Static progress language: the API call is one request, so these
                are stage labels rather than a fake animated percentage. */}
            <span className="rounded-full bg-brand px-10 py-5 text-10 font-bold text-[var(--theme-on-brand)]">Reading material</span>
            <span className="rounded-full bg-pale px-10 py-5 text-10 font-bold text-muted">{mode === "quiz" ? "Writing questions" : "Writing cards"}</span>
            <span className="rounded-full bg-pale px-10 py-5 text-10 font-bold text-muted">Finishing up</span>
          </div>
        </div>
      </main>
    );
  }

  // Surfaced the moment the file is picked so an oversize or unsupported file
  // never reaches the upload — the point where a phone turns a real 413 into a
  // bare "Failed to fetch" (see uploadFileProblem in lib/api.ts).
  const fileProblem = selectedFile ? uploadFileProblem(selectedFile) : null;

  return (
    <PageFrame
      eyebrow={course ? `${course.code} · ${course.title}` : "AI study tools"}
      title="What do you want to create?"
      subtitle="Upload a PDF or Word document and AI will turn it into a private practice set."
      back="dashboard"
    >
      <div className="mb-18">
        <label className="field-label" htmlFor="generation-course">Course (optional)</label>
        <select id="generation-course" className="field-select mt-6 max-w-[460px]" value={course?.id ?? ""} onChange={(event) => setCourse(courseOptions.find((item) => item.id === event.target.value) ?? null)}>
          <option value="">No course · quick practice</option>
          {courseOptions.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.title}</option>)}
        </select>
        {courseLoading && <small className="mt-6 block text-11 text-muted">Loading saved courses… you can upload now.</small>}
        {!courseLoading && <small className="mt-6 block text-11 text-muted">Want to group this set? <button type="button" className="inline-flex min-h-24 items-center font-bold text-brand hover:underline" onClick={openAddForm}>Add a course</button></small>}
      </div>
      {addingCourse && (
        <div className="mb-18 rounded-14 border border-line bg-pale/50 p-15">
          {!school && <p className="notice notice-warning mb-12">Add your university and faculty on your profile to save a course. You can still continue without one.</p>}
          <div className="mb-12 grid grid-cols-[.9fr_1.6fr] gap-8 max-760:grid-cols-1">
            <input className="field-input" value={newCourse.code} onChange={(event) => setNewCourse({ ...newCourse, code: event.target.value.toUpperCase() })} placeholder="Course code e.g. CSC 201" disabled={!school} aria-label="New course code" />
            <input className="field-input" value={newCourse.title} onChange={(event) => setNewCourse({ ...newCourse, title: event.target.value })} placeholder="Course title e.g. Data Structures" disabled={!school} aria-label="New course title" />
          </div>
          {addCourseError && <small className="block text-11 font-semibold text-danger">{addCourseError}</small>}
          <div className="mt-12 flex justify-end gap-9 max-680:flex-col">
            <button className="btn btn-secondary btn-sm" onClick={closeAddForm}><X size={14} /> Cancel</button>
            {school
              ? <button className="btn btn-primary btn-sm" disabled={addingCourseBusy} onClick={() => void addCourseHandler()}>{addingCourseBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save course</button>
              : <button className="btn btn-primary btn-sm" onClick={() => go("profile")}>Go to profile</button>}
          </div>
        </div>
      )}

      <label className={`upload-zone relative mb-20 flex min-h-[168px] cursor-pointer flex-col items-center justify-center gap-9 px-18 py-24 text-center transition ${fileProblem ? "has-error" : ""}`}>
        <span className="grid size-44 shrink-0 place-items-center rounded-full bg-pale text-brand">
          <Upload size={19} />
        </span>
        <span className="block w-full max-w-[520px] text-13 font-bold text-ink [overflow-wrap:anywhere]">{selectedFile ? selectedFile.name : "Choose a PDF or DOCX file"}</span>
        <small className="block w-full max-w-[420px] text-11 font-medium leading-150 text-muted">{fileProblem ?? (selectedFile ? "Ready to process" : `The file is used only to generate your private practice set — PDF or DOCX up to ${MAX_UPLOAD_LABEL}.`)}</small>
        <input
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          aria-label="Choose a PDF or DOCX file"
          onChange={(event) => { const file = event.target.files?.[0] || null; setSelectedFile(file); setError(""); }}
        />
      </label>

      <div className="my-20 grid grid-cols-2 gap-12 max-680:grid-cols-1">
        {([
          ["flashcards", "Flashcards", "Flip through key questions and answers at your pace", FlipHorizontal2],
          ["quiz", "Quiz", "Timed multiple-choice practice with a score at the end", Check],
        ] as const).map(([value, title, description, Icon]) => (
          <button
            type="button"
            aria-pressed={mode === value}
            className={`choice-card grid cursor-pointer gap-8 rounded-14 border p-17 text-left text-ink transition hover:-translate-y-2 hover:shadow-[0_12px_24px_#6d4cc214] [&>strong]:font-grotesk [&>strong]:text-15 [&>strong]:font-bold [&>small]:text-11 [&>small]:leading-150 [&>small]:text-muted [&_.choice-icon]:grid [&_.choice-icon]:size-38 [&_.choice-icon]:place-items-center [&_.choice-icon]:rounded-10 [&_.choice-icon]:bg-pale [&_.choice-icon]:text-brand`}
            key={value}
            onClick={() => setMode(value)}
          >
            <span className={`grid size-38 place-items-center rounded-10 ${mode === value ? "bg-brand text-[var(--theme-on-brand)]" : "bg-pale text-brand"}`}><Icon size={19} /></span>
            <strong>{title}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>

      {mode === "quiz" && <p className="quiz-note -mt-5 mb-18 rounded-r-9 border-l-[3px] px-13 py-11 text-11 leading-[1.55]">Each question has four answer choices. Your answer key and explanations are saved with the quiz, so you can review them after you finish.</p>}

      <div className="mb-18 [&>label]:mb-7 [&>label]:block [&>label]:text-12 [&>label]:font-bold [&>small]:mt-6 [&>small]:block [&>small]:text-11 [&>small]:text-muted">
        <label>Set length</label>
        <div className="flex flex-wrap gap-8">
          {LENGTH_OPTIONS.map((option) => (
            <button key={option} type="button" aria-pressed={length === option} className="option-pill" onClick={() => setLength(option)}>
              {option}
            </button>
          ))}
          <button type="button" aria-pressed={!LENGTH_OPTIONS.includes(length)} className="option-pill inline-flex items-center gap-6" onClick={() => setLength(customLength)}>
            Custom <Plus size={13} />
          </button>
        </div>
        {!LENGTH_OPTIONS.includes(length) && (
          <div className="mt-10 flex items-center gap-8 text-11 text-muted">
            <label htmlFor="custom-set-length" className="m-0">Questions</label>
            <input
              id="custom-set-length"
              type="number"
              min="1"
              max={MAX_CUSTOM_LENGTH}
              value={customLength}
              onChange={(event) => {
                const next = Math.min(MAX_CUSTOM_LENGTH, Math.max(1, Number(event.target.value) || 1));
                setCustomLength(next);
                setLength(next);
              }}
              className="h-36 w-64 rounded-8 border border-line bg-white px-8 text-center text-11 text-ink"
            />
            <span>Up to {MAX_CUSTOM_LENGTH}</span>
          </div>
        )}
      </div>

      {mode === "quiz" && (
        <div className="mb-18 [&>label]:mb-7 [&>label]:block [&>label]:text-12 [&>label]:font-bold [&>small]:mt-6 [&>small]:block [&>small]:text-11 [&>small]:text-muted">
          <label>Time per question</label>
          <div className="flex flex-wrap gap-8">
            {TIME_OPTIONS.map((option) => (
              <button key={option} type="button" aria-pressed={timePerQuestion === option} className="option-pill" onClick={() => setTimePerQuestion(option)}>
                {option}s <Clock3 size={12} />
              </button>
            ))}
          </div>
        </div>
      )}

      {quota.limit > 0 && (
        <div className={`notice ${quota.remaining === 0 ? "notice-warning" : "notice-info"} mb-14 items-center gap-8`}>
          <Clock3 size={14} className="mt-1 shrink-0" />
          <span className="min-w-0 flex-1">{quota.remaining} of {quota.limit} monthly AI credits remaining{quota.resetsAt ? ` · resets ${new Date(quota.resetsAt).toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}.</span>
          <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => go("profile")}>Go Pro</button>
        </div>
      )}

      {error && <p className="notice notice-error mb-14">{error}</p>}

      <div className="grid gap-9">
        <button
          className="btn btn-primary w-full"
          disabled={!selectedFile || fileProblem !== null || quota.remaining === 0 || pdfBusy}
          onClick={() => void submit()}
        >
          <Sparkles size={16} /> Create {mode === "quiz" ? "quiz" : "flashcards"}
        </button>
        <button
          type="button"
          className="btn btn-secondary w-fit justify-self-center"
          disabled={!selectedFile || fileProblem !== null || quota.remaining === 0 || busy}
          onClick={() => void downloadQuestionPaper()}
        >
          <Download size={16} /> {pdfBusy ? "Preparing question paper…" : `Download question paper (${length} questions)`}
        </button>
      </div>
    </PageFrame>
  );
}
