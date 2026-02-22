'use client';

import type { ExamineeInfo, SessionInfo, SessionStatus } from '../interfaces/session';
import { formatDateTime } from '../lib/time';

type Props = {
  examinee: ExamineeInfo;
  sessionCode: string;
  session: SessionInfo | null;
  status: SessionStatus | null;
  loading: boolean;
  logoutLoading: boolean;
  error: string;
  onSessionCodeChange: (v: string) => void;
  onSessionSubmit: (e: React.FormEvent) => void;
  onLogout: () => void;
  onStart: () => void;
};

export default function SessionCodePanel(p: Props) {
  const { examinee, sessionCode, session, status, loading, logoutLoading, error, onSessionCodeChange, onSessionSubmit, onLogout, onStart } = p;
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Vào ca thi</h1>
            <p className="text-sm text-gray-600 mt-0.5">Xin chào, <strong>{examinee.fullName}</strong> ({examinee.mssv})</p>
          </div>
          <button type="button" onClick={onLogout} disabled={logoutLoading} className="text-sm text-gray-500 hover:text-red-600 disabled:opacity-50">{logoutLoading ? 'Đang đăng xuất...' : 'Đăng xuất'}</button>
        </div>
        <form onSubmit={onSessionSubmit} className="space-y-4">
          <div>
            <label htmlFor="sessionCode" className="block text-sm font-medium text-gray-700 mb-1">Mã ca thi</label>
            <input id="sessionCode" type="text" value={sessionCode} onChange={(e) => onSessionCodeChange(e.target.value)} placeholder="Nhập mã ca thi" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" disabled={loading} />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2 px-4 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">{loading ? 'Đang kiểm tra...' : 'Vào thi'}</button>
        </form>
        {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
        {session && status && (
          <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <p className="font-semibold text-gray-800">{session.name}</p>
            <p className="text-sm text-gray-500 mt-1">Bắt đầu: {formatDateTime(session.startAt)} — Kết thúc: {formatDateTime(session.endAt)}</p>
            <div className="mt-4">
              {status === 'upcoming' && <p className="text-amber-700 text-sm font-medium py-2 text-center rounded-lg bg-amber-50">Vui lòng chờ kỳ thi bắt đầu.</p>}
              {status === 'active' && <button type="button" onClick={onStart} disabled={loading} className="w-full py-2 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">{loading ? 'Đang vào ca thi...' : 'Bắt đầu'}</button>}
              {status === 'ended' && <p className="text-red-600 font-medium py-2 text-center rounded-lg bg-red-50">Kỳ thi đã kết thúc.</p>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
