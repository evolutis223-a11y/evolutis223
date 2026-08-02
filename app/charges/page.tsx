import { redirect } from "next/navigation";

// "Dépenses" et "Charges" (§7) pointent sur le même écran — voir CAHIER_DES_CHARGES.md §7 et
// app/depenses/actions.ts pour la justification (même catégorie de décaissement sous-jacente,
// pas de différence suffisamment spécifiée pour justifier deux écrans séparés).
export default function ChargesPage() {
  redirect("/depenses");
}
