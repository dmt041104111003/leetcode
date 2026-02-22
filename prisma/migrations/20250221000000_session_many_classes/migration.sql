-- CreateTable session_classes (1 ca thi - nhiều lớp)
CREATE TABLE "session_classes" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_classes_pkey" PRIMARY KEY ("id")
);

-- Migrate: copy từ sessions.class_id sang session_classes
INSERT INTO "session_classes" ("session_id", "class_id")
SELECT id, class_id FROM sessions WHERE class_id IS NOT NULL;

-- Drop class_id từ sessions
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_class_id_fkey";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "class_id";

-- Unique và foreign key cho session_classes
CREATE UNIQUE INDEX "session_classes_session_id_class_id_key" ON "session_classes"("session_id", "class_id");
ALTER TABLE "session_classes" ADD CONSTRAINT "session_classes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_classes" ADD CONSTRAINT "session_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
