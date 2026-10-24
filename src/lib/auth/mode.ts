export function chooseTableMode(input: { configured: boolean; demo: boolean }): "local" | "supabase" {
  if (input.configured && !input.demo) return "supabase";
  return "local";
}
