import { google } from "googleapis";
import { getAuthenticatedClient, type AccountAlias } from "./accounts";

async function getPeople(alias: AccountAlias) {
  return google.people({
    version: "v1",
    auth: await getAuthenticatedClient(alias),
  });
}

export async function searchContacts(
  alias: AccountAlias,
  query: string,
  maxResults = 20
) {
  const people = await getPeople(alias);
  const res = await people.people.searchContacts({
    query,
    pageSize: maxResults,
    readMask: "names,emailAddresses,phoneNumbers,organizations",
  });

  return (res.data.results ?? []).map((r) => {
    const person = r.person;
    return {
      resourceName: person?.resourceName,
      name: person?.names?.[0]?.displayName,
      emails: person?.emailAddresses?.map((e) => e.value) ?? [],
      phones: person?.phoneNumbers?.map((p) => p.value) ?? [],
      organization: person?.organizations?.[0]?.name,
      title: person?.organizations?.[0]?.title,
    };
  });
}

export async function listContacts(
  alias: AccountAlias,
  pageSize = 100,
  pageToken?: string
) {
  const people = await getPeople(alias);
  const res = await people.people.connections.list({
    resourceName: "people/me",
    pageSize,
    pageToken,
    personFields: "names,emailAddresses,phoneNumbers,organizations",
  });

  return {
    contacts: (res.data.connections ?? []).map((person) => ({
      resourceName: person.resourceName,
      name: person.names?.[0]?.displayName,
      emails: person.emailAddresses?.map((e) => e.value) ?? [],
      phones: person.phoneNumbers?.map((p) => p.value) ?? [],
      organization: person.organizations?.[0]?.name,
      title: person.organizations?.[0]?.title,
    })),
    nextPageToken: res.data.nextPageToken,
    totalPeople: res.data.totalPeople,
  };
}
