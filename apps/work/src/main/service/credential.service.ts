import type { CredentialStore, Credential } from "@earendil-works/pi-ai";
import { Injectable } from "@willow/poetry";
import { ElectronCredentialStore } from "../auth/credential-store";
import { CredentialDao } from "./dao/credential.dao.server";

/**
 * 凭证服务
 */
@Injectable()
export class CredentialService {
  private readonly credentialStore: CredentialStore;

  constructor(private readonly credentialDao: CredentialDao) {
    this.credentialStore = new ElectronCredentialStore(credentialDao);
  }

  getCredentialStore(): CredentialStore {
    return this.credentialStore;
  }

  setCredential(providerId: string, credential: Credential) {
    return this.credentialStore.modify(providerId, (_current: Credential | undefined) => {
      return Promise.resolve(credential);
    });
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
