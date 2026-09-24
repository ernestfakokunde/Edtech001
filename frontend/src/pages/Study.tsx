import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  FlipHorizontal2,
  Pencil,
  RotateCcw,
  Search,
  Share2,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { courses, papers } from "../data";
import { go, PageFrame } from "../components/Layout";
import {
  errorMessage,
  getPaperDownloadUrl,
  getDepartments,
  getFaculties,
  getMyPapers,
  getRepositoryPapers,
  getUniversities,
  deleteMyPaper,
  submitPaper,
  updateMyPaper,
  uploadFileProblem,
  uploadPaper,
  type Department,
  type Faculty,
  type University,
  type OwnedPaper,
  type UploadedPaper,
  type RepositoryPaper,
  type GeneratedSet,
} from "../lib/api";
import type { Course, Mode, Paper } from "../types";

export function PersonalPractice() {
  return (
    <PageFrame
      title="Study tools are in progress"
      subtitle="Flashcards and quizzes will be added after the paper repository is complete."
      back="dashboard"
    >
      <div className="progress-placeholder"><Upload size={22} /><strong>Personal study workspace</strong><span>Bring your papers here for private study once the study tools are ready.</span></div>
    </PageFrame>
  );
}

export function Hierarchy({
  onMaterial,
}: {
  onMaterial: (paper: RepositoryPaper) => void;
}) {
  const [paperRefresh, setPaperRefresh] = useState(0);
  return (
    <PageFrame
      title="Find a paper to study"
      subtitle="Search the shared repository by paper name, course, level, or description."
      back="dashboard"
    >
      <RepositoryBrowser onMaterial={onMaterial} />
      <RepositoryUpload onUploaded={() => setPaperRefresh((value) => value + 1)} />
      <MyPapers refreshKey={paperRefresh} />
    </PageFrame>
  );
}

function RepositoryBrowser({ onMaterial }: { onMaterial: (paper: RepositoryPaper) => void }) {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [repositoryPapers, setRepositoryPapers] = useState<Awaited<ReturnType<typeof getRepositoryPapers>>["papers"]>([]);
  const [pages, setPages] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  useEffect(() => { getUniversities().then((result) => setUniversities(result.universities)).catch(() => setUniversities([])); }, []);
  useEffect(() => { setFaculties([]); setDepartments([]); setFacultyId(""); setDepartmentId(""); if (universityId) getFaculties(universityId).then((result) => setFaculties(result.faculties)).catch(() => setFaculties([])); }, [universityId]);
  useEffect(() => { setDepartments([]); setDepartmentId(""); if (facultyId) getDepartments(facultyId).then((result) => setDepartments(result.departments)).catch(() => setDepartments([])); }, [facultyId]);
  useEffect(() => { setLoading(true); getRepositoryPapers({ search, level, universityId, facultyId, departmentId, page: pages.page }).then((result) => { setRepositoryPapers(result.papers); setPages(result.pagination); }).catch(() => { setRepositoryPapers([]); setPages((current) => ({ ...current, total: 0, pages: 1 })); }).finally(() => setLoading(false)); }, [search, level, universityId, facultyId, departmentId, pages.page]);
  function resetPage() { setPages((current) => ({ ...current, page: 1 })); }
  return <div className="repository-browser"><div className="repository-filters"><div className="search-field large"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Search paper, course, or description" /></div><select value={level} onChange={(event) => { setLevel(event.target.value); resetPage(); }}><option value="">All levels</option><option>100 level</option><option>200 level</option><option>300 level</option><option>400 level</option><option>500 level</option></select><select value={universityId} onChange={(event) => { setUniversityId(event.target.value); resetPage(); }}><option value="">All universities</option>{universities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={facultyId} disabled={!universityId} onChange={(event) => { setFacultyId(event.target.value); resetPage(); }}><option value="">All faculties</option>{faculties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={departmentId} disabled={!facultyId} onChange={(event) => { setDepartmentId(event.target.value); resetPage(); }}><option value="">All departments</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>{loading ? <div className="repository-empty">Loading repository...</div> : repositoryPapers.length ? <><div className="repository-paper-grid">{repositoryPapers.map((paper) => <article className="repository-paper-card" key={paper.id} tabIndex={0} role="button" onClick={() => onMaterial(paper)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onMaterial(paper); }}><div className="repository-paper-top"><span className="paper-icon"><FileText size={17} /></span><span className="badge active">{paper.level}</span></div><h3>{paper.course.code} · {paper.course.title}</h3><strong>{paper.year}/{paper.session} · {paper.semester === "FIRST" ? "First" : "Second"} semester</strong><p>{paper.description}</p><div className="repository-paper-meta"><span>View material details</span><ChevronRight size={14} /></div></article>)}</div><div className="repository-pagination"><span>{pages.total} approved materials</span><div><button className="ghost-button" disabled={pages.page <= 1} onClick={() => setPages((current) => ({ ...current, page: current.page - 1 }))}>Previous</button><span>Page {pages.page} of {pages.pages}</span><button className="ghost-button" disabled={pages.page >= pages.pages} onClick={() => setPages((current) => ({ ...current, page: current.page + 1 }))}>Next</button></div></div></> : <div className="repository-empty"><FileText size={20} /><strong>No approved papers found</strong><span>Try another course, level, or search phrase.</span></div>}</div>;
}

