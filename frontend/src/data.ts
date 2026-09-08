import type { Course, Paper } from "./types";

export const courses: Course[] = [
  {
    code: "CPT 412",
    title: "Human computer interaction",
    papers: 14,
    tone: "blue",
  },
  { code: "CPT 414", title: "Data management II", papers: 9, tone: "mint" },
  { code: "CPT 408", title: "Software engineering", papers: 0, tone: "gold" },
];

export const papers: Paper[] = [
  {
    id: "paper-1",
    title: "2023/2024 · First semester",
    detail: "Private upload · PDF · 2.4 MB",
    status: "Private",
  },
  {
    id: "paper-2",
    title: "2022/2023 · Second semester",
    detail: "Shared repository · Approved",
    status: "Approved",
  },
  {
    id: "paper-3",
    title: "2021/2022 · First semester",
    detail: "Shared repository · Approved",
    status: "Approved",
  },
];

export const questions = [
  {
    question:
      "What is the difference between usability and accessibility in HCI design?",
    answer:
      "Usability measures how effectively and efficiently people can use a product. Accessibility makes sure people with a wide range of abilities can use it too.",
  },
  {
    question:
      "Which usability heuristic is violated when a system gives no feedback after a user submits a form?",
    answer:
      "Visibility of system status. Users should be kept informed about what is going on through appropriate feedback within a reasonable time.",
  },
  {
    question: "What distinguishes formative from summative usability testing?",
    answer:
      "Formative testing happens during design to discover and fix problems; summative testing measures the finished experience against defined targets.",
  },
];
