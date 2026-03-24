ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_class_no_time_overlap;

DROP TRIGGER IF EXISTS sessions_class_no_overlap_trigger ON sessions;
DROP FUNCTION IF EXISTS sessions_class_no_overlap_check();

CREATE OR REPLACE FUNCTION sessions_class_no_overlap_check()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.class_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.class_id = NEW.class_id
      AND s.id IS DISTINCT FROM NEW.id
      AND s.start_at < NEW.end_at
      AND s.end_at > NEW.start_at
  ) THEN
    RAISE EXCEPTION 'Lớp này đã được gán cho ca thi có khung giờ trùng hoặc giao nhau. Một lớp không thể tham gia hai ca thi trùng/giao giờ.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_class_no_overlap_trigger
  BEFORE INSERT OR UPDATE OF class_id, start_at, end_at ON sessions
  FOR EACH ROW EXECUTE PROCEDURE sessions_class_no_overlap_check();