function MyPapers({ refreshKey }: { refreshKey: number }) {
  const [papers, setPapers] = useState<OwnedPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ description: "", level: "", session: "", year: "", semester: "FIRST" as "FIRST" | "SECOND" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState<string | null>(null);
  async function load() { setLoading(true); try { setPapers((await getMyPapers()).papers); } catch (reason) { setError(errorMessage(reason, "Could not load your papers.")); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, [refreshKey]);
  function startEdit(paper: OwnedPaper) { setEditing(paper.id); setForm({ description: paper.description, level: paper.level, session: paper.session, year: String(paper.year), semester: paper.semester }); setMessage(""); setError(""); }
  async function save(paperId: string) { setBusy(paperId); setError(""); try { const result = await updateMyPaper(paperId, { ...form, year: Number(form.year) }); setPapers((current) => current.map((paper) => paper.id === paperId ? result.paper : paper)); setEditing(null); setMessage("Paper details saved."); } catch (reason) { setError(errorMessage(reason, "Could not save paper details.")); } finally { setBusy(""); } }
  async function remove(paperId: string) { if (!window.confirm("Delete this private paper?")) return; setBusy(paperId); setError(""); try { await deleteMyPaper(paperId); setPapers((current) => current.filter((paper) => paper.id !== paperId)); setMessage("Paper deleted."); } catch (reason) { setError(errorMessage(reason, "Could not delete paper.")); } finally { setBusy(""); } }
  async function submit(paperId: string) { setConfirmSubmit(null); setBusy(paperId); setError(""); try { const result = await submitPaper(paperId); setPapers((current) => current.map((paper) => paper.id === paperId ? result.paper : paper)); setMessage("Paper submitted for review."); } catch (reason) { setError(errorMessage(reason, "Could not submit paper.")); } finally { setBusy(""); } }
  return <section className="my-papers-panel">{confirmSubmit && <SubmitConfirmDialog onCancel={() => setConfirmSubmit(null)} onConfirm={() => { if (confirmSubmit) void submit(confirmSubmit); }} />}<div className="repository-upload-heading"><div><p className="eyebrow">Your uploads</p><h2>Paper workflow</h2><p>Track private uploads, submit rejected papers again, or update details before review.</p></div><span className="admin-status">{papers.length} papers</span></div>{loading ? <div className="repository-empty">Loading your papers...</div> : papers.length === 0 ? <div className="repository-empty"><FileText size={20} /><strong>No uploads yet</strong><span>Your private papers will appear here after upload.</span></div> : <div className="my-paper-list">{papers.map((paper) => <article className="my-paper-row" key={paper.id}><div className="paper-info"><strong>{paper.course.code} · {paper.course.title}</strong><span>{paper.level} · {paper.year}/{paper.session} · {paper.semester === "FIRST" ? "First" : "Second"} semester</span><small>{paper.description}</small></div><span className={`badge ${paper.status === "APPROVED" ? "active" : paper.status === "REJECTED" ? "rejected" : "empty"}`}>{paper.status}</span><div className="my-paper-actions"><button className="ghost-button" onClick={() => go(`generate/${paper.course.id}`)}><Sparkles size={14} /> Create practice set</button>{(paper.status === "DRAFT" || paper.status === "REJECTED") && <><button className="ghost-button" disabled={busy === paper.id} onClick={() => startEdit(paper)}><Pencil size={14} /> Edit</button><button className="ghost-button" disabled={busy === paper.id} onClick={() => void remove(paper.id)}><Trash2 size={14} /> Delete</button><button className="primary-button" disabled={busy === paper.id} onClick={() => setConfirmSubmit(paper.id)}><Send size={14} /> Submit</button></>}</div>{editing === paper.id && <div className="my-paper-edit"><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><div className="paper-edit-fields"><input value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })} placeholder="Level" /><input value={form.session} onChange={(event) => setForm({ ...form, session: event.target.value })} placeholder="Session" /><input type="number" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} placeholder="Year" /><select value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value as "FIRST" | "SECOND" })}><option value="FIRST">First semester</option><option value="SECOND">Second semester</option></select></div><button className="primary-button" disabled={busy === paper.id} onClick={() => void save(paper.id)}><Check size={14} /> Save changes</button><button className="ghost-button" onClick={() => setEditing(null)}>Cancel</button></div>}</article>)}</div>}{message && <small className="upload-form-success">{message}</small>}{error && <small className="upload-form-error">{error}</small>}</section>;
}

