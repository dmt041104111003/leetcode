'use client';

type Props = {
  mssv: string;
  fullName: string;
  loading: boolean;
  error: string;
  onMssvChange: (v: string) => void;
  onFullNameChange: (v: string) => void;
  onErrorClear: () => void;
  onSubmit: (e: React.FormEvent) => void;
};

export default function ExamineeLoginForm(props: Props) {
  const { mssv, fullName, loading, error, onMssvChange, onFullNameChange, onErrorClear, onSubmit } = props;
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">Đăng nhập thí sinh</h1>
        <p className="text-center text-gray-600 text-sm mb-6">Nhập mã sinh viên và họ tên để đăng nhập</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="mssv" className="block text-sm font-medium text-gray-700 mb-1">Mã sinh viên</label>
            <input id="mssv" type="text" value={mssv} onChange={(e) => { onMssvChange(e.target.value); onErrorClear(); }} placeholder="Nhập mã sinh viên" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" required disabled={loading} />
          </div>
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Họ tên</label>
            <input id="fullName" type="text" value={fullName} onChange={(e) => { onFullNameChange(e.target.value); onErrorClear(); }} placeholder="Nhập họ tên" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" required disabled={loading} />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={loading} className="w-full py-2 px-4 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
        </form>
      </div>
    </main>
  );
}
