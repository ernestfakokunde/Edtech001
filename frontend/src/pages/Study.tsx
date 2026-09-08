import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  FlipHorizontal2,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { courses, papers, questions } from "../data";
import { go, PageFrame } from "../components/Layout";
import type { Course, Mode, Paper } from "../types";

export function PersonalPractice() {
  const [fileName, setFileName] = useState("");
  return (
    <PageFrame
      title="Practise from your own PDF"
      subtitle="Your upload stays private to your workspace."
      back="home"
    >
      <label className="personal-drop">
        <Upload size={22} />
        <strong>{fileName || "Choose a PDF past paper"}</strong>
        <span>
          {fileName ? "Ready for AI generation" : "PDF files up to 20 MB"}
        </span>
        <input
          type="file"
          accept="application/pdf"
          onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
        />
      </label>
      {fileName && (
        <div className="upload-notice">
          <Check size={16} /> Private upload ready. Choose what you want to
          create below.
        </div>
      )}
      <div className="personal-next">
        <Sparkles size={18} />
        <div>
          <strong>What happens next?</strong>
          <span>
            AI will extract the questions, then you choose flashcards or a quiz.
          </span>
        </div>
      </div>
      <button
        className="primary-button full"
        disabled={!fileName}
        onClick={() => go("generate")}
      >
        Continue to generation <ArrowRight size={16} />
      </button>
    </PageFrame>
  );
}

