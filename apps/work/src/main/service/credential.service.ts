import type { CredentialStore } from "@earendil-works/pi-ai";
import { Injectable } from "@willow/poetry";
import { ElectronCredentialStore } from "../auth/credential-store";
import { CredentialDao } from "./dao/credential.dao.server";

/**
 * 凭证服务
 */
@Injectable()
export class CredentialService {
  private readonly credentialStore: CredentialStore;

  constructor(credentialDao: CredentialDao) {
    this.credentialStore = new ElectronCredentialStore(credentialDao);
  }

  getCredentialStore(): CredentialStore {
    return this.credentialStore;
  }
}
