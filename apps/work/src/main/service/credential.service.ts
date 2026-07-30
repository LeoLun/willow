import type { CredentialStore, Credential } from "@earendil-works/pi-ai";
import { Injectable } from "@willow/poetry";
import { ElectronCredentialStore } from "../utils/credential-store";
import { CredentialDao } from "./dao/credential.dao.server";

/**
 * 凭证服务
 */
@Injectable()
export class CredentialService {
  private readonly credentialStore: ElectronCredentialStore;

  constructor(private readonly credentialDao: CredentialDao) {
    this.credentialStore = new ElectronCredentialStore(credentialDao);
  }

  getCredentialStore(): CredentialStore {
    return this.credentialStore;
  }

  setCredential(providerId: string, credential: Credential) {
    return this.credentialStore.set(providerId, credential);
  }

  getCredential(providerId: string) {
    return this.credentialStore.read(providerId);
  }

  getConfiguredProviderIds(): string[] {
    return this.credentialDao.findProviderIds();
  }

  deleteCredential(providerId: string) {
    return this.credentialStore.delete(providerId);
  }
}
