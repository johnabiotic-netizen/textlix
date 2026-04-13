const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

passport.use(
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user || !user.passwordHash) return done(null, false, { message: 'Invalid credentials' });
      if (user.isBanned) return done(null, false, { message: `Account banned: ${user.banReason}` });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return done(null, false, { message: 'Invalid credentials' });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

const handleOAuth = async (accessToken, refreshToken, profile, done, provider) => {
  try {
    const email =
      profile.emails && profile.emails[0] ? profile.emails[0].value.toLowerCase() : null;

    let user = await User.findOne({ provider, providerId: profile.id });
    if (user) return done(null, user);

    if (email) {
      user = await User.findOne({ email });
      if (user) {
        user.provider = provider;
        user.providerId = profile.id;
        if (!user.avatar && profile.photos && profile.photos[0]) {
          user.avatar = profile.photos[0].value;
        }
        await user.save();
        return done(null, user);
      }
    }

    user = await User.create({
      email: email || `${provider}_${profile.id}@oauth.local`,
      name: profile.displayName || profile.username || 'User',
      avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
      provider,
      providerId: profile.id,
      isEmailVerified: !!email,
    });
    return done(null, user);
  } catch (err) {
    return done(err);
  }
};

if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/v1/auth/google/callback',
      },
      (at, rt, profile, done) => handleOAuth(at, rt, profile, done, 'GOOGLE')
    )
  );
}

if (process.env.GITHUB_CLIENT_ID) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: '/api/v1/auth/github/callback',
        scope: ['user:email'],
      },
      (at, rt, profile, done) => handleOAuth(at, rt, profile, done, 'GITHUB')
    )
  );
}

module.exports = passport;
