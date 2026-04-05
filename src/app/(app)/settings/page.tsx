import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { consumerKindOptions, visibilityModeOptions } from "@/lib/options";
import {
  getAppOrigin,
  getGlobalAgentToken,
  getSharedIntakeToken,
  getSharedIntakeUrl,
  hasGlobalAgentToken,
  hasEmailMagicLink,
  hasGoogleAuth,
  hasSharedIntakeToken,
  ownerEmails,
} from "@/lib/env";
import { prisma } from "@/lib/prisma";

const githubRepoUrl = process.env.GITHUB_REPO_URL ?? "";
const localRepoPath = "";
const localAgentEnvPath = process.env.AGENT_ENV_PATH ?? "";

function buildAgentExportBlock(input: {
  appOrigin: string;
  globalAgentToken: string | null;
  sharedIntakeUrl: string | null;
  sharedIntakeToken: string | null;
}) {
  return [
    `export ACCESS_MORAN_BOT_URL="${input.appOrigin}/api/v1/bootstrap"`,
    `export ACCESS_MORAN_BOT_TOKEN="${input.globalAgentToken ?? ""}"`,
    `export ACCESS_MORAN_BOT_ADD_URL="${input.sharedIntakeUrl ?? ""}"`,
    `export ACCESS_MORAN_BOT_ADD_API_URL="${input.appOrigin}/api/v1/intake"`,
    `export ACCESS_MORAN_BOT_ADD_TOKEN="${input.sharedIntakeToken ?? ""}"`,
  ].join("\n");
}

function getDatabaseHost() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return "Not configured";
  }

  try {
    return new URL(databaseUrl).host;
  } catch {
    return "Configured";
  }
}

