import { google } from "googleapis";
import { getAuthenticatedClient, type AccountAlias } from "./accounts";

async function getTagManager(alias: AccountAlias) {
  return google.tagmanager({ version: "v2", auth: await getAuthenticatedClient(alias) });
}

export async function listAccounts(alias: AccountAlias) {
  const tm = await getTagManager(alias);
  const res = await tm.accounts.list();
  return res.data.account ?? [];
}

export async function listContainers(alias: AccountAlias, accountId: string) {
  const tm = await getTagManager(alias);
  const res = await tm.accounts.containers.list({ parent: `accounts/${accountId}` });
  return res.data.container ?? [];
}

export async function listWorkspaces(alias: AccountAlias, accountId: string, containerId: string) {
  const tm = await getTagManager(alias);
  const res = await tm.accounts.containers.workspaces.list({
    parent: `accounts/${accountId}/containers/${containerId}`,
  });
  return res.data.workspace ?? [];
}

export async function listTags(alias: AccountAlias, accountId: string, containerId: string, workspaceId: string) {
  const tm = await getTagManager(alias);
  const res = await tm.accounts.containers.workspaces.tags.list({
    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
  });
  return res.data.tag ?? [];
}

export async function listTriggers(alias: AccountAlias, accountId: string, containerId: string, workspaceId: string) {
  const tm = await getTagManager(alias);
  const res = await tm.accounts.containers.workspaces.triggers.list({
    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
  });
  return res.data.trigger ?? [];
}

export async function listVariables(alias: AccountAlias, accountId: string, containerId: string, workspaceId: string) {
  const tm = await getTagManager(alias);
  const res = await tm.accounts.containers.workspaces.variables.list({
    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
  });
  return res.data.variable ?? [];
}
