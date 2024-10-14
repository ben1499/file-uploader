const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

router.get("/signup", userController.signupGet);

router.get("/login", userController.loginGet);

router.post("/signup", userController.signupPost);

router.post("/login", userController.loginPost);

router.get("/logout", userController.logout);


module.exports = router;