export function MaterialDetails({ paper }: { paper: RepositoryPaper }) {
  const [error, setError] = useState("");
  async function download() {
    try { const result = await getPaperDownloadUrl(paper.id); window.open(result.url, "_blank", "noopener,noreferrer"); }
    catch (reason) { setError(errorMessage(reason, "Could not download this material.")); }
  }
  return <PageFrame eyebrow="Repository material" title={`${paper.course.code} · ${paper.course.title}`} subtitle="Material details and download"><div className="material-details"><div className="material-details-icon"><FileText size={26} /></div><dl><div><dt>Level</dt><dd>{paper.level}</dd></div><div><dt>Academic session</dt><dd>{paper.year}/{paper.session}</dd></div><div><dt>Semester</dt><dd>{paper.semester === "FIRST" ? "First" : "Second"} semester</dd></div><div><dt>Description</dt><dd>{paper.description}</dd></div></dl><div className="material-actions"><button className="primary-button" onClick={() => void download()}><FileText size={15} /> Download material</button><button className="ghost-button" onClick={() => go(`generate/${paper.course.id}`)}><Sparkles size={15} /> Create practice set</button></div>{error && <small className="upload-form-error">{error}</small>}</div></PageFrame>;
}

function RepositoryUpload({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({ universityName: "", facultyName: "", courseTitle: "", courseCode: "", description: "", level: "", session: "", year: "", semester: "FIRST" as "FIRST" | "SECOND" });
  const [uploadedPaper, setUploadedPaper] = useState<UploadedPaper | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setMessage("");
  }

  async function upload() {
    if (!selectedFile) return;
    // Caught here too so no code path can start an upload the API will refuse
    // mid-transfer (oversize files are reported as a bare "Failed to fetch" on
    // mobile — see uploadFileProblem in lib/api.ts).
    const problem = uploadFileProblem(selectedFile);
    if (problem) { setError(problem); return }
    setBusy(true);
    setError("");
    try {
      const result = await uploadPaper({ file: selectedFile, ...form });
      setUploadedPaper(result.paper);
      onUploaded();
      setMessage("Paper uploaded privately. Submit it for repository review below.");
    } catch (reason) {
      setError(errorMessage(reason, "Could not upload the paper."));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!uploadedPaper) return;
    setConfirming(false);
    setBusy(true);
    setError("");
    try {
      const result = await submitPaper(uploadedPaper.id);
      setUploadedPaper(result.paper);
      setMessage("Submitted. An admin must approve it before it appears in the repository.");
    } catch (reason) {
      setError(errorMessage(reason, "Could not submit the paper."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="repository-upload-panel">
      {confirming && <SubmitConfirmDialog onCancel={() => setConfirming(false)} onConfirm={() => void submit()} />}
      <div className="repository-upload-heading">
        <div><p className="eyebrow">Contribute to the repository</p><h2>Have a past paper?</h2><p>Upload a PDF or Word document and submit it for review. Approved papers become visible to other students.</p></div>
        <button className="primary-button" onClick={() => setOpen(!open)}><Upload size={15} /> {open ? "Close upload form" : "Upload a paper"}</button>
      </div>
      {open && <div className="paper-upload-form">
        <h3>Upload a paper to the repository</h3>
        <p>Your upload stays private until you submit it and an admin approves it.</p>
        <div className="paper-upload-fields typed-upload-fields">
          <label className="field"><span>University name</span><input value={form.universityName} onChange={(event) => updateField("universityName", event.target.value)} placeholder="e.g. Federal University of Technology Minna" /></label>
          <label className="field"><span>Faculty name</span><input value={form.facultyName} onChange={(event) => updateField("facultyName", event.target.value)} placeholder="e.g. Computing" /></label>
          <label className="field"><span>Course name</span><input value={form.courseTitle} onChange={(event) => updateField("courseTitle", event.target.value)} placeholder="e.g. Human Computer Interaction" /></label>
          <label className="field"><span>Course code</span><input value={form.courseCode} onChange={(event) => updateField("courseCode", event.target.value)} placeholder="e.g. CPT 412" /></label>
          <label className="field"><span>PDF or Word file</span><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} /></label>
        </div>
        <div className="paper-upload-fields">
          <label className="field"><span>Level</span><select value={form.level} onChange={(event) => updateField("level", event.target.value)}><option value="">Choose level</option>{[100, 200, 300, 400, 500].map((value) => <option key={value}>{value} level</option>)}</select></label>
          <label className="field"><span>Session</span><input value={form.session} onChange={(event) => updateField("session", event.target.value)} placeholder="2024/2025" /></label>
          <label className="field"><span>Year</span><input type="number" value={form.year} onChange={(event) => updateField("year", event.target.value)} placeholder="2024" /></label>
          <label className="field"><span>Semester</span><select value={form.semester} onChange={(event) => updateField("semester", event.target.value as "FIRST" | "SECOND")}><option value="FIRST">First semester</option><option value="SECOND">Second semester</option></select></label>
        </div>
        <label className="field"><span>Description</span><textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Describe the paper for students searching the repository." /></label>
        <div className="upload-form-actions"><button className="primary-button" disabled={busy || Boolean(uploadedPaper) || !selectedFile || uploadFileProblem(selectedFile) !== null || !form.universityName.trim() || !form.facultyName.trim() || !form.courseTitle.trim() || !form.courseCode.trim() || !form.description.trim() || !form.level || !form.session.trim() || !form.year} onClick={() => void upload()}><Upload size={15} /> {busy ? "Uploading..." : "Upload PDF"}</button>{uploadedPaper && <button className="ghost-button" disabled={busy || confirming || uploadedPaper.status === "PENDING"} onClick={() => setConfirming(true)}><Send size={14} /> {uploadedPaper.status === "PENDING" ? "Pending review" : "Submit for review"}</button>}</div>
        {message && <small className="upload-form-success">{message}</small>}
        {error && <small className="upload-form-error">{error}</small>}
      </div>}
    </section>
  );
}

export function CourseSelection({
  onCourse,
}: {
  onCourse: (course: Course) => void;
}) {
  const [search, setSearch] = useState("");
  const visible = courses.filter((course) =>
    `${course.code} ${course.title}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <PageFrame
      eyebrow="FUT Minna · Computing · Cyber Security"
      title="Choose a course"
      subtitle="Your courses will appear here after they are added."
      back="hierarchy"
    >
      <div className="search-field large">
        <Search size={16} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search course code or title"
        />
      </div>
      <div className="course-list">
        {visible.length ? visible.map((course) => (
          <button
            className="course-row"
            key={course.code}
            onClick={() => onCourse(course)}
          >
            <div>
              <strong>{course.code}</strong>
              <span>{course.title}</span>
            </div>
            <div className="row-end">
              <span className={`badge ${course.papers ? "active" : "empty"}`}>
                {course.papers ? `${course.papers} papers` : "No papers yet"}
              </span>
              <ChevronRight size={18} />
            </div>
          </button>
        )) : <div className="repository-empty"><BookOpen size={20} /><strong>No course added yet</strong><span>Open Find a paper to browse the repository or upload a paper.</span><button className="primary-button" onClick={() => go("hierarchy")}>Find a paper</button></div>}
      </div>
    </PageFrame>
  );
}

export function CoursePage({
  course,
  uploaded,
  onUpload,
}: {
  course: Course;
  uploaded: boolean;
  onUpload: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedPaper, setUploadedPaper] = useState<UploadedPaper | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", description: "", level: "", session: "", year: "", semester: "FIRST" as "FIRST" | "SECOND" });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  async function submitForReview(paperId: string) {
    setConfirming(false);
    setSubmitting(true);
    try { const result = await submitPaper(paperId); setUploadedPaper(result.paper); setUploadMessage("Submitted for admin review."); }
    catch (reason) { setUploadError(errorMessage(reason, "Could not submit paper.")); }
    finally { setSubmitting(false); }
  }
  const list = uploadedPaper
    ? [
        papers[0],
        {
          id: uploadedPaper.id,
          title: `${course.code} · ${course.title}`,
          detail: `${uploadedPaper.level} · ${uploadedPaper.year}/${uploadedPaper.session} · ${uploadedPaper.status === "PENDING" ? "Pending review" : "Private upload"}`,
          status: uploadedPaper.status === "PENDING" ? "Pending" : "Private",
        },
        ...papers.slice(1),
      ]
    : papers;
  return (
    <PageFrame
      eyebrow="Cyber Security / Course workspace"
      title={course.title}
      subtitle={`${course.papers} papers in the shared repository · ${uploaded ? 4 : 3} uploaded by you`}
      back="dashboard"
    >
      {confirming && uploadedPaper && <SubmitConfirmDialog onCancel={() => setConfirming(false)} onConfirm={() => void submitForReview(uploadedPaper.id)} />}
      <div className="tabs">
        <button className="active">Repository & uploads</button>
        <button>My generated sets</button>
      </div>
      <label className="upload-zone">
        <Upload size={17} />
        <span>{selectedFile?.name || "Choose a PDF or Word past paper"}</span>
        <small>Upload privately first, then submit it for admin review.</small>
        <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { const file = event.target.files?.[0] || null; setSelectedFile(file); setUploadError(file ? uploadFileProblem(file) ?? "" : ""); setUploadMessage(""); }} />
      </label>
      {selectedFile && !uploadedPaper && <div className="paper-upload-form"><h3>Describe this paper</h3><p>These details help students find the right PDF and help admins review contributions.</p><div className="paper-upload-fields"><label className="field"><span>PDF name</span><input value={uploadForm.title} onChange={(event) => setUploadForm({ ...uploadForm, title: event.target.value })} placeholder="e.g. CPT 412 First semester exam" /></label><label className="field"><span>Level</span><select value={uploadForm.level} onChange={(event) => setUploadForm({ ...uploadForm, level: event.target.value })}><option value="">Choose level</option>{[100, 200, 300, 400, 500].map((value) => <option key={value}>{value} level</option>)}</select></label><label className="field"><span>Session</span><input value={uploadForm.session} onChange={(event) => setUploadForm({ ...uploadForm, session: event.target.value })} placeholder="2024/2025" /></label><label className="field"><span>Year</span><input type="number" value={uploadForm.year} onChange={(event) => setUploadForm({ ...uploadForm, year: event.target.value })} placeholder="2024" /></label><label className="field"><span>Semester</span><select value={uploadForm.semester} onChange={(event) => setUploadForm({ ...uploadForm, semester: event.target.value as "FIRST" | "SECOND" })}><option value="FIRST">First semester</option><option value="SECOND">Second semester</option></select></label></div><label className="field"><span>Description</span><textarea value={uploadForm.description} onChange={(event) => setUploadForm({ ...uploadForm, description: event.target.value })} placeholder="Briefly describe what this paper covers or who it is useful for." /></label><button className="primary-button" disabled={uploading || !course.id || !uploadForm.title.trim() || !uploadForm.description.trim() || !uploadForm.level || !uploadForm.session.trim() || !uploadForm.year} onClick={() => { if (!selectedFile || !course.id) return; const fileProblem = uploadFileProblem(selectedFile); if (fileProblem) { setUploadError(fileProblem); return } setUploading(true); setUploadError(""); void uploadPaper({ file: selectedFile, courseId: course.id, ...uploadForm }).then((result) => { setUploadedPaper(result.paper); onUpload(); setUploadMessage("Paper uploaded privately. You can now submit it for admin review."); }).catch((reason) => setUploadError(errorMessage(reason, "Could not upload paper."))).finally(() => setUploading(false)); }}>{uploading ? "Uploading..." : "Upload privately"} <Upload size={15} /></button>{!course.id && <small className="upload-form-warning">This demo course is not connected to a database course yet.</small>}{uploadMessage && <div className="upload-notice"><Check size={16} /> {uploadMessage}</div>}{uploadError && <div className="profile-feedback error">{uploadError}</div>}</div>}
      <div className="paper-list">
        {list.map((paper) => (
          <article className="paper-row" key={paper.id}>
            <div className="paper-icon">
              <FileText size={17} />
            </div>
            <div className="paper-info">
              <strong>{paper.title}</strong>
              <span>{paper.detail}</span>
            </div>
            <div className="paper-actions">
                <PaperActions paperId={paper.id} />
              {paper.id === uploadedPaper?.id && paper.status === "Private" ? (
                <button className="ghost-button" disabled={submitting || confirming} onClick={() => setConfirming(true)}>
                  <Send size={14} /> {submitting ? "Submitting..." : "Submit for review"}
                </button>
              ) : (
                <span className="badge active">{paper.status}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </PageFrame>
  );
}

function PaperActions({ paperId }: { paperId: string }) {
  const [message, setMessage] = useState("");
  async function download() { try { const result = await getPaperDownloadUrl(paperId); window.open(result.url, "_blank", "noopener,noreferrer"); } catch (error) { setMessage(errorMessage(error, "Could not open PDF.")); } }
  async function share() { try { const result = await getPaperDownloadUrl(paperId); if (navigator.share) await navigator.share({ title: "RecappEdu paper", url: result.url }); else { await navigator.clipboard.writeText(result.url); setMessage("PDF link copied."); } } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(errorMessage(error, "Could not share PDF.")); } }
  return <div className="paper-actions"><button className="outline-button" onClick={() => void download()}>Download PDF</button><button className="ghost-button" onClick={() => void share()}><Share2 size={14} /> Share</button>{message && <small className="paper-action-message">{message}</small>}</div>;
}
function SubmitConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="confirm-backdrop">
      <div className="confirm-dialog">
        <p className="eyebrow">Before you submit</p>
        <h2>Make this paper public?</h2>
        <p>Once approved, this PDF will be visible to every student in the repository with your name linked to it. Approved papers stay public, so read your details carefully before submitting.</p>
        <div className="confirm-dialog-actions">
          <button className="secondary-button" onClick={onCancel}>Not yet</button>
          <button className="primary-button" onClick={onConfirm}>Yes, submit for review</button>
        </div>
      </div>
    </div>
  );
}

export function Generate({
  course,
  paper,
  mode,
  length,
  onMode,
  onLength,
  onGenerate,
}: {
  course: Course;
  paper: Paper;
  mode: Mode;
  length: string;
  onMode: (mode: Mode) => void;
  onLength: (length: string) => void;
  onGenerate: () => void;
}) {
  return (
    <PageFrame
      title="What do you want to create?"
      subtitle="AI will generate a set from this paper's questions."
      back="course"
    >
      <div className="source-paper">
        <div className="paper-icon">
          <FileText size={16} />
        </div>
        <div>
          <strong>{paper.title}</strong>
          <span>
            {course.code} · {course.title}
          </span>
        </div>
      </div>
      <div className="choice-grid">
        {(
          [
            [
              "flashcards",
              "Flashcards",
              "Flip through key questions and answers at your pace",
              FlipHorizontal2,
            ],
            [
              "quiz",
              "Quiz",
              "Timed multiple-choice practice with a score at the end",
              Check,
            ],
          ] as const
        ).map(([value, title, description, Icon]) => (
          <button
            className={`mode-choice ${mode === value ? "selected" : ""}`}
            key={value}
            onClick={() => onMode(value)}
          >
            <span className="choice-icon">
              <Icon size={19} />
            </span>
            <strong>{title}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>
      <div className="length-control">
        <label>Set length</label>
        <div className="lengths">
          {["15", "30", "60", "All"].map((option) => (
            <button
              className={length === option ? "selected" : ""}
              key={option}
              onClick={() => onLength(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <button className="primary-button full" onClick={onGenerate}>
        <Sparkles size={16} /> Create {mode}
      </button>
    </PageFrame>
  );
}

function PlayerFrame({
  children,
  count,
  onExit,
}: {
  children: React.ReactNode;
  count: string;
  onExit: () => void;
}) {
  return (
    <main className="player-wrap">
      <div className="player-top">
        <button
          className="icon-button"
          onClick={onExit}
          aria-label="Exit practice"
        >
          <X size={16} />
        </button>
        <span>{count}</span>
        <Sparkles size={15} color="#1d4ed8" />
      </div>
      <div className="progress-bar">
        <span />
      </div>
      {children}
    </main>
  );
}
export function Flashcards({
  set,
  onExit,
  onQuiz,
}: {
  set: GeneratedSet;
  onExit: () => void;
  onQuiz?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const total = set.items.length;
  const card = total > 0 ? set.items[index]?.question : undefined;
  return (
    <PlayerFrame count={`Card ${Math.min(index + 1, Math.max(total, 1))} of ${total}`} onExit={onExit}>
      {card ? (
        <button className="flashcard" onClick={() => setFlipped(!flipped)}>
          <span className="card-tag">{flipped ? "Answer" : "Question"}</span>
          <strong>{flipped ? card.answer : card.prompt}</strong>
          {flipped && card.explanation && <p className="card-explanation">{card.explanation}</p>}
          <small>
            <RotateCcw size={14} /> Tap to {flipped ? "see question" : "reveal answer"}
          </small>
        </button>
      ) : (
        <div className="flashcard-empty">This set has no cards yet.</div>
      )}
      <div className="player-actions">
        <button
          className="icon-button"
          disabled={index === 0 || total === 0}
          onClick={() => {
            setIndex(index - 1);
            setFlipped(false);
          }}
        >
          <ArrowLeft size={17} />
        </button>
        <button className="secondary-button" disabled={total === 0} onClick={() => setFlipped(!flipped)}>
          <FlipHorizontal2 size={15} /> Flip card
        </button>
        <button
          className="icon-button"
          disabled={index === total - 1 || total === 0}
          onClick={() => {
            setIndex(index + 1);
            setFlipped(false);
          }}
        >
          <ArrowRight size={17} />
        </button>
      </div>
      {onQuiz && (
        <button className="switch-player" onClick={onQuiz}>
          Try this as a quiz <ArrowRight size={14} />
        </button>
      )}
    </PlayerFrame>
  );
}
export function Quiz({
  set,
  onExit,
  onFinish,
}: {
  set: GeneratedSet;
  onExit: () => void;
  onFinish: (score: number, total: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(set.timePerQuestion ?? 30);
  const total = set.items.length;
  const item = set.items[index]?.question;
  const options = Array.isArray(item?.metadata?.options) ? item.metadata.options : [];
  const seconds = set.timePerQuestion ?? 30;

  useEffect(() => {
    setTimeLeft(seconds);
    setSelected(null);
    setRevealed(false);
    const timer = window.setInterval(() => setTimeLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [index, seconds]);

  useEffect(() => {
    if (timeLeft === 0 && !revealed) setRevealed(true);
  }, [timeLeft, revealed]);

  function choose(option: string) {
    if (revealed || !item) return;
    setSelected(option);
    setRevealed(true);
    if (option === item.answer) setScore((current) => current + 1);
  }

  function next() {
    if (index === total - 1) {
      onFinish(score, total);
      return;
    }
    setIndex((current) => current + 1);
  }

  return (
    <PlayerFrame count={`Question ${Math.min(index + 1, Math.max(total, 1))} of ${total}`} onExit={onExit}>
      <div className="quiz-meta">
        <span>{set.title}</span>
        <span>
          <Clock3 size={14} /> {timeLeft}s
        </span>
      </div>
      <p className="question-tag">Question {index + 1}</p>
      <h2 className="question">{item?.prompt}</h2>
      <div className="answers">
        {options.map((answer, optionIndex) => {
          const state = !revealed
            ? selected === answer ? "selected" : ""
            : answer === item?.answer ? "correct" : selected === answer ? "wrong" : "";
          return (
            <button className={state} key={answer} onClick={() => choose(answer)} disabled={revealed}>
              <span>{String.fromCharCode(65 + optionIndex)}</span>
              {answer}
            </button>
          );
        })}
      </div>
      {revealed && item?.explanation && <div className="quiz-explanation">{item.explanation}</div>}
      <div className="quiz-footer">
        <button className="skip" onClick={next}>Skip question</button>
        <button className="primary-button" onClick={next}>
          {index === total - 1 ? "Finish" : "Next"} <ArrowRight size={15} />
        </button>
      </div>
    </PlayerFrame>
  );
}
export function Results({
  set,
  score,
  total,
  onRetake,
  onBack,
}: {
  set: GeneratedSet;
  score: number;
  total: number;
  onRetake: () => void;
  onBack: () => void;
}) {
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const missed = Math.max(total - score, 0);
  const pass = percent >= 50;
  return (
    <PageFrame title="Quiz complete" subtitle={set.title} back="dashboard">
      <div className="results-hero">
        <div className="score-ring">
          <strong>{percent}%</strong>
        </div>
        <span>{pass ? "Strong pass" : "Keep practising"}</span>
        <small>
          {pass ? "Nice work. Review the ones you missed and go again." : "A few more rounds will get you there — check the questions you missed."}
        </small>
      </div>
      <div className="result-stats">
        <div>
          <strong>{score}</strong>
          <span>Correct</span>
        </div>
        <div>
          <strong className={missed ? "red" : ""}>{missed}</strong>
          <span>Missed</span>
        </div>
        <div>
          <strong>{set.timePerQuestion ?? 30}s</strong>
          <span>Per question</span>
        </div>
      </div>
      <div className="result-actions">
        <button className="secondary-button" onClick={onRetake}>
          Retake quiz
        </button>
        <button className="primary-button" onClick={onBack}>
          Back to dashboard
        </button>
      </div>
    </PageFrame>
  );
}