export function Hierarchy({
  onCourse,
}: {
  onCourse: (course: Course) => void;
}) {
  return (
    <PageFrame
      title="Find your course"
      subtitle="Choose where your paper belongs, or add the missing level."
      back="home"
    >
      <div className="field">
        <label>Institution</label>
        <select defaultValue="FUT Minna">
          <option>Federal University of Technology, Minna</option>
          <option>Add an institution</option>
        </select>
      </div>
      <div className="field">
        <label>Faculty</label>
        <select defaultValue="Computing">
          <option>Computing</option>
          <option>Add a faculty</option>
        </select>
      </div>
      <div className="field">
        <label>Department</label>
        <select defaultValue="Cyber Security">
          <option>Cyber Security</option>
          <option>Computer Science</option>
          <option>Information Technology</option>
          <option>Add a department</option>
        </select>
      </div>
      <div className="field">
        <label>Course</label>
        <div className="search-field">
          <Search size={16} />
          <input placeholder="Search course code or title" />
        </div>
        <div className="option-list">
          {courses.map((course) => (
            <button
              className="course-option"
              key={course.code}
              onClick={() => onCourse(course)}
            >
              <strong>{course.code}</strong>
              <span>{course.title}</span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
        <button className="dashed-button">
          <Plus size={16} /> Add a course not listed here
        </button>
      </div>
    </PageFrame>
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
      subtitle="12 courses in this department"
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
        {visible.map((course) => (
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
        ))}
      </div>
    </PageFrame>
  );
}

export function CoursePage({
  course,
  uploaded,
  onUpload,
  onGenerate,
}: {
  course: Course;
  uploaded: boolean;
  onUpload: () => void;
  onGenerate: (paper: Paper) => void;
}) {
  const list = uploaded
    ? [
        papers[0],
        {
          id: "new",
          title: "2024/2025 · First semester",
          detail: "Private upload · PDF · Ready to use",
          status: "Private",
        },
        ...papers.slice(1),
      ]
    : papers;
  return (
    <PageFrame
      eyebrow="Cyber Security / Course workspace"
      title={course.title}
      subtitle={`${course.papers} papers in the shared repository · ${uploaded ? 4 : 3} uploaded by you`}
      back="courses"
    >
      <div className="tabs">
        <button className="active">Repository & uploads</button>
        <button>My generated sets</button>
      </div>
      <label className="upload-zone">
        <Upload size={17} />
        <span>Upload a past paper for this course</span>
        <input type="file" accept="application/pdf" onChange={onUpload} />
      </label>
      {uploaded && (
        <div className="upload-notice">
          <Check size={16} /> New paper added privately.
        </div>
      )}
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
              <button
                className="outline-button"
                onClick={() => onGenerate(paper)}
              >
                Generate
              </button>
              {paper.status === "Private" ? (
                <button className="ghost-button">
                  <Send size={14} /> Submit
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
  onExit,
  onQuiz,
}: {
  onExit: () => void;
  onQuiz: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = questions[index];
  return (
    <PlayerFrame count={`Card ${index + 1} of 30`} onExit={onExit}>
      <button className="flashcard" onClick={() => setFlipped(!flipped)}>
        <span className="card-tag">{flipped ? "Answer" : "Question"}</span>
        <strong>{flipped ? card.answer : card.question}</strong>
        <small>
          <RotateCcw size={14} /> Tap to{" "}
          {flipped ? "see question" : "reveal answer"}
        </small>
      </button>
      <div className="player-actions">
        <button
          className="icon-button"
          disabled={index === 0}
          onClick={() => {
            setIndex(index - 1);
            setFlipped(false);
          }}
        >
          <ArrowLeft size={17} />
        </button>
        <button
          className="secondary-button"
          onClick={() => setFlipped(!flipped)}
        >
          <FlipHorizontal2 size={15} /> Flip card
        </button>
        <button
          className="icon-button"
          onClick={() => {
            setIndex((index + 1) % questions.length);
            setFlipped(false);
          }}
        >
          <ArrowRight size={17} />
        </button>
      </div>
      <button className="switch-player" onClick={onQuiz}>
        Try this as a quiz <ArrowRight size={14} />
      </button>
    </PlayerFrame>
  );
}
export function Quiz({
  onExit,
  onFinish,
}: {
  onExit: () => void;
  onFinish: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <PlayerFrame count="Question 7 of 30" onExit={onExit}>
      <div className="quiz-meta">
        <span>CPT 412 · Human computer interaction</span>
        <span>
          <Clock3 size={14} /> 14:22
        </span>
      </div>
      <p className="question-tag">Question 7</p>
      <h2 className="question">
        Which usability heuristic is violated when a system gives no feedback
        after a user submits a form?
      </h2>
      <div className="answers">
        {[
          "Consistency and standards",
          "Visibility of system status",
          "Error prevention",
          "Recognition over recall",
        ].map((answer, index) => (
          <button
            className={selected === answer ? "selected" : ""}
            key={answer}
            onClick={() => setSelected(answer)}
          >
            <span>{String.fromCharCode(65 + index)}</span>
            {answer}
          </button>
        ))}
      </div>
      <div className="quiz-footer">
        <button className="skip">Skip question</button>
        <button className="primary-button" onClick={onFinish}>
          Next <ArrowRight size={15} />
        </button>
      </div>
    </PlayerFrame>
  );
}
export function Results({
  course,
  onRetake,
  onBack,
}: {
  course: Course;
  onRetake: () => void;
  onBack: () => void;
}) {
  return (
    <PageFrame
      title="Quiz complete"
      subtitle={`${course.code} · ${course.title}`}
      back="course"
    >
      <div className="results-hero">
        <div className="score-ring">
          <strong>80%</strong>
        </div>
        <span>Strong pass</span>
        <small>
          Nice work. Your weakest areas are ready for another round.
        </small>
      </div>
      <div className="result-stats">
        <div>
          <strong>24</strong>
          <span>Correct</span>
        </div>
        <div>
          <strong className="red">6</strong>
          <span>Missed</span>
        </div>
        <div>
          <strong>14:22</strong>
          <span>Time taken</span>
        </div>
      </div>
      <label>Review missed questions</label>
      <div className="review-list">
        <div>
          <X size={13} /> Which usability heuristic is violated when a system
          gives no feedback...
        </div>
        <div>
          <X size={13} /> What distinguishes formative from summative usability
          testing?
        </div>
      </div>
      <div className="result-actions">
        <button className="secondary-button" onClick={onRetake}>
          Retake quiz
        </button>
        <button className="primary-button" onClick={onBack}>
          Back to course
        </button>
      </div>
    </PageFrame>
  );
}
