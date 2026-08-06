"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { useEffect, useState, type FormEvent } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { Button, type ToastState } from "@/components/ui/crm-primitives";
import { AvatarImage, checkboxClass, FieldShell, inputClass } from "@/features/crm/controls";
import { type ScopedCrmDataUpdater } from "@/features/crm/shared-types";
import { displayDensityOptions, localeOptions, timezoneOptions } from "@/features/crm/utilities-model";
import { apiRequest, jsonBody } from "@/lib/api/client";
import { resourceApi } from "@/lib/api/resources";

export function optionsWithPersistedValue(options: string[], value: string) {
  return value && !options.includes(value) ? [value, ...options] : options;
}

export function YourAccountPage({
  data,
  onDataChange,
  onToast
}: {
  data: ScopedCrmData;
  onDataChange: ScopedCrmDataUpdater;
  onToast: (toast: ToastState) => void;
}) {
  const savedPreferences = data.userPreferences[0];
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileAlias, setProfileAlias] = useState(data.user.alias);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(String(data.user.avatarUrl ?? ""));
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState("");
  const [density, setDensity] = useState(String(savedPreferences?.displayDensity ?? "Comfy"));
  const [timezone, setTimezone] = useState(String(savedPreferences?.timezone ?? "Asia/Dubai"));
  const [locale, setLocale] = useState(String(savedPreferences?.locale ?? "en-US"));
  const [guidanceEnabled, setGuidanceEnabled] = useState(Boolean(savedPreferences?.guidanceEnabled ?? true));
  const [consoleTabsEnabled, setConsoleTabsEnabled] = useState(Boolean(savedPreferences?.consoleTabsEnabled ?? true));
  const [switchingOrganization, setSwitchingOrganization] = useState(false);

  useEffect(() => {
    setProfileAlias(data.user.alias);
    setProfileAvatarUrl(String(data.user.avatarUrl ?? ""));
  }, [data.user]);

  useEffect(() => {
    setDensity(String(savedPreferences?.displayDensity ?? "Comfy"));
    setTimezone(String(savedPreferences?.timezone ?? "Asia/Dubai"));
    setLocale(String(savedPreferences?.locale ?? "en-US"));
    setGuidanceEnabled(Boolean(savedPreferences?.guidanceEnabled ?? true));
    setConsoleTabsEnabled(Boolean(savedPreferences?.consoleTabsEnabled ?? true));
  }, [savedPreferences]);

  function cancelProfileEdit() {
    setProfileAlias(data.user.alias);
    setProfileAvatarUrl(String(data.user.avatarUrl ?? ""));
    setProfileError("");
    setProfileEditing(false);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const alias = profileAlias.trim();
    const avatarUrl = profileAvatarUrl.trim();
    if (!alias || alias.length > 8) {
      setProfileError("Alias is required and cannot exceed 8 characters.");
      return;
    }
    if (avatarUrl) {
      try {
        const parsed = new URL(avatarUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
      } catch {
        setProfileError("Avatar URL must be a valid HTTP or HTTPS URL.");
        return;
      }
    }
    setProfileSaving(true);
    setProfileError("");
    try {
      const response = await resourceApi.updateProfile({ alias, avatarUrl: avatarUrl || null });
      const user = response.user as ScopedCrmData["user"] | undefined;
      if (!user?.id) throw new Error("The updated profile was not returned.");
      onDataChange((previous) => ({
        ...previous,
        user,
        users: previous.users.map((item) => (item.id === user.id ? user : item))
      }));
      setProfileEditing(false);
      onToast({ tone: "success", message: "Profile updated." });
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Your profile could not be saved.");
    } finally {
      setProfileSaving(false);
    }
  }

  function resetPreferences() {
    setDensity(String(savedPreferences?.displayDensity ?? "Comfy"));
    setTimezone(String(savedPreferences?.timezone ?? "Asia/Dubai"));
    setLocale(String(savedPreferences?.locale ?? "en-US"));
    setGuidanceEnabled(Boolean(savedPreferences?.guidanceEnabled ?? true));
    setConsoleTabsEnabled(Boolean(savedPreferences?.consoleTabsEnabled ?? true));
    setPreferencesError("");
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreferencesSaving(true);
    setPreferencesError("");
    try {
      const response = await resourceApi.updatePreferences({
        displayDensity: density,
        timezone,
        locale,
        guidanceEnabled,
        consoleTabsEnabled
      });
      const preferences = response.preferences as RecordData | undefined;
      if (!preferences?.id) throw new Error("The updated preferences were not returned.");
      onDataChange((previous) => ({
        ...previous,
        userPreferences: [
          preferences,
          ...previous.userPreferences.filter((item) => item.id !== preferences.id && item.userId !== preferences.userId)
        ]
      }));
      onToast({ tone: "success", message: "Personal preferences updated." });
    } catch (error) {
      setPreferencesError(error instanceof Error ? error.message : "Your preferences could not be saved.");
    } finally {
      setPreferencesSaving(false);
    }
  }

  async function switchOrganization(organizationId: string) {
    if (!organizationId || organizationId === data.organization.id || switchingOrganization) return;
    setSwitchingOrganization(true);
    try {
      await apiRequest<RecordData>("/api/organizations/active", {
        method: "POST",
        body: jsonBody({ organizationId })
      });
      window.location.assign("/lightning/app/your-account");
    } catch (error) {
      setSwitchingOrganization(false);
      onToast({ tone: "error", message: error instanceof Error ? error.message : "Unable to switch organization." });
    }
  }

  const cardClass = "rounded-lg border border-[#e4e7ec] bg-white p-5 shadow-card";
  const actionLinkClass =
    "inline-flex min-h-9 items-center justify-center rounded border border-[#cfd4dc] bg-white px-3.5 py-2 text-sm font-semibold text-brand-700 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-[#b5bcc7] hover:bg-[#f8f9fb]";
  const formButtonClass =
    "inline-flex min-h-9 items-center justify-center rounded border px-3.5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
  const avatarUrl = profileEditing ? profileAvatarUrl.trim() : String(data.user.avatarUrl ?? "");

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-[#e4e7ec] bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-4">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} className="h-16 w-16 rounded-full ring-2 ring-brand-100" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-xl font-semibold text-white">
              {data.user.alias.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold">Your Account</h1>
            <p className="mt-1 text-sm text-[#706e6b]">Manage your identity, workspace, preferences, and access.</p>
          </div>
          <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
            {data.organization.name} · {data.organizationRole}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className={cardClass} aria-labelledby="account-profile-heading">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="account-profile-heading" className="text-lg font-semibold">
                Profile
              </h2>
              <p className="mt-1 text-sm text-[#706e6b]">Identity details and your CRM display information.</p>
            </div>
            {!profileEditing && (
              <Button
                onClick={() => {
                  setProfileError("");
                  setProfileEditing(true);
                }}
              >
                Edit Profile
              </Button>
            )}
          </div>
          {profileEditing ? (
            <form className="mt-4 grid gap-3" onSubmit={(event) => void saveProfile(event)}>
              <FieldShell label="Full Name">
                <input className={inputClass} value={data.user.name} readOnly />
              </FieldShell>
              <FieldShell label="Email">
                <input className={inputClass} value={data.user.email ?? "Not available"} readOnly />
              </FieldShell>
              <p className="text-xs text-[#706e6b]">Full name and email are managed by your identity administrator.</p>
              <FieldShell
                label="Alias"
                required
                error={
                  profileError && (!profileAlias.trim() || profileAlias.trim().length > 8) ? profileError : undefined
                }
              >
                <input
                  aria-label="Alias"
                  className={inputClass}
                  value={profileAlias}
                  maxLength={8}
                  onChange={(event) => setProfileAlias(event.target.value)}
                />
              </FieldShell>
              <FieldShell label="Avatar URL" error={profileError.startsWith("Avatar URL") ? profileError : undefined}>
                <input
                  aria-label="Avatar URL"
                  className={inputClass}
                  value={profileAvatarUrl}
                  onChange={(event) => setProfileAvatarUrl(event.target.value)}
                  placeholder="https://example.com/avatar.png"
                />
              </FieldShell>
              {profileError &&
                !profileError.startsWith("Avatar URL") &&
                profileAlias.trim() &&
                profileAlias.trim().length <= 8 && (
                  <div role="alert" className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">
                    {profileError}
                  </div>
                )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className={`${formButtonClass} border-[#cfd4dc] bg-white text-brand-700`}
                  disabled={profileSaving}
                  onClick={cancelProfileEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${formButtonClass} border-brand-700 bg-brand-600 text-white`}
                  disabled={profileSaving}
                >
                  {profileSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          ) : (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[#706e6b]">Full Name</dt>
                <dd className="mt-1 font-semibold">{data.user.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#706e6b]">Alias</dt>
                <dd className="mt-1 font-semibold">{data.user.alias}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-[#706e6b]">Email</dt>
                <dd className="mt-1 break-all font-semibold">{data.user.email ?? "Not available"}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className={cardClass} aria-labelledby="account-workspace-heading">
          <h2 id="account-workspace-heading" className="text-lg font-semibold">
            Workspace
          </h2>
          <p className="mt-1 text-sm text-[#706e6b]">Your active organization and access level.</p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[#706e6b]">Organization</dt>
              <dd className="mt-1 font-semibold">{data.organization.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#706e6b]">Role</dt>
              <dd className="mt-1 font-semibold">{data.organizationRole === "ADMIN" ? "Administrator" : "Member"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#706e6b]">Active Members</dt>
              <dd className="mt-1 font-semibold">{data.users.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#706e6b]">Available Workspaces</dt>
              <dd className="mt-1 font-semibold">{data.organizations.length}</dd>
            </div>
          </dl>
          {data.organizations.length > 1 && (
            <div className="mt-4 border-t border-[#eef1f6] pt-4">
              <FieldShell label="Switch Workspace">
                <select
                  aria-label="Switch Workspace"
                  className={inputClass}
                  value={data.organization.id}
                  disabled={switchingOrganization}
                  onChange={(event) => void switchOrganization(event.target.value)}
                >
                  {data.organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name} ({organization.role === "ADMIN" ? "Administrator" : "Member"})
                    </option>
                  ))}
                </select>
              </FieldShell>
              {switchingOrganization && <p className="mt-2 text-xs text-[#706e6b]">Switching workspace...</p>}
            </div>
          )}
        </section>

        <section className={cardClass} aria-labelledby="account-preferences-heading">
          <h2 id="account-preferences-heading" className="text-lg font-semibold">
            Personal Preferences
          </h2>
          <p className="mt-1 text-sm text-[#706e6b]">Control regional settings and how the CRM workspace behaves.</p>
          <form className="mt-4 grid gap-3" onSubmit={(event) => void savePreferences(event)}>
            <div className="grid gap-3 sm:grid-cols-3">
              <FieldShell label="Display Density">
                <select
                  aria-label="Display Density"
                  className={inputClass}
                  value={density}
                  onChange={(event) => setDensity(event.target.value)}
                >
                  {optionsWithPersistedValue(displayDensityOptions, density).map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </FieldShell>
              <FieldShell label="Timezone">
                <select
                  aria-label="Timezone"
                  className={inputClass}
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                >
                  {optionsWithPersistedValue(timezoneOptions, timezone).map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </FieldShell>
              <FieldShell label="Locale">
                <select
                  aria-label="Locale"
                  className={inputClass}
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                >
                  {optionsWithPersistedValue(localeOptions, locale).map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </FieldShell>
            </div>
            <label className="flex items-center justify-between gap-3 rounded border border-[#d8dde6] p-3 text-sm">
              <span>
                <span className="block font-semibold">Guidance cards</span>
                <span className="text-xs text-[#706e6b]">Show contextual help and onboarding guidance.</span>
              </span>
              <input
                aria-label="Guidance cards"
                type="checkbox"
                checked={guidanceEnabled}
                onChange={(event) => setGuidanceEnabled(event.target.checked)}
                className={checkboxClass}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded border border-[#d8dde6] p-3 text-sm">
              <span>
                <span className="block font-semibold">Console tabs</span>
                <span className="text-xs text-[#706e6b]">
                  Keep recently opened records available above the workspace.
                </span>
              </span>
              <input
                aria-label="Console tabs"
                type="checkbox"
                checked={consoleTabsEnabled}
                onChange={(event) => setConsoleTabsEnabled(event.target.checked)}
                className={checkboxClass}
              />
            </label>
            {preferencesError && (
              <div role="alert" className="rounded border border-[#ea001e] bg-[#fff1f1] p-2 text-sm text-[#8e030f]">
                {preferencesError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className={`${formButtonClass} border-[#cfd4dc] bg-white text-brand-700`}
                disabled={preferencesSaving}
                onClick={resetPreferences}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`${formButtonClass} border-brand-700 bg-brand-600 text-white`}
                disabled={preferencesSaving}
              >
                {preferencesSaving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </form>
        </section>

        <section className={cardClass} aria-labelledby="account-security-heading">
          <h2 id="account-security-heading" className="text-lg font-semibold">
            Security and Access
          </h2>
          <p className="mt-1 text-sm text-[#706e6b]">Review sessions and open the tools available for your role.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link className={actionLinkClass} href="/account/sessions">
              Manage Sessions
            </Link>
            {data.organizationRole === "ADMIN" && (
              <Link className={actionLinkClass} href="/lightning/setup/users">
                Manage Users
              </Link>
            )}
            {data.isSuperAdmin && (
              <Link className={actionLinkClass} href="/super-admin">
                Super Admin
              </Link>
            )}
            <SignOutButton
              formClassName="contents"
              className={`${actionLinkClass} border-[#ea001e] text-[#ba0517] hover:bg-[#fff1f1]`}
            >
              Sign Out
            </SignOutButton>
          </div>
          <p className="mt-4 border-t border-[#eef1f6] pt-4 text-xs text-[#706e6b]">
            Use Manage Sessions to review browsers and revoke access without signing out of this session.
          </p>
        </section>
      </div>
    </section>
  );
}
