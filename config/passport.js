import "dotenv/config";
import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import prisma from "../db.js";

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

const strategy = new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: jwtPayload.id },
    });
    return done(null, user || false);
  } catch (error) {
    return done(error, false);
  }
});

passport.use(strategy);

export default passport;