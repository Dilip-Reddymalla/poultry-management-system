import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { env } from "../config/env.js";

// Configure Cloudinary SDK from environment variables.
// All three credentials are optional in development; the service simply throws
// if an upload is attempted without them being set.
if (
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

/**
 * Upload an image buffer to Cloudinary.
 *
 * @param buffer  - Raw image bytes (JPEG / PNG / WEBP).
 * @param folder  - Cloudinary folder path, e.g. `"workers/profiles"`.
 * @returns       - Secure URL and Cloudinary public_id.
 */
export async function uploadImage(
  buffer: Buffer,
  folder: string,
): Promise<CloudinaryUploadResult> {
  if (!env.CLOUDINARY_CLOUD_NAME) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env",
    );
  }

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 512, height: 512, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result?: UploadApiResponse) => {
        if (error) {
          return reject(error);
        }

        if (!result) {
          return reject(new Error("Cloudinary upload returned no result"));
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    stream.end(buffer);
  });
}

/**
 * Delete an image from Cloudinary by its public_id.
 */
export async function deleteImage(publicId: string): Promise<void> {
  if (!env.CLOUDINARY_CLOUD_NAME) {
    return; // silently skip if not configured
  }

  await cloudinary.uploader.destroy(publicId);
}
