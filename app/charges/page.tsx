import { redirect } from "next/navigation";

// "Charges" et "Dépenses" ont fusionné dans Trésorerie (2026-08-08, décision utilisateur).
export default function ChargesPage() {
  redirect("/tresorerie");
}
