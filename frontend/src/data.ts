import type { Course, Paper } from "./types";

export const courses: Course[] = [];

export const papers: Paper[] = [];

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
