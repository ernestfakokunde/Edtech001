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
      <main className="screen-wrap generate-loading">
        <div className="generate-loader">
          <span className="generate-loader-icon"><Loader2 size={28} className="spin" /></span>
          <strong>Generating your {mode === "quiz" ? "quiz" : "flashcard"} set</strong>
          <span>{mode === "quiz"
            ? "Quiz generation usually takes less than a minute. We’re reading your material, writing exam-style questions, and checking the answer choices. Larger files may take a little longer, so please keep this page open."
            : `We’re reading your material and creating ${length} study cards. This usually takes under a minute.`}</span>
          <div className="generate-loader-steps"><span className="active">Upload material</span><span>Review key topics</span><span>{mode === "quiz" ? "Build quiz and answers" : "Create study cards"}</span></div>
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
      <div className="length-control">
        <label htmlFor="generation-course">Course (optional)</label>
        <select id="generation-course" value={course?.id ?? ""} onChange={(event) => setCourse(courseOptions.find((item) => item.id === event.target.value) ?? null)}>
          <option value="">No course · quick practice</option>
          {courseOptions.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.title}</option>)}
        </select>
        {courseLoading && <small>Loading saved courses… you can upload now.</small>}
        {!courseLoading && <small>Want to group this set? <button className="text-button" onClick={openAddForm}>Add a course</button></small>}
      </div>
      {addingCourse && (
        <div className="course-creator">
          {!school && <p className="course-school-missing">Add your university and faculty on your profile to save a course. You can still continue without one.</p>}
          <div className="course-form-grid two">
            <input value={newCourse.code} onChange={(event) => setNewCourse({ ...newCourse, code: event.target.value.toUpperCase() })} placeholder="Course code e.g. CSC 201" disabled={!school} />
            <input value={newCourse.title} onChange={(event) => setNewCourse({ ...newCourse, title: event.target.value })} placeholder="Course title e.g. Data Structures" disabled={!school} />
          </div>
          {addCourseError && <small className="upload-form-error">{addCourseError}</small>}
          <div className="course-creator-actions">
            <button className="secondary-button" onClick={closeAddForm}><X size={14} /> Cancel</button>
            {school ? <button className="primary-button" disabled={addingCourseBusy} onClick={() => void addCourseHandler()}>{addingCourseBusy ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Save course</button> : <button className="primary-button" onClick={() => go("profile")}>Go to profile</button>}
          </div>
        </div>
      )}

      <label className="upload-zone generate-upload">
        <Upload size={17} />
        <span>{selectedFile ? selectedFile.name : "Choose a PDF or DOCX file"}</span>
        <small>{fileProblem ?? (selectedFile ? "Ready to process" : `The file is used only to generate your private practice set — PDF or DOCX up to ${MAX_UPLOAD_LABEL}.`)}</small>
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => { const file = event.target.files?.[0] || null; setSelectedFile(file); setError(file ? uploadFileProblem(file) ?? "" : ""); }}
        />
      </label>

      <div className="choice-grid">
        {([
          ["flashcards", "Flashcards", "Flip through key questions and answers at your pace", FlipHorizontal2],
          ["quiz", "Quiz", "Timed multiple-choice practice with a score at the end", Check],
        ] as const).map(([value, title, description, Icon]) => (
          <button
            className={`mode-choice ${mode === value ? "selected" : ""}`}
            key={value}
            onClick={() => setMode(value)}
          >
            <span className="choice-icon"><Icon size={19} /></span>
            <strong>{title}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>

      {mode === "quiz" && <p className="quiz-generation-note">Each question has four answer choices. Your answer key and explanations are saved with the quiz, so you can review them after you finish.</p>}

      <div className="length-control">
        <label>Set length</label>
        <div className="lengths">
          {LENGTH_OPTIONS.map((option) => (
            <button key={option} className={length === option ? "selected" : ""} onClick={() => setLength(option)}>
              {option}
            </button>
          ))}
        </div>
      </div>

      {mode === "quiz" && (
        <div className="length-control">
          <label>Time per question</label>
          <div className="lengths">
            {TIME_OPTIONS.map((option) => (
              <button key={option} className={timePerQuestion === option ? "selected" : ""} onClick={() => setTimePerQuestion(option)}>
                {option}s <Clock3 size={12} />
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "quiz" && quota.limit !== null && (
        <div className={`quota-banner ${quota.remaining === 0 ? "exhausted" : ""}`}>
          <Clock3 size={14} />
          <span>Free plan: {quota.remaining ?? 0} of {quota.limit} quiz generations left today{quota.resetsAt ? ` · resets ${new Date(quota.resetsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}. Pro includes unlimited quizzes.</span>
          <button type="button" onClick={() => go("profile")}>Go Pro</button>
        </div>
      )}

      {error && <small className="upload-form-error">{error}</small>}

      <button
        className="primary-button full"
        disabled={!selectedFile || fileProblem !== null || (mode === "quiz" && quota.limit !== null && (quota.remaining ?? 0) === 0)}
        onClick={() => void submit()}
      >
        <Sparkles size={16} /> Create {mode === "quiz" ? "quiz" : "flashcards"}
      </button>
    </PageFrame>
  );
}
