import type { BackgroundImageState } from "./types";
import { validateImageFileMetadata } from "./utils";

function validateDecodedImage(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("无法读取图片尺寸，请确认文件未损坏。 ");
  }
}

async function loadWithImageElement(file: File): Promise<BackgroundImageState> {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  try {
    await image.decode();
    validateDecodedImage(image.naturalWidth, image.naturalHeight);
    return {
      fileName: file.name,
      width: image.naturalWidth,
      height: image.naturalHeight,
      image,
      objectUrl,
    };
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error("无法读取该图片。请确认文件未损坏，并且格式受浏览器支持。 ");
  }
}

export async function loadBackgroundImage(file: File): Promise<BackgroundImageState> {
  const metadataError = validateImageFileMetadata(file);
  if (metadataError) throw new Error(metadataError);

  if (typeof createImageBitmap === "function") {
    try {
      const image = await createImageBitmap(file, { imageOrientation: "from-image" });
      validateDecodedImage(image.width, image.height);
      return {
        fileName: file.name,
        width: image.width,
        height: image.height,
        image,
      };
    } catch {
      // Safari versions without full ImageBitmap format support use this path.
    }
  }

  return loadWithImageElement(file);
}

export function releaseBackgroundImage(state?: BackgroundImageState): void {
  if (!state) return;
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  if (typeof ImageBitmap !== "undefined" && state.image instanceof ImageBitmap) {
    state.image.close();
  }
}
