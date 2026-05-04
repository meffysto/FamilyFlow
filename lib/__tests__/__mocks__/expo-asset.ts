/**
 * Mock expo-asset pour les tests Jest (environnement Node).
 * Renvoie un Asset stub avec localUri prévisible — les tests qui consomment
 * réellement un base64 doivent mocker `loadFontsBase64` / `loadIllustrationBase64`
 * directement plutôt que de s'appuyer sur ce stub.
 */

export class Asset {
  localUri: string | null;
  uri: string;

  constructor(opts: { localUri?: string | null; uri?: string } = {}) {
    this.localUri = opts.localUri ?? null;
    this.uri = opts.uri ?? '';
  }

  static fromModule(_mod: unknown): Asset {
    return new Asset({ localUri: '/mock/asset.bin', uri: '/mock/asset.bin' });
  }

  async downloadAsync(): Promise<Asset> {
    if (!this.localUri) this.localUri = '/mock/asset.bin';
    return this;
  }
}
