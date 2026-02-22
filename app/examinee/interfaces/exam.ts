export type TestCaseItem = {
  id: number;
  input: string;
  expectedOutput: string;
  isSample: boolean;
};

export type ExamQuestionItem = {
  id: number;
  sortOrder: number;
  points: number | null;
  title: string;
  slug: string;
  description: string;
  difficulty: string;
  constraints: string | null;
  examples: unknown;
  starterCode: unknown;
  testCases: TestCaseItem[];
};

export type ExamClientProps = {
  sessionName: string;
  sessionCode: string;
  endAt: string;
  examineeName: string;
  questions: ExamQuestionItem[];
};

export type ExampleItem = {
  input?: string;
  output?: string;
  explanation?: string | null;
};
