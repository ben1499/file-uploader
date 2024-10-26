const express = require("express");
const router = express.Router();
const driveController = require("../controllers/driveController");

router.get("/", (req, res) => res.render("index"));

router.get("/drive", driveController.driveGet);

module.exports = router;
