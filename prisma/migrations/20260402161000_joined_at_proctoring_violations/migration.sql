-- Thí sinh "tham gia thi" khi đã đăng nhập mã ca (joined_at).
ALTER TABLE "session_examinees" ADD COLUMN IF NOT EXISTS "joined_at" TIMESTAMP(3);

-- Lưu từng lần vi phạm giám sát.
CREATE TABLE IF NOT EXISTS "proctoring_violations" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "exam_id" INTEGER,
    "examinee_id" INTEGER NOT NULL,
    "violation_type" TEXT NOT NULL,
    "message" TEXT,
    "faces_count" INTEGER,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proctoring_violations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "proctoring_violations_session_id_examinee_id_idx" ON "proctoring_violations"("session_id", "examinee_id");

ALTER TABLE "proctoring_violations" DROP CONSTRAINT IF EXISTS "proctoring_violations_session_id_fkey";
ALTER TABLE "proctoring_violations" ADD CONSTRAINT "proctoring_violations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "proctoring_violations" DROP CONSTRAINT IF EXISTS "proctoring_violations_examinee_id_fkey";
ALTER TABLE "proctoring_violations" ADD CONSTRAINT "proctoring_violations_examinee_id_fkey" FOREIGN KEY ("examinee_id") REFERENCES "examinees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "proctoring_violations" DROP CONSTRAINT IF EXISTS "proctoring_violations_exam_id_fkey";
ALTER TABLE "proctoring_violations" ADD CONSTRAINT "proctoring_violations_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
