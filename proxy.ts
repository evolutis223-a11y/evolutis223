import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/boutique", "/suivi", "/maquette", "/configurateur", "/site"];

// Verrou d'accès public — demandé par l'utilisateur (2026-08-02) : à la mise en ligne, les
// parcours publics (boutique, maquette, configurateur, suivi, site) ne doivent pas être visibles du
// grand public tant que tout n'est pas ajusté (images, contenus). Basculer
// SITE_OUVERT_AU_PUBLIC=true dans les variables d'environnement Vercel quand on est prêt à
// ouvrir — aucun changement de code nécessaire. Le back-office reste protégé par la session
// normale ci-dessous, indépendamment de ce verrou.
const CHEMINS_GRAND_PUBLIC = ["/boutique", "/maquette", "/configurateur", "/suivi", "/site"];
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

  // Mot de passe garanti par le code (2026-08-09) : ne dépend d'aucune variable Vercel à
  // configurer correctement (case à cocher "Production", redéploiement...). Reste valable même
  // si SITE_MOT_DE_PASSE_APERCU n'est pas défini ou mal renseigné sur Vercel.
  const MOT_DE_PASSE_GARANTI = "evolutis223";
  const motDePasseEnv = process.env.SITE_MOT_DE_PASSE_APERCU;
  const motsDePasseValides = [MOT_DE_PASSE_GARANTI, ...(motDePasseEnv ? [motDePasseEnv] : [])];

  const codeFourni = searchParams.get("apercu");
  const cookieApercu = request.cookies.get(COOKIE_APERCU)?.value;
  const dejaDeverrouille = cookieApercu != null && motsDePasseValides.includes(cookieApercu);

  if ((codeFourni != null && motsDePasseValides.includes(codeFourni)) || dejaDeverrouille) {
    const response = NextResponse.next();
    if (codeFourni != null && motsDePasseValides.includes(codeFourni)) {
      response.cookies.set(COOKIE_APERCU, codeFourni, {
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
  const { pathname, searchParams } = request.nextUrl;

  const reponseVerrou = await verifierVerrouPublic(request);
  if (reponseVerrou) return reponseVerrou;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Lien de parrainage (§ 2026-08-12) : un visiteur sans session mais avec un ?ref= valide accède
  // à "Nos produits" sans se connecter — la page elle-même vérifie le code et affiche un message
  // clair si le lien est invalide/désactivé (pas de redirection vers /login, déroutant pour un
  // client externe).
  if (pathname.startsWith("/nos-produits") && searchParams.get("ref")) {
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
