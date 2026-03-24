type PrismaError = { code?: string; message?: string };
type ErrorResult = { message: string; status: number };

export function getErrorResponse(e: unknown, fallback = 'Đã xảy ra lỗi'): ErrorResult {
  const prisma = e as PrismaError;
  if (prisma?.code) {
    switch (prisma.code) {
      case 'P2002':
        return { message: 'Dữ liệu trùng (unique). Vui lòng kiểm tra mã hoặc trường duy nhất.', status: 400 };
      case 'P2003':
        return { message: 'Ràng buộc khóa ngoại: tham chiếu không hợp lệ hoặc bản ghi liên quan không tồn tại.', status: 400 };
      case 'P2025':
        return { message: 'Không tìm thấy bản ghi.', status: 404 };
      default:
        break;
    }
    if (prisma.message && typeof prisma.message === 'string') {
      return { message: prisma.message, status: 400 };
    }
  }
  if (e instanceof Error && e.message) {
    return { message: e.message, status: 500 };
  }
  return { message: fallback, status: 500 };
}
