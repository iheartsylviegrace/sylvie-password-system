const passwords = [
  "OHTANI17",
  "ICHIRO51",
  "MATSUI55",
  "DARVISH11",
  "NOMO16",
  "SASAKI14",
  "TANAKA18",
  "YAMAMOTO18",
  "KURODA15",
  "MAEDA18"
];

export function getCurrentPassword() {
  const start = new Date("2026-01-05T00:00:00-08:00");
  const now = new Date();

  const weeks = Math.floor(
    (now - start) / (1000 * 60 * 60 * 24 * 7)
  );

  return passwords[weeks % passwords.length];
}