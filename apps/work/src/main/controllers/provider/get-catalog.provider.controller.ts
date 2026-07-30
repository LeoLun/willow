import { ProviderCatalogService } from "@main/service/provider-catalog.service";
import type {
  ApiResponse,
  GetProviderCatalogRequest,
  GetProviderCatalogResponse,
} from "@shared/api";
import { GET_PROVIDER_CATALOG } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetProviderCatalogController extends IPCBaseController<
  GetProviderCatalogRequest,
  GetProviderCatalogResponse
> {
  constructor(private readonly providerCatalog: ProviderCatalogService) {
    super();
  }

  @IPC(GET_PROVIDER_CATALOG)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    _request: GetProviderCatalogRequest,
  ): Promise<ApiResponse<GetProviderCatalogResponse>> {
    return this.buildResponse({ providers: this.providerCatalog.getCatalog() });
  }

  checkParams(_request: GetProviderCatalogRequest): Error | undefined {
    return undefined;
  }
}
