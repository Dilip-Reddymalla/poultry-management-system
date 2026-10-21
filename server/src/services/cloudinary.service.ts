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

/**
 * Extracts a Cloudinary public_id from a full Cloudinary secure URL.
 * Example URL:
 * https://res.cloudinary.com/cloud_name/image/upload/v123456789/companies/logos/abc123xyz.jpg
 * Returns: "companies/logos/abc123xyz"
 */
export function extractPublicId(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("cloudinary.com")) return null;

  try {
    const uploadIndex = url.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    let pathAfterUpload = url.substring(uploadIndex + "/upload/".length);

    // Strip version prefix if present, e.g. "v123456789/"
    pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, "");

    // Strip file extension (.jpg, .png, etc.)
    const lastDotIndex = pathAfterUpload.lastIndexOf(".");
    if (lastDotIndex !== -1) {
      pathAfterUpload = pathAfterUpload.substring(0, lastDotIndex);
    }

    return pathAfterUpload || null;
  } catch {
    return null;
  }
}

/**
 * Deletes an image from Cloudinary given its secure URL.
 * Safe to call even if URL is not Cloudinary or null.
 */
export async function deleteImageByUrl(url: string | null | undefined): Promise<void> {
  const publicId = extractPublicId(url);
  if (publicId) {
    try {
      await deleteImage(publicId);
    } catch {
      // Best-effort cleanup, don't break request if delete fails
    }
  }
}
