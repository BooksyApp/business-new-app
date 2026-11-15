import { apiClient } from "@/config/api";
import { t } from "@/i18n";

export type UploadPurpose =
  | "STAFF_AVATAR"
  | "BUSINESS_LOGO"
  | "BUSINESS_COVER"
  | "BUSINESS_PHOTO"
  | "CLIENT_PHOTO";

export interface UploadedImage {
  id: string;
  /** "/api/public/uploads/<id>.jpg" — store this; render it through assetUrl(). */
  url: string;
  width: number;
  height: number;
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

interface ImageRule { minW: number; minH: number; minAspect?: number; maxAspect?: number; message: string }

/** Mirrors ImageStorage.Purpose on the server, so people hear it before the upload starts. */
const RULES: Partial<Record<UploadPurpose, ImageRule>> = {
  BUSINESS_COVER: { minW: 1200, minH: 500, minAspect: 1.6, maxAspect: 3.2, get message() { return t("services.theCoverPhotoMustBe"); } },
  BUSINESS_PHOTO: { minW: 800, minH: 600, get message() { return t("services.aGalleryPhotoMustBe"); } },
  STAFF_AVATAR: { minW: 256, minH: 256, minAspect: 0.8, maxAspect: 1.25, get message() { return t("services.theProfilePhotoMustBe"); } },
  BUSINESS_LOGO: { minW: 256, minH: 256, minAspect: 0.8, maxAspect: 1.25, get message() { return t("services.theLogoMustBeAt"); } },
};

/** The requirement, to show under an upload control. */
export const UPLOAD_REQUIREMENT: Partial<Record<UploadPurpose, string>> = {
  get BUSINESS_COVER() { return t("services.requirementCover"); },
  get BUSINESS_PHOTO() { return t("services.requirementPhoto"); },
  get STAFF_AVATAR() { return t("services.requirementAvatar"); },
  get BUSINESS_LOGO() { return t("services.requirementLogo"); },
};

async function checkDimensions(file: File, purpose: UploadPurpose) {
  const rule = RULES[purpose];
  if (!rule || typeof createImageBitmap !== "function") return;
  let w: number, h: number;
  try {
    const bmp = await createImageBitmap(file);
    w = bmp.width;
    h = bmp.height;
    bmp.close();
  } catch {
    return; // let the server decide if the browser cannot decode it
  }
  const aspect = w / h;
  if (w < rule.minW || h < rule.minH || (rule.minAspect && aspect < rule.minAspect) || (rule.maxAspect && aspect > rule.maxAspect)) {
    throw new Error(t("services.thisOneIsPx", { message: rule.message, w, h }));
  }
}

/**
 * Upload one image. The server re-encodes it as a JPEG (dropping EXIF/GPS) and scales it to
 * the purpose's size, so the picture is sent as it is.
 */
export async function uploadImage(file: File, purpose: UploadPurpose): Promise<UploadedImage> {
  if (!/^image\/(jpeg|png)$/.test(file.type)) {
    throw new Error(t("services.chooseAJpegOrPng"));
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(t("services.theImageIsLargerThan"));
  }
  await checkDimensions(file, purpose);
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);
  return apiClient.upload<UploadedImage>("/uploads", form);
}

export interface BusinessPhoto {
  id: number;
  url: string;
}

export const businessPhotoService = {
  list: (businessId: number | string) => apiClient.get<BusinessPhoto[]>(`/businesses/${businessId}/photos`),
  add: (businessId: number | string, uploadId: string) =>
    apiClient.post<BusinessPhoto>(`/businesses/${businessId}/photos`, { upload: uploadId }),
  remove: (businessId: number | string, photoId: number) =>
    apiClient.delete<void>(`/businesses/${businessId}/photos/${photoId}`),
};
