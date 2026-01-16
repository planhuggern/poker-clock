import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";

export function setupPassport(app, config) {
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  passport.use(new GoogleStrategy(
    {
      clientID: config.google.clientID,
      clientSecret: config.google.clientSecret,
      callbackURL: config.google.callbackURL
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

