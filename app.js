const express = require("express");
const path = require("node:path");
const session = require('express-session');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
const { PrismaClient } = require('@prisma/client');
const passport = require("passport");
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require("bcryptjs");

const indexRouter = require("./routes/index");
const userRouter = require("./routes/user");
const driveRouter = require("./routes/drive");

const app = express();

const prisma = new PrismaClient();

app.use(express.urlencoded({ extended: true }));

app.use(
    session({
      cookie: {
       maxAge: 7 * 24 * 60 * 60 * 1000 // ms
      },
      secret: process.env.SECRET_KEY,
      resave: true,
      saveUninitialized: true,
      store: new PrismaSessionStore(
        new PrismaClient(),
        {
          checkPeriod: 2 * 60 * 1000,  //ms
          dbRecordIdIsSessionId: true,
          dbRecordIdFunction: undefined,
        }
      )
    })
);

app.use(passport.session());

passport.use(
  new LocalStrategy({ usernameField: "email" }, async (username, password, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: {
          email: username
        }
      });

      if (!user) {
        return done(null, false, { message: "Incorrect email" });
      }
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return done(null, false, { message: "Incorrect password" });
      }
      return done(null, user);
    } catch(err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: id
      }
    });
    done(null, user);
  } catch(err) {
    done(err);
  }
});


app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

app.use("/", indexRouter);
app.use("/user", userRouter);
app.use("/drive", driveRouter);

const PORT = 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}!`));
