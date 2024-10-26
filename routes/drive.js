const express = require("express");
const driveController = require("../controllers/driveController");

const router = express.Router();

router.get("/", driveController.driveGet);

router.get("/:folderId", driveController.driveGet);

router.post("/file", driveController.filePost);
router.post("/file/:folderId", driveController.filePost);

router.post("/folder", driveController.folderPost);
router.post("/folder/:folderId", driveController.folderPost);

router.post("/folder/:folderId/delete", driveController.deleteFolder);

router.post("/file/:fileId/delete", driveController.deleteFile);

router.get("/back/:folderId", driveController.goBack);

module.exports = router;
