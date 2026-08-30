import multer from "multer";

// In-memory storage — files live as Buffer on req.file.buffer.
// Max 10 MB per upload, restricted to image MIME types.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WEBP images are allowed"));
    }
  },
});

/** Multer middleware that accepts a single image file under field name `photo`. */
export const uploadPhoto = upload.single("photo");

/** Multer middleware that accepts a single image file under field name `image`. */
export const uploadImage = upload.single("image");
