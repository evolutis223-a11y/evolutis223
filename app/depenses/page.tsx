import { redirect } from "next/navigation";

// Dépenses a fusionné dans Trésorerie (2026-08-08, décision utilisateur) — redirection pour ne
// pas casser d'éventuels liens/marque-pages existants.
export default function DepensesPage() {
  redirect("/tresorerie");
}
