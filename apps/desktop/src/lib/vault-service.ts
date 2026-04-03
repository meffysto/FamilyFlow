import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

export interface VaultFile {
  path: string;
  name: string;
  relative_path: string;
  is_directory: boolean;
}

export async function pickVaultFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Sélectionner le vault Obsidian',
  });
  return selected as string | null;
}

export async function listVaultFiles(vaultPath: string): Promise<VaultFile[]> {
  return invoke<VaultFile[]>('list_vault_files', { vaultPath });
}

export async function readVaultFile(path: string): Promise<string> {
  return invoke<string>('read_vault_file', { path });
}

export async function writeVaultFile(path: string, content: string): Promise<void> {
  return invoke<void>('write_vault_file', { path, content });
}

export async function deleteVaultFile(path: string): Promise<void> {
  return invoke<void>('delete_vault_file', { path });
}

/** Read an image file and return a base64 data URI */
export async function readImageBase64(path: string): Promise<string> {
  return invoke<string>('read_image_base64', { path });
}
