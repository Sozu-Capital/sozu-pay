import { PRODUCT_IMAGE_DATA_URL_MAX_LENGTH } from "@/lib/dashboard/product-image";

const MAX_EDGE = 720;

/** Fit a chosen file inside a 720px box and return a JPEG data URL. */
export function fileToProductImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("PRODUCT_IMAGE_CANVAS"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      let quality = 0.82;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);
      while (dataUrl.length > PRODUCT_IMAGE_DATA_URL_MAX_LENGTH && quality > 0.5) {
        quality -= 0.12;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("INVALID_PRODUCT_IMAGE"));
    };
    img.src = url;
  });
}
