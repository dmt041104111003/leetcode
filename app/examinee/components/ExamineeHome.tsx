'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ExamineeInfo, SessionInfo, SessionStatus } from '../interfaces/session';
import ExamineeLoginForm from './ExamineeLoginForm';
import SessionCodePanel from './SessionCodePanel';

type ExamineeHomeProps = {
  examinee: ExamineeInfo | null;
};

export default function ExamineeHome({ examinee }: ExamineeHomeProps) {
  const router = useRouter();
  const [mssv, setMssv] = useState('');
  const [fullName, setFullName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/examinee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mssv: mssv.trim(), fullName: fullName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Đăng nhập thất bại');
        return;
      }
      router.refresh();
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await fetch('/api/auth/examinee/logout', { method: 'POST' });
      router.refresh();
      setSession(null);
      setStatus(null);
      setSessionCode('');
    } catch {
      setError('Lỗi đăng xuất');
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleSessionCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = sessionCode.trim();
    if (!code) {
      setError('Vui lòng nhập mã ca thi');
      return;
    }
    setError('');
    setSession(null);
    setStatus(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/session-by-code?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Mã ca thi không tồn tại');
        return;
      }
      setSession(data.session);
      setStatus(data.status);
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!session?.code) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/examinee/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: session.code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Không thể vào ca thi');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        setError('Vui lòng bật quyền camera để giám sát khi làm bài.');
        setLoading(false);
        return;
      }
      router.push('/examinee/exam');
      router.refresh();
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  if (!examinee) {
    return (
      <ExamineeLoginForm
        mssv={mssv}
        fullName={fullName}
        loading={loading}
        error={error}
        onMssvChange={setMssv}
        onFullNameChange={setFullName}
        onErrorClear={() => setError('')}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <SessionCodePanel
      examinee={examinee}
      sessionCode={sessionCode}
      session={session}
      status={status}
      loading={loading}
      logoutLoading={logoutLoading}
      error={error}
      onSessionCodeChange={(v) => {
        setSessionCode(v);
        setError('');
        setSession(null);
        setStatus(null);
      }}
      onSessionSubmit={handleSessionCode}
      onLogout={handleLogout}
      onStart={handleStart}
    />
  );
}
