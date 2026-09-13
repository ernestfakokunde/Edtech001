import { useEffect, useState } from "react";
import { BookOpen, Check, GraduationCap, Plus, Save, Trash2, UserRound } from "lucide-react";
import { PageFrame } from "../components/Layout";
import {
  addMyCourse, getCurrentProfile, getMyCourses, removeMyCourse, saveMySchool, updateProfile,
} from "../lib/api";
import type { MySchool, SavedCourse } from "../lib/api";

// Same per-student cap the backend enforces on POST /api/profile/courses.
const MAX_SAVED_COURSES = 10;

export function ProfilePage() {
  const [profile, setProfile] = useState({ displayName: "", username: "", email: "" });
  // The school is entered once here; Generate and the course picker read it
  // from the backend afterwards, so the hierarchy is never walked again.
  const [school, setSchool] = useState<MySchool>(null);
  const [schoolForm, setSchoolForm] = useState({ universityName: "", facultyName: "" });
  const [courses, setCourses] = useState<SavedCourse[]>([]);
  const [courseForm, setCourseForm] = useState({ code: "", title: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentProfile().then((result) => setProfile({ displayName: result.profile.displayName ?? "", username: result.profile.username ?? "", email: result.profile.email ?? "" })).catch(() => setError("Could not load your profile."));
    getMyCourses().then((result) => { setSchool(result.school); setSchoolForm(result.school ? { universityName: result.school.universityName, facultyName: result.school.facultyName } : { universityName: "", facultyName: "" }); setCourses(result.courses); }).catch(() => setError("Could not load your school details."));
  }, []);

  async function saveProfile() {
    setError(""); setMessage("");
    try { const result = await updateProfile({ displayName: profile.displayName, username: profile.username }); setProfile((current) => ({ ...current, displayName: result.profile.displayName ?? "", username: result.profile.username ?? "" })); setMessage("Profile saved."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your profile."); }
  }
  // Both names are resolve-or-create on the backend (by slug), so re-entering
  // the same university or faculty never duplicates rows.
  async function saveSchool() {
    setError(""); setMessage("");
    if (!schoolForm.universityName.trim() || !schoolForm.facultyName.trim()) { setError("Enter your university and faculty names."); return; }
    try {
      const result = await saveMySchool({ universityName: schoolForm.universityName.trim(), facultyName: schoolForm.facultyName.trim() });
      setSchool(result.school); setSchoolForm({ universityName: result.school.universityName, facultyName: result.school.facultyName });
      setMessage("School saved. Courses you add are filed under it automatically.");
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your school."); }
  }
  // Adding a course is just a code and a title — the backend files it under the
  // saved faculty's General department and links (never duplicates) by code.
  async function addCourse() {
    setError(""); setMessage("");
    if (!courseForm.code.trim() || !courseForm.title.trim()) { setError("Enter the course code and title."); return; }
    try {
      const result = await addMyCourse({ code: courseForm.code.trim(), title: courseForm.title.trim() });
      setCourses((current) => (current.some((item) => item.id === result.course.id) ? current : [...current, result.course]));
      setCourseForm({ code: "", title: "" });
      setMessage(`${result.course.code} added to your courses.`);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the course."); }
  }
  // Removing only unlinks the course from this profile; the shared Course
  // entity (with any papers or generated sets) stays in the repository.
  async function removeCourse(courseId: string) {
    setError(""); setMessage("");
    try { await removeMyCourse(courseId); setCourses((current) => current.filter((item) => item.id !== courseId)); setMessage("Course removed from your list."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove the course."); }
  }
  return <PageFrame title="Your profile" subtitle="Keep your identity, school, and saved courses ready for every study session." back="dashboard">
    <div className="profile-layout">
      <section className="profile-card profile-identity"><div className="profile-card-heading"><span className="profile-icon"><UserRound size={20} /></span><div><p className="eyebrow">Account</p><h2>Personal details</h2></div></div><label className="field"><span>Display name</span><input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} placeholder="How should we call you?" /></label><label className="field"><span>Username</span><input value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} placeholder="e.g. ernest_ade" /><small>3-24 lowercase letters, numbers, or underscores.</small></label><label className="field"><span>Email</span><input value={profile.email} disabled /></label><button className="primary-button" onClick={() => void saveProfile()}><Save size={16} /> Save profile</button></section>
      <section className="profile-card school-card"><div className="profile-card-heading"><span className="profile-icon blue"><GraduationCap size={20} /></span><div><p className="eyebrow">My school</p><h2>University & faculty</h2></div></div><p className="profile-help">Enter these once — every course you add afterwards is filed under them automatically, here and on the Generate screen.</p><label className="field"><span>University</span><input value={schoolForm.universityName} onChange={(event) => setSchoolForm({ ...schoolForm, universityName: event.target.value })} placeholder="e.g. University of Lagos" /></label><label className="field"><span>Faculty</span><input value={schoolForm.facultyName} onChange={(event) => setSchoolForm({ ...schoolForm, facultyName: event.target.value })} placeholder="e.g. Faculty of Science" /></label><button className="primary-button" onClick={() => void saveSchool()}><Save size={16} /> {school ? "Update school" : "Save school"}</button>{school && <small className="profile-saved-note"><Check size={13} /> Saved: {school.universityName} · {school.facultyName}</small>}</section>
      <section className="profile-card courses-card"><div className="profile-card-heading"><span className="profile-icon blue"><BookOpen size={20} /></span><div><p className="eyebrow">My courses</p><h2>Courses you generate against</h2></div></div><p className="profile-help">Up to {MAX_SAVED_COURSES} courses. They appear automatically when you generate quizzes or flashcards — just a code and a title, no hierarchy needed.</p><div className="course-form-grid two"><input value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value.toUpperCase() })} placeholder="Course code e.g. CSC 201" disabled={!school} /><input value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} placeholder="Course title e.g. Data Structures" disabled={!school} /></div><div className="profile-course-actions"><button className="secondary-button" disabled={!school || !courseForm.code.trim() || !courseForm.title.trim() || courses.length >= MAX_SAVED_COURSES} onClick={() => void addCourse()}><Plus size={15} /> Add course</button><span className="course-count">{courses.length} of {MAX_SAVED_COURSES}</span></div>{!school && <small className="profile-saved-note pending">Save your university and faculty above first.</small>}{courses.length > 0 && <ul className="my-course-list">{courses.map((course) => <li className="my-course-row" key={course.id}><div><strong>{course.code}</strong><span>{course.title}</span></div><button className="ghost-button danger" aria-label={`Remove ${course.code}`} onClick={() => void removeCourse(course.id)}><Trash2 size={14} /></button></li>)}</ul>}</section>
    </div>{message && <p className="profile-feedback success"><Check size={15} /> {message}</p>}{error && <p className="profile-feedback error">{error}</p>}
  </PageFrame>;
}


