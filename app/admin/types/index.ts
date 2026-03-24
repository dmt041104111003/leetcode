export type Session = {
  id: number;
  code: string;
  name: string;
  startAt: string;
  endAt: string;
  examId: number | null;
  createdAt: string;
  exam?: Exam | null;
  classes?: Class[];
};

export type Class = {
  id: number;
  code: string;
  name: string;
  createdAt: string;
  _count?: { examinees: number };
};

export type ClassExaminee = {
  id: number;
  classId: number;
  examineeId: number;
  examinee?: Examinee;
};

export type Examinee = {
  id: number;
  mssv: string;
  fullName: string | null;
  createdAt: string;
};

export type Problem = {
  id: number;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  constraints: string | null;
  examples: Array<{ input?: string; output?: string; explanation?: string | null }> | null;
  starterCode: Record<string, string> | null;
  timeLimitMs: number | null;
  memoryLimitMb: number | null;
  sortOrder: number;
  createdAt: string;
};

export type TestCase = {
  id: number;
  problemId: number;
  input: string;
  expectedOutput: string;
  isSample: boolean;
  sortOrder: number;
};

export type Exam = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  createdAt: string;
};

export type ExamQuestion = {
  id: number;
  examId: number;
  problemId: number;
  sortOrder: number;
  points: number | null;
  problem?: Problem;
};
