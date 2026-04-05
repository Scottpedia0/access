import { google } from "googleapis";
import { getAuthenticatedClient, getAccountEmail, type AccountAlias } from "./accounts";

export async function getProfile(alias: AccountAlias) {
  const auth = await getAuthenticatedClient(alias);
  const oauth2 = google.oauth2({ version: "v2", auth });
  const res = await oauth2.userinfo.get();
  return {
    alias,
    configuredEmail: getAccountEmail(alias),
    actualEmail: res.data.email,
    name: res.data.name,
    picture: res.data.picture,
    verified: res.data.verified_email,
    match: res.data.email === getAccountEmail(alias),
  };
}

export async function getAllProfiles(aliases: AccountAlias[]) {
  return Promise.all(aliases.map(async (alias) => {
    try {
      return await getProfile(alias);
    } catch (err) {
      return { alias, error: String(err) };
    }
  }));
}
