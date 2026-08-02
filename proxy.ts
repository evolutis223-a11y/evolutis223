import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/boutique", "/suivi", "/maquette", "/configurateur"];

// Verrou d'accès public — demandé par l'utilisateur (2026-08-02) : à la mise en ligne, les
// parcours publics (boutique, maquette, configurateur, suivi) ne doivent pas être visibles du
// grand public tant que tout n'est pas ajusté (images, contenus). Basculer
// SITE_OUVERT_AU_PUBLIC=true dans les variables d'environnement Vercel quand on est prêt à
// ouvrir — aucun changement de code nécessaire. Le back-office reste protégé par la session
// normale ci-dessous, indépendamment de ce verrou.
const CHEMINS_GRAND_PUBLIC = ["/boutique", "/maquette", "/configurateur", "/suivi"];
const COOKIE_APERCU = "evolutis223_apercu";

async function verifierVerrouPublic(request: NextRequest): Promise<NextResponse | null> {
  const { pathname, searchParams } = request.nextUrl;
  const estGrandPublic = CHEMINS_GRAND_PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!estGrandPublic) return null;
  if (process.env.SITE_OUVERT_AU_PUBLIC === "true") return null;

  // Le propriétaire/personnel connecté (session valide) voit toujours tout, verrou ou pas — le
  // verrou vise les visiteurs anonymes, jamais quelqu'un qui a déjà un compte (2026-08-02).
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token && (await verifySessionToken(token))) return null;

  const motDePasse = process.env.SITE_MOT_DE_PASSE_APERCU;
  if (!motDePasse) return null; // pas configuré (ex. dev local) = pas de verrou

  const codeFourni = searchParams.get("apercu");
  const dejaDeverrouille = request.cookies.get(COOKIE_APERCU)?.value === motDePasse;

  if (codeFourni === motDePasse || dejaDeverrouille) {
    const response = NextResponse.next();
    if (codeFourni === motDePasse) {
      response.cookies.set(COOKIE_APERCU, motDePasse, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }
    return response;
  }

  return new NextResponse(
    `<!doctype html><html lang="fr"><meta charset="utf-8"><body style="font-family:system-ui,sans-serif;display:flex;height:100vh;align-items:center;justify-content:center;text-align:center;padding:2rem;margin:0"><div><h1>Bientôt disponible</h1><p>Ce site est en préparation.</p></div></body></html>`,
    { status: 503, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const reponseVerrou = await verifierVerrouPublic(request);
  if (reponseVerrou) return reponseVerrou;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