export default async function SettingsPage() {
  const [serviceCount, secretCount, consumerCount] = await Promise.all([
    prisma.service.count(),
    prisma.secret.count(),
    prisma.consumer.count(),
  ]);

  const tokenSecretConfigured = Boolean(
    process.env.CONSUMER_TOKEN_HASH_SECRET ?? process.env.NEXTAUTH_SECRET,
  );
  const appOrigin = getAppOrigin();
  const sharedIntakeUrl = getSharedIntakeUrl();
  const sharedIntakeToken = getSharedIntakeToken();
  const globalAgentToken = getGlobalAgentToken();
  const agentExportBlock = buildAgentExportBlock({
    appOrigin,
    globalAgentToken,
    sharedIntakeUrl,
    sharedIntakeToken,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Runtime posture"
        description="A quick view of the Access Vault environment, auth posture, and the moving parts that matter in production."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { label: "Services", value: serviceCount.toString() },
          { label: "Secrets", value: secretCount.toString() },
          { label: "Consumers", value: consumerCount.toString() },
        ].map((item) => (
          <div
            key={item.label}
            className="app-stat-card rounded-[24px] p-5"
          >
            <p className="app-kicker text-xs font-semibold uppercase tracking-[0.2em]">
              {item.label}
            </p>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)]">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Authentication" eyebrow="Owner-only">
          <div className="space-y-4 text-sm text-[color:var(--text-body)]">
            <p>Allowed owner emails: {ownerEmails.length ? ownerEmails.join(", ") : "None configured"}</p>
            <p>Google OAuth: {hasGoogleAuth ? "Configured" : "Not configured"}</p>
            <p>Magic-link email: {hasEmailMagicLink ? "Configured" : "Not configured"}</p>
          </div>
        </SectionCard>

        <SectionCard title="Storage and crypto" eyebrow="Backend posture">
          <div className="space-y-4 text-sm text-[color:var(--text-body)]">
            <p>Database host: {getDatabaseHost()}</p>
            <p>Consumer token HMAC secret: {tokenSecretConfigured ? "Configured" : "Missing"}</p>
            <p>Service visibility modes: {visibilityModeOptions.length}</p>
            <p>Consumer kinds supported: {consumerKindOptions.length}</p>
          </div>
        </SectionCard>

        <SectionCard title="How this works" eyebrow="Operator notes">
          <div className="space-y-4 text-sm text-[color:var(--text-body)]">
            <p>Scott logs in, adds services, and pastes one or more keys under each service.</p>
            <p>Secret values are encrypted on the server before they ever hit the database.</p>
            <p>Trusted local bots and tools use one universal token against `/api/v1/bootstrap` to pull the vault in one shot.</p>
            <p>The white `/add` page is the async key-drop link for people who should paste a service and key without getting a dashboard login.</p>
            <div className="app-panel-subtle rounded-[18px] px-4 py-3">
              <p className="app-kicker text-xs font-semibold uppercase tracking-[0.18em]">
                Private GitHub repo
              </p>
              <p className="mt-3 break-all text-sm text-[color:var(--text-body)]">
                <a
                  href={githubRepoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="app-link-strong font-medium"
                >
                  {githubRepoUrl}
                </a>
              </p>
              <p className="app-text-muted mt-3 break-all font-mono text-xs">
                Local path: {localRepoPath}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Agent bootstrap" eyebrow="One pull">
          <div className="space-y-4 text-sm text-[color:var(--text-body)]">
            <p>Bundle endpoint: {appOrigin}/api/v1/bootstrap</p>
            <p>
              {hasGlobalAgentToken
                ? "A single universal token can fetch the whole vault in one pull for Moe, Curly, Larry, Shemp, and future local tools."
                : "Bearer tokens can fetch every service, note, doc, resource, and key they are allowed to use in one call."}
            </p>
            <p>
              Add `?services=openai,hubspot` if you want to limit the response to a few services.
            </p>
            <p>Use `ACCESS_MORAN_BOT_TOKEN` for the bearer token and `ACCESS_MORAN_BOT_URL` for the endpoint.</p>
            {globalAgentToken ? (
              <div className="app-panel-subtle rounded-[18px] px-4 py-3">
                <p className="app-kicker text-xs font-semibold uppercase tracking-[0.18em]">
                  Universal bot token
                </p>
                <p className="mt-3 break-all font-mono text-xs text-[color:var(--foreground)]">
                  {globalAgentToken}
                </p>
              </div>
            ) : null}
            <div className="app-panel-subtle rounded-[18px] px-4 py-3">
              <p className="app-kicker text-xs font-semibold uppercase tracking-[0.18em]">
                Agent handoff
              </p>
              <p className="mt-3 text-sm text-[color:var(--text-body)]">
                Same machine:
                <span className="app-code-chip ml-2 rounded-md px-2 py-1 font-mono text-xs">
                  source {localAgentEnvPath}
                </span>
              </p>
              <p className="mt-3 text-sm text-[color:var(--text-body)]">
                Anywhere else, paste this:
              </p>
              <pre className="app-code-block mt-3 overflow-x-auto px-4 py-3 font-mono text-xs leading-6">
                <code>{agentExportBlock}</code>
              </pre>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Shared key drop" eyebrow="Async intake">
          <div className="space-y-4 text-sm text-[color:var(--text-body)]">
            {hasSharedIntakeToken && sharedIntakeUrl ? (
              <>
                <p>Use this when you want someone else to paste a service name and key without getting a dashboard login.</p>
                <p className="app-text-muted break-all font-mono text-xs">
                  {sharedIntakeUrl}
                </p>
                <p>Add `&service=OpenAI` to prefill the service field for them.</p>
                <p>Local handoff env name: `ACCESS_MORAN_BOT_ADD_URL`.</p>
                <div className="app-panel-subtle rounded-[18px] px-4 py-3">
                  <p className="app-kicker text-xs font-semibold uppercase tracking-[0.18em]">
                    Remote agent add API
                  </p>
                  <p className="mt-3 break-all font-mono text-xs text-[color:var(--foreground)]">
                    {appOrigin}/api/v1/intake
                  </p>
                  {sharedIntakeToken ? (
                    <p className="app-text-muted mt-3 break-all font-mono text-xs">
                      Intake token: {sharedIntakeToken}
                    </p>
                  ) : null}
                  <p className="mt-3">
                    Remote agents can POST `serviceName`, `secretValue`, and optional `envVarName`,
                    `label`, `description`, or `notes` with the intake token. This gives them write-only
                    intake access, not vault read access.
                  </p>
                  <p>Local handoff env names: `ACCESS_MORAN_BOT_ADD_API_URL`, `ACCESS_MORAN_BOT_ADD_TOKEN`.</p>
                </div>
              </>
            ) : (
              <p>Set `SHARED_INTAKE_TOKEN` to turn on the plain `/add` key-drop page.</p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
