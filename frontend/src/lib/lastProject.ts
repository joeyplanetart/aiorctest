const KEY = "aiorctest_last_project";

export interface LastProject {
  id: string;
  name: string;
}

export function getLastProject(): LastProject | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setLastProject(id: string, name: string): void {
  localStorage.setItem(KEY, JSON.stringify({ id, name }));
}
