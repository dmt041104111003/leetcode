export type SessionStatus = 'upcoming' | 'active' | 'ended';

export type SessionInfo = {
  id: number;
  code: string;
  name: string;
  startAt: string;
  endAt: string;
};

export type ExamineeInfo = {
  fullName: string;
  mssv: string;
};
