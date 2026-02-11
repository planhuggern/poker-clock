import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";

function normalizeBasePath(value) {
  if (!value) return "";
  let base = String(value).trim();
  if (!base) return "";
  if (!base.startsWith("/")) base = `/${base}`;
  if (base.length > 1 && base.endsWith("/")) base = base.slice(0, -1);
  return base;
}

export function setupPassport(app, config) {
  const basePath = normalizeBasePath(process.env.BASE_PATH ?? config.basePath);
  const configured = config.google?.callbackURL;
  let callbackURL = configured;

  // Hvis man bruker path-basert routing (f.eks. /poker-clock) men callbackURL mangler basePath,
  // så legg den til automatisk.
  if (callbackURL && basePath) {
    try {
      const u = new URL(callbackURL);
      if (!u.pathname.startsWith(`${basePath}/`)) {
        u.pathname = `${basePath}${u.pathname.startsWith("/") ? "" : "/"}${u.pathname}`;
        callbackURL = u.toString();
      }
    } catch {
      // ignore; keep configured value
    }
  }

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  passport.use(new GoogleStrategy(
    {
      clientID: config.google.clientID,
      clientSecret: config.google.clientSecret,
      callbackURL
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails?.[0]?.value ?? null;
      return done(null, {
        provider: "google",
        email,
        name: profile.displayName ?? email ?? "Unknown"
      });
    }
  ));

  app.use(passport.initialize());
  // ❌ IKKE app.use(passport.session());

  return passport;
}

