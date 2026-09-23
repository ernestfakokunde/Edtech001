import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  Clock3,
  FileText,
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
  getGenerationProviders,
  getGenerationQuota,
  getMyCourses,
  getMyPapers,
  getRepositoryPapers,
  type GeneratedSet,
  type GenerationProvider,
  type GenerationQuota,
  type MySchool,
} from "../lib/api";
import type { Mode } from "../types";

const LENGTH_OPTIONS = [10, 20, 30, 60];
const TIME_OPTIONS = [30, 60] as const;

type CourseOption = { id: string; code: string; title: string };

/**
 * The "Generate for me" screen. Course context arrives through routing
 * (`#generate/<courseId>`) from wherever the student navigated from; if that
 * context is missing, they pick a course from the ones they already have.
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
  const [pickingCourse, setPickingCourse] = useState(!courseId);
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
  // AI providers available on this server. `provider` is the one the user
  // picked; only shown when the server has more than one configured.
  const [generationProviders, setGenerationProviders] = useState<GenerationProvider[]>([]);
  const [provider, setProvider] = useState("");
  // Daily quiz quota for FREE accounts (PREMIUM = unlimited).
  const [quota, setQuota] = useState<GenerationQuota>({ tier: "FREE", limit: null, used: 0, remaining: null, resetsAt: "" });

  const providerLabel = generationProviders.find((entry) => entry.id === provider)?.label ?? "AI";

  useEffect(() => {
    let alive = true;
    (async () => {
      // One pass builds the picker: saved profile courses first (so they always
      // appear), then courses seen in the student's papers and the repository.
      // Nothing is refetched while the student interacts with the page.
      const [mine, repo, saved] = await Promise.allSettled([
        getMyPapers(),
        getRepositoryPapers({ pageSize: 200 }),
        getMyCourses(),
      ]);
      if (!alive) return;
      const found: CourseOption[] = [];
      if (saved.status === "fulfilled") {
        setSchool(saved.value.school);
        found.push(...saved.value.courses);
      }
      if (mine.status === "fulfilled") found.push(...mine.value.papers.map((paper) => paper.course));
      if (repo.status === "fulfilled") found.push(...repo.value.papers.map((paper) => paper.course));
      const unique = [...new Map(found.map((item) => [item.id, item])).values()];
      const providers = await getGenerationProviders().catch(() => null);
      const quotaValue = await getGenerationQuota().catch(() => null);
      if (!alive) return;
      if (quotaValue) setQuota(quotaValue);
      setCourseOptions(unique);
      if (providers) {
        const available = providers.providers.filter((entry) => entry.configured);
        setGenerationProviders(available);
        // Prefer the server's primary provider; otherwise fall back to the first
        // one that is ready. Empty stays empty — the backend will say so.
        setProvider(available.some((entry) => entry.id === providers.primary) ? providers.primary : available[0]?.id ?? "");
      }
      if (courseId) {
        const match = unique.find((item) => item.id === courseId) ?? null;
        setCourse(match);
        if (match) setPickingCourse(false);
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
      setPickingCourse(false);
      closeAddForm();
      setCourseOptions((current) => (current.some((item) => item.id === created.id) ? current : [...current, created].sort((a, b) => a.code.localeCompare(b.code))));
    } catch (reason) {
      setAddCourseError(errorMessage(reason, "Could not save the course."));
    } finally {
      setAddingCourseBusy(false);
    }
  }

  async function submit() {
    if (!course || !selectedFile) return;
    setBusy(true);
    setError("");
    try {
      const set = await generateStudySet({
        file: selectedFile,
        courseId: course.id,
        type: mode === "quiz" ? "QUIZ" : "FLASHCARD",
        length,
        ...(provider ? { provider } : {}),
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
          <span>Reading your document and creating {length} items with {providerLabel} — this usually takes under a minute.</span>
          <div className="generate-loader-steps"><span className="active">Upload</span><span>Extract text</span><span>Create set</span></div>
        </div>
      </main>
    );
  }

  if (pickingCourse && !course) {
    return (
      <PageFrame
        eyebrow="AI study tools"
        title="Choose a course"
        subtitle="Pick one of your courses, or add a new one with its code and title."
        back="dashboard"
      >
        {!addingCourse && (
          <div className="course-picker-actions">
            <button className="secondary-button" onClick={openAddForm}>
              <Plus size={15} /> Add a course
            </button>
            {school && <span className="school-chip">{school.universityName} · {school.facultyName}</span>}
          </div>
        )}

        {addingCourse && (
          <div className="course-creator">
            {!school && <p className="course-school-missing">Your school isn't saved yet — add your university and faculty on your profile first.</p>}
            <div className="course-form-grid two">
              <input
                value={newCourse.code}
                onChange={(event) => setNewCourse({ ...newCourse, code: event.target.value.toUpperCase() })}
                placeholder="Course code e.g. CSC 201"
                disabled={!school}
              />
              <input
                value={newCourse.title}
                onChange={(event) => setNewCourse({ ...newCourse, title: event.target.value })}
                placeholder="Course title e.g. Data Structures"
                disabled={!school}
              />
            </div>
            {addCourseError && <small className="upload-form-error">{addCourseError}</small>}
            <div className="course-creator-actions">
              <button className="secondary-button" onClick={closeAddForm}><X size={14} /> Cancel</button>
              {school ? (
                <button className="primary-button" disabled={addingCourseBusy} onClick={() => void addCourseHandler()}>
                  {addingCourseBusy ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Save course
                </button>
              ) : (
                <button className="primary-button" onClick={() => go("profile")}>Go to profile</button>
              )}
            </div>
          </div>
        )}

        {courseLoading ? (
          <div className="repository-empty"><Loader2 size={18} className="spin" /> Loading your courses...</div>
        ) : courseOptions.length ? (
          <div className="course-list">
            {courseOptions.map((item) => (
              <button
                className="course-row"
                key={item.id}
                onClick={() => { setCourse({ ...item }); setPickingCourse(false); }}
              >
                <div>
                  <strong>{item.code}</strong>
                  <span>{item.title}</span>
                </div>
                <div className="row-end"><ChevronRight size={18} /></div>
              </button>
            ))}
          </div>
        ) : (
          <div className="repository-empty">
            <FileText size={20} />
            <strong>No courses saved yet</strong>
            <span>Add your first course — just a code and title — and it stays on your profile for every future session.</span>
            <button className="primary-button" onClick={openAddForm}>
              <Plus size={15} /> Add a course
            </button>
          </div>
        )}
      </PageFrame>
    );
  }
return (
    <PageFrame
      eyebrow={course ? `${course.code} · ${course.title}` : "AI study tools"}
      title="What do you want to create?"
      subtitle="Upload a PDF or Word document and AI will turn it into a private practice set."
      back="dashboard"
    >
      {course && (
        <div className="course-context"><Check size={14} /><span>Course</span><strong>{course.code} · {course.title}</strong></div>
      )}

      <label className="upload-zone generate-upload">
        <Upload size={17} />
        <span>{selectedFile ? selectedFile.name : "Choose a PDF, DOC, or DOCX file"}</span>
        <small>{selectedFile ? "Ready to process" : "The file is used only to generate your private practice set."}</small>
        <input
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => { setSelectedFile(event.target.files?.[0] || null); setError(""); }}
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

      {generationProviders.length > 1 && (
        <div className="length-control">
          <label>Generation engine</label>
          <div className="generation-providers">
            {generationProviders.map((entry) => (
              <button key={entry.id} className={provider === entry.id ? "selected" : ""} onClick={() => setProvider(entry.id)}>
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
          <span>Free plan: {quota.remaining ?? 0} of {quota.limit} quiz generations left today{quota.resetsAt ? ` · resets ${new Date(quota.resetsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}. Premium users get unlimited quizzes.</span>
        </div>
      )}

      {error && <small className="upload-form-error">{error}</small>}

      <button
        className="primary-button full"
        disabled={!course || !selectedFile || (mode === "quiz" && quota.limit !== null && (quota.remaining ?? 0) === 0)}
        onClick={() => void submit()}
      >
        <Sparkles size={16} /> Create {mode === "quiz" ? "quiz" : "flashcards"}
      </button>
    </PageFrame>
  );
}