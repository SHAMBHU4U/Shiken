export const AVATARS = [
  { id: "student_m",  emoji: "👦", label: "Student Boy" },
  { id: "student_f",  emoji: "👧", label: "Student Girl" },
  { id: "grad_m",     emoji: "🧑‍🎓", label: "Graduate" },
  { id: "grad_f",     emoji: "👩‍🎓", label: "Scholar Girl" },
  { id: "scientist",  emoji: "🧑‍🔬", label: "Scientist" },
  { id: "teacher",    emoji: "🧑‍🏫", label: "Teacher" },
  { id: "doctor",     emoji: "🧑‍⚕️", label: "Doctor" },
  { id: "engineer",   emoji: "👷", label: "Engineer" },
  { id: "astronaut",  emoji: "🧑‍🚀", label: "Astronaut" },
  { id: "artist",     emoji: "🧑‍🎨", label: "Artist" },
  { id: "champion",   emoji: "🏆", label: "Champion" },
  { id: "ninja",      emoji: "🥷", label: "Topper" },
] as const;

export type AvatarId = typeof AVATARS[number]["id"];

export function getAvatarEmoji(id: string | null | undefined): string {
  return AVATARS.find(a => a.id === id)?.emoji ?? "🧑‍🎓";
}
