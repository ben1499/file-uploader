const asyncHandler = require("express-async-handler");
const passport = require("passport");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require("express-validator");

const prisma = new PrismaClient();

exports.signupGet = (req, res, next) => {
    if (!req.user) {
        res.render("signup", { user: null, errors: null });
    } else {
        res.redirect("/");
    }
}

let isLoginRedirect = false;

exports.loginGet = (req, res, next) => {
    if (!req.user) {
        if (isLoginRedirect) {
            res.render("login", { error: req.session.messages ? req.session.messages[0] : null });
            isLoginRedirect = false;
        } else {
            res.render("login", { error: null });
        }
    } else {
        res.redirect("/");
    }
}

exports.signupPost = [
    body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required"),
    body("password")
    .trim()
    .isLength({ min: 5 })
    .escape()
    .withMessage("Password must have minimum 5 characters"),
    body("confirm_password")
    .custom((value, { req }) => {
      return value === req.body.password
    })
    .withMessage("Passwords do not match"),

    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            const user = {
                email: req.body.email
            };
            res.render("signup", {
                user: user,
                errors: errors.array()
            })
        } else {
            bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {    
                try {
                    const user = await prisma.user.create({
                        data: {
                            email: req.body.email,
                            password: hashedPassword
                        }
                    })
                    res.redirect("/user/login");
                } catch(err) {
                    // Error code for failed unique constraint
                    if (err.code === 'P2002') 
                        res.render("signup", { user: null, errors: [{ msg: "Email address taken. Try another email address" }]} );
                    else 
                        res.render("signup", { user: null, errors: [{ msg: "Something went wrong" }] } );
                }
            })
        }
    })
]

exports.loginPost = [
    (req, res, next) => {
        req.session.messages = [];
        isLoginRedirect = true;
        next();
    },
    passport.authenticate("local", {
        successRedirect: "/",
        failureRedirect: "/user/login",
        failureMessage: true,
    })
]

exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect("/");
    })
}