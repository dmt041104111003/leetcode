const RANDOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(prefix: string, length = 6): string {
  let s = prefix + '-';
  for (let i = 0; i < length; i++) {
    s += RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)];
  }
  return s;
}

export function randomSessionCode(): string {
  return randomCode('CA');
}

export function randomClassCode(): string {
  return randomCode('LOP');
}

export function randomExamCode(): string {
  return randomCode('DE');
}
