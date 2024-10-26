const multer = require("multer");
const { PrismaClient } = require('@prisma/client');
const asyncHandler = require("express-async-handler");
const { body, validationResult } = require("express-validator");
const cloudinary = require("cloudinary").v2;
const fs = require('fs').promises;

const prisma = new PrismaClient();

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    // Appending extension with original name
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

function formatFiles(files) {
  return files.map((file) => {
    return {
      ...file,
      size: `${(file.size / 1024).toFixed(2)} kb`,
      createdAt: Intl.DateTimeFormat("en-in", {dateStyle: "short", timeStyle: "short"}).format(file.createdAt),
      modifiedAt: Intl.DateTimeFormat("en-in", {dateStyle: "short", timeStyle: "short"}).format(file.modifiedAt),
      type: "file"
    }
  })
}

function formatFolders(folders) {
  return folders.map((folder) => {
    return {
      ...folder,
      createdAt: Intl.DateTimeFormat("en-in", {dateStyle: "short", timeStyle: "short"}).format(folder.createdAt),
      modifiedAt: Intl.DateTimeFormat("en-in", {dateStyle: "short", timeStyle: "short"}).format(folder.modifiedAt),
    }
  })
}

// Cloudinary config
cloudinary.config({
  cloud_name: "dfubtb083",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY
});

function uploadToCloudinary(image) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(image, (err, result) => {
      if (err) return reject(err);
      return resolve(result);
    })
  });
}

function removeFromCloudinary(public_id) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(public_id, (result) => {
      resolve(result);
    })
  })
}

exports.driveGet = async (req, res, next) => {
  if (req.params.folderId) {
    const folder = await prisma.folder.findUnique({
      where: {
        id: Number(req.params.folderId),
        userId: req.user.id
      }
    })
    if (!folder) {
      return res.sendStatus(404);
    } else {
      const [folders, files] = await Promise.all([
        prisma.folder.findMany({
          where: {
            parentFolderId: Number(req.params.folderId),
            userId: req.user.id
          }
        }),
        prisma.file.findMany({
          where: {
            folderId: Number(req.params.folderId),
            userId: req.user.id
          }
        })
      ]);
      const formattedFiles = formatFiles(files);
      const formattedFolders = formatFolders(folders);
      return res.render("drive", { list: formattedFiles.concat(formattedFolders), folderId: req.params.folderId, errors: [] });
    }
  }

  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: {
        parentFolderId: null,
        userId: req.user.id
      }
    }),
    prisma.file.findMany({
      where: {
        folderId: null,
        userId: req.user.id
      }
    })
  ]);
  const formattedFiles = formatFiles(files);
  const formattedFolders = formatFolders(folders);
  res.render("drive", { list: formattedFiles.concat(formattedFolders), folderId: null, errors: req.session.errors });
  req.session.errors = [];
};

exports.filePost = [
  upload.single("upload_file"),
  asyncHandler(async (req, res, next) => {
    const file = req.file;
    // Additional server validation of file size
    if (file.size > 2097152) {
      return res.redirect("/drive");
    }
    const uploadedFile = await uploadToCloudinary(`uploads/${file.filename}`);
    await fs.unlink(file.path);
    await prisma.file.create({
      data: {
        name: file.originalname,
        url: uploadedFile.url,
        size: file.size,
        createdAt: new Date(),
        modifiedAt: new Date(),
        folderId: req.params.folderId ? Number(req.params.folderId) : null,
        userId: req.user.id
      }
    })
    if (req.params.folderId) {
      res.redirect(`/drive/${req.params.folderId}`);
    } else {
      res.redirect("/drive");
    }
  }),
];

exports.folderPost = [
  body("name")
  .trim()
  .notEmpty()
  .withMessage("Folder name is required"),

  asyncHandler(async(req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      req.session.errors = errors.array();
      res.redirect("/drive");
    } else {
      await prisma.folder.create({
        data: {
          name: req.body.name,
          createdAt: new Date(),
          modifiedAt: new Date(),
          parentFolderId: req.params.folderId ? Number(req.params.folderId) : null,
          userId: req.user.id
        }
      })

      if (req.params.folderId) {
        res.redirect(`/drive/${req.params.folderId}`)
      } else {
        res.redirect("/drive");
      }
    }
  })
];

exports.deleteFolder = asyncHandler(async(req, res, next) => {
  const folderId = Number(req.params.folderId);

  const deletedFolder = await prisma.folder.delete({
    where: {
      id: folderId
    }
  });

  if (deletedFolder) {
    if (deletedFolder.parentFolderId) {
      return res.redirect(`/drive/${deletedFolder.parentFolderId}`);
    } else {
      return res.redirect("/drive");
    }
  } else {
    return res.redirect("/drive");
  }
})

exports.deleteFile = asyncHandler(async(req, res, next) => {
  const fileId = Number(req.params.fileId);

  const deletedFile = await prisma.file.delete({
    where: {
      id: fileId
    }
  });

  if (deletedFile) {
    const imageId = deletedFile.url.split("/").at(-1).split(".")[0];
    await removeFromCloudinary(imageId);
    if (deletedFile.folderId) {
      res.redirect(`/drive/${deletedFile.folderId}`);
    } else {
      res.redirect("/drive");
    }
  } else {
    res.redirect("/drive");
  }
})

exports.goBack = async(req, res, next) => {
  const folderId = Number(req.params.folderId);
  const folder = await prisma.folder.findUnique({
    where: {
      id: folderId
    }
  });
  if (folder.parentFolderId) {
    res.redirect(`/drive/${folder.parentFolderId}`);
  } else {
    res.redirect("/drive");
  }
}
