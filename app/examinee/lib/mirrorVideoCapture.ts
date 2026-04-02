/** Vẽ frame video lên canvas lật ngang giống preview `transform: scaleX(-1)` để ảnh gửi server trùng hướng với thí sinh nhìn. */
export function drawVideoMirroredLikePreview(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();
}
