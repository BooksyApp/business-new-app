import { apiClient } from "@/config/api";

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

/**
 * Upload one image. The server re-encodes it as a JPEG (dropping EXIF/GPS) and scales it to
 * the purpose's size, so the picture is sent as it is.
 */
export async function uploadImage(file: File, purpose: UploadPurpose): Promise<UploadedImage> {
  if (!/^image\/(jpeg|png)$/.test(file.type)) {
    throw new Error("Choose a JPEG or PNG image.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("The image is larger than 8 MB.");
  }
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
