import type {
  ApiResponse,
  PersistClipboardImagesRequest,
  PersistClipboardImagesResponse,
} from "@shared/api";
import { PERSIST_CLIPBOARD_IMAGES } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { LocalFileService } from "../../service/local-file.service";
import { IPCBaseController } from "../ipc.base.controller";

const MAX_CLIPBOARD_IMAGE_COUNT = 10;
const MAX_CLIPBOARD_IMAGE_BYTES = 25 * 1024 * 1024;
const SUPPORTED_CLIPBOARD_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

@Injectable()
export class PersistClipboardImagesController extends IPCBaseController<
  PersistClipboardImagesRequest,
  PersistClipboardImagesResponse
> {
  constructor(private readonly localFileService: LocalFileService) {
    super();
  }

  @IPC(PERSIST_CLIPBOARD_IMAGES)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: PersistClipboardImagesRequest,
  ): Promise<ApiResponse<PersistClipboardImagesResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    return this.buildResponse({
      files: await this.localFileService.persistClipboardImages(request.images),
    });
  }

  checkParams(request: PersistClipboardImagesRequest): Error | undefined {
    if (!request || !Array.isArray(request.images) || request.images.length === 0) {
      return new Error("images must be a non-empty array");
    }
    if (request.images.length > MAX_CLIPBOARD_IMAGE_COUNT) {
      return new Error(`images must contain at most ${MAX_CLIPBOARD_IMAGE_COUNT} items`);
    }
    for (const image of request.images) {
      if (!image || typeof image.name !== "string") {
        return new Error("images must include a valid name");
      }
      if (!SUPPORTED_CLIPBOARD_IMAGE_TYPES.has(image.mimeType)) {
        return new Error("images must use a supported image MIME type");
      }
      if (!(image.data instanceof ArrayBuffer) || image.data.byteLength === 0) {
        return new Error("images must include non-empty binary data");
      }
      if (image.data.byteLength > MAX_CLIPBOARD_IMAGE_BYTES) {
        return new Error("each image must be no larger than 25 MiB");
      }
    }
    return undefined;
  }
}
