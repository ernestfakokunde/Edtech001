import { useEffect, useState } from "react";
import {
  Check,
  Clock3,
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
import type { Mode } from "../types";

const LENGTH_OPTIONS = [10, 20, 30, 60];
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
  const [timePerQuestion, setTimePerQuestion] = useState<30 | 60>(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Daily quiz quota for FREE accounts (PREMIUM = unlimited).
  const [quota, setQuota] = useState<GenerationQuota>({ tier: "FREE", limit: null, used: 0, remaining: null, resetsAt: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      // Upload is available immediately; load saved courses in the background
      // only to populate the optional grouping control.
      const [saved, quotaValue] = await Promise.all([
        getMyCourses().catch(() => null),
        getGenerationQuota().catch(() => null),
      ]);
      if (!alive) return;
      if (quotaValue) setQuota(quotaValue);
      if (saved) {
        setSchool(saved.school);
        setCourseOptions(saved.courses);
        const match = courseId ? saved.courses.find((item) => item.id === courseId) ?? null : null;
        setCourse(match);
      }
      setCourseLoading(false);
    })();
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
      if (mode === "quiz") setQuota((current) => ({ ...current, used: current.used + 1, remaining: current.remaining === null ? null : Math.max(0, current.remaining - 1) }));
    } catch (reason) {
      setError(errorMessage(reason, "Could not generate the study set."));
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <main className="mx-auto w-full max-w-[1020px] px-[clamp(20px,4vw,40px)] pt-44 pb-64 max-860:px-[clamp(16px,4vw,24px)] max-860:pt-32 max-860:pb-56 max-680:min-w-0 max-680:px-18 [&_h1]:[overflow-wrap:anywhere] [&_h2]:[overflow-wrap:anywhere] flex min-h-[60vh] items-center justify-center">
        <div className="grid w-full max-w-[440px] justify-items-center gap-10 rounded-18 border border-line bg-white px-28 py-34 text-center text-muted shadow-[0_22px_40px_#0f172a12]">
          <span className="mb-4 grid size-54 place-items-center rounded-14 bg-pale text-brand"><Loader2 size={28} className="animate-spin" /></span>
          <strong className="font-grotesk text-18 font-bold text-ink">Generating your {mode === "quiz" ? "quiz" : "flashcard"} set</strong>
          <span className="max-w-[300px] text-12 leading-160">{mode === "quiz"
            ? "Quiz generation usually takes less than a minute. We’re reading your material, writing exam-style questions, and checking the answer choices. Larger files may take a little longer, so please keep this page open."
            : `We’re reading your material and creating ${length} study cards. This usually takes under a minute.`}</span>
          <div className="mt-12 flex flex-wrap justify-center gap-8 [&>span]:rounded-full [&>span]:bg-[#f1f5fb] [&>span]:px-10 [&>span]:py-4 [&>span]:text-10 [&>span]:font-bold [&>span]:text-muted [&>.active]:bg-brand [&>.active]:text-white"><span className="active">Upload material</span><span>Review key topics</span><span className="max-w-[300px] text-12 leading-160">{mode === "quiz" ? "Build quiz and answers" : "Create study cards"}</span></div>
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
      <div className="mb-18 [&>label]:mb-7 [&>label]:block [&>label]:text-12 [&>label]:font-bold [&>small]:mt-6 [&>small]:block [&>small]:text-11 [&>small]:text-muted">
        <label htmlFor="generation-course">Course (optional)</label>
        <select id="generation-course" value={course?.id ?? ""} onChange={(event) => setCourse(courseOptions.find((item) => item.id === event.target.value) ?? null)}>
          <option value="">No course · quick practice</option>
          {courseOptions.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.title}</option>)}
        </select>
        {courseLoading && <small>Loading saved courses… you can upload now.</small>}
        {!courseLoading && <small>Want to group this set? <button className="text-button" onClick={openAddForm}>Add a course</button></small>}
      </div>
      {addingCourse && (
        <div className="border-t border-line py-15">
          {!school && <p className="mb-10 text-11 font-bold text-[#b45309]">Add your university and faculty on your profile to save a course. You can still continue without one.</p>}
          <div className="mb-12 grid grid-cols-[.9fr_1.6fr] gap-8 max-760:grid-cols-1 [&>input]:min-h-44 [&>input]:w-full [&>input]:rounded-10 [&>input]:border [&>input]:border-line [&>input]:bg-white [&>input]:px-12 [&>input]:text-12 [&>input]:text-ink [&>input]:outline-none [&>input:focus]:border-outline [&>input:focus]:shadow-[0_0_0_3px_#dbeafe] [&>input:disabled]:bg-[#f8fafc] [&>input:disabled]:text-slate-icon">
            <input value={newCourse.code} onChange={(event) => setNewCourse({ ...newCourse, code: event.target.value.toUpperCase() })} placeholder="Course code e.g. CSC 201" disabled={!school} />
            <input value={newCourse.title} onChange={(event) => setNewCourse({ ...newCourse, title: event.target.value })} placeholder="Course title e.g. Data Structures" disabled={!school} />
          </div>
          {addCourseError && <small className="upload-form-error">{addCourseError}</small>}
          <div className="mt-12 flex justify-end gap-9">
            <button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-[#d6e3f5] bg-white px-14 text-12 font-bold leading-[1.25] text-[#4f46e5] transition-colors duration-200 hover:border-[#b7b7b3] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={closeAddForm}><X size={14} /> Cancel</button>
            {school ? <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" disabled={addingCourseBusy} onClick={() => void addCourseHandler()}>{addingCourseBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save course</button> : <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={() => go("profile")}>Go to profile</button>}
          </div>
        </div>
      )}

      <label className="upload-zone relative mb-20 flex min-h-[124px] cursor-pointer flex-col items-center gap-6 px-18 py-22 text-center transition hover:border-brand hover:bg-pale [&>span]:block [&>span]:w-full [&>span]:text-13 [&>span]:text-ink [&>small]:block [&>small]:w-full [&>small]:max-w-[420px] [&>small]:font-medium [&>small]:leading-150 [&>input]:pointer-events-none [&>input]:absolute [&>input]:opacity-0">
        <Upload size={17} />
        <span>{selectedFile ? selectedFile.name : "Choose a PDF or DOCX file"}</span>
        <small>{fileProblem ?? (selectedFile ? "Ready to process" : `The file is used only to generate your private practice set — PDF or DOCX up to ${MAX_UPLOAD_LABEL}.`)}</small>
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => { const file = event.target.files?.[0] || null; setSelectedFile(file); setError(file ? uploadFileProblem(file) ?? "" : ""); }}
        />
      </label>

      <div className="my-20 grid grid-cols-2 gap-12 max-680:grid-cols-1">
        {([
          ["flashcards", "Flashcards", "Flip through key questions and answers at your pace", FlipHorizontal2],
          ["quiz", "Quiz", "Timed multiple-choice practice with a score at the end", Check],
        ] as const).map(([value, title, description, Icon]) => (
          <button
            className={`grid cursor-pointer gap-8 rounded-14 border bg-white p-17 text-left text-ink transition hover:-translate-y-2 hover:border-outline hover:shadow-[0_12px_24px_#1d4ed812] ${mode === value ? "border-brand bg-pale shadow-[0_0_0_3px_#dbeafe]" : "border-line"} [&>strong]:font-grotesk [&>strong]:text-15 [&>strong]:font-bold [&>small]:text-11 [&>small]:leading-150 [&>small]:text-muted [&_.choice-icon]:grid [&_.choice-icon]:size-38 [&_.choice-icon]:place-items-center [&_.choice-icon]:rounded-10 [&_.choice-icon]:bg-pale [&_.choice-icon]:text-brand`}
            key={value}
            onClick={() => setMode(value)}
          >
            <span className={`grid size-38 place-items-center rounded-10 ${mode === value ? "bg-brand text-white" : "bg-pale text-brand"}`}><Icon size={19} /></span>
            <strong>{title}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>

      {mode === "quiz" && <p className="-mt-5 mb-18 rounded-r-9 border-l-[3px] border-brand bg-slate-50 px-13 py-11 text-11 leading-[1.55] text-slate-600">Each question has four answer choices. Your answer key and explanations are saved with the quiz, so you can review them after you finish.</p>}

      <div className="mb-18 [&>label]:mb-7 [&>label]:block [&>label]:text-12 [&>label]:font-bold [&>small]:mt-6 [&>small]:block [&>small]:text-11 [&>small]:text-muted">
        <label>Set length</label>
        <div className="flex flex-wrap gap-8 [&>button]:inline-flex [&>button]:min-h-42 [&>button]:items-center [&>button]:justify-center [&>button]:gap-5 [&>button]:rounded-10 [&>button]:border [&>button]:border-line [&>button]:bg-white [&>button]:px-18 [&>button]:text-13 [&>button]:font-grotesk [&>button]:font-semibold [&>button]:text-muted ">
          {LENGTH_OPTIONS.map((option) => (
            <button key={option} className={length === option ? "border-brand bg-brand text-white shadow-[0_8px_18px_#1d4ed826]" : "border-line text-muted"} onClick={() => setLength(option)}>
              {option}
            </button>
          ))}
        </div>
      </div>

      {mode === "quiz" && (
        <div className="mb-18 [&>label]:mb-7 [&>label]:block [&>label]:text-12 [&>label]:font-bold [&>small]:mt-6 [&>small]:block [&>small]:text-11 [&>small]:text-muted">
          <label>Time per question</label>
          <div className="flex flex-wrap gap-8 [&>button]:inline-flex [&>button]:min-h-42 [&>button]:items-center [&>button]:justify-center [&>button]:gap-5 [&>button]:rounded-10 [&>button]:border [&>button]:border-line [&>button]:bg-white [&>button]:px-18 [&>button]:text-13 [&>button]:font-grotesk [&>button]:font-semibold [&>button]:text-muted ">
            {TIME_OPTIONS.map((option) => (
              <button key={option} className={timePerQuestion === option ? "border-brand bg-brand text-white shadow-[0_8px_18px_#1d4ed826]" : "border-line text-muted"} onClick={() => setTimePerQuestion(option)}>
                {option}s <Clock3 size={12} />
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "quiz" && quota.limit !== null && (
        <div className={`mb-14 flex flex-wrap items-center gap-8 rounded-11 border border-[#dbeafe] bg-[#f8fbff] px-13 py-11 text-11 text-brand [&>span]:min-w-0 [&>span]:flex-[1_1_240px] [&>span]:leading-[1.5] [&>button]:ml-auto [&>button]:flex-none [&>button]:cursor-pointer [&>button]:rounded-8 [&>button]:border-0 [&>button]:bg-[#2858dc] [&>button]:px-12 [&>button]:py-7 [&>button]:text-11 [&>button]:font-bold [&>button]:text-white ${quota.remaining === 0 ? "border-amber-200 bg-amber-50 text-warning" : ""}`}>
          <Clock3 size={14} />
          <span>Free plan: {quota.remaining ?? 0} of {quota.limit} quiz generations left today{quota.resetsAt ? ` · resets ${new Date(quota.resetsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}. Pro includes unlimited quizzes.</span>
          <button type="button" onClick={() => go("profile")}>Go Pro</button>
        </div>
      )}

      {error && <small className="upload-form-error">{error}</small>}

      <button
        className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none w-full"
        disabled={!selectedFile || fileProblem !== null || (mode === "quiz" && quota.limit !== null && (quota.remaining ?? 0) === 0)}
        onClick={() => void submit()}
      >
        <Sparkles size={16} /> Create {mode === "quiz" ? "quiz" : "flashcards"}
      </button>
    </PageFrame>
  );
}
