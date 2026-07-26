"use client";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { Button } from "@/components/ui/crm-primitives";
import { AvatarImage, checkboxClass, FieldShell, inputClass, NativeSelect } from "@/features/crm/controls";
import { displayDensityOptions, localeOptions, timezoneOptions } from "@/features/crm/utilities-model";
import { type HeaderUtilityContentProps } from "@/features/crm/header-utility-content";

export function ProfileUtilityContent({ model, utilityProps }: HeaderUtilityContentProps) {
  const {
    density,
    setDensity,
    guidanceEnabled,
    setGuidanceEnabled,
    consoleTabsEnabled,
    setConsoleTabsEnabled,
    timezone,
    setTimezone,
    locale,
    setLocale,
    profileName,
    setProfileName,
    profileAlias,
    setProfileAlias,
    profileAvatarUrl,
    setProfileAvatarUrl,
    profileEditing,
    setProfileEditing,
    savePreferences,
    saveProfile,
    switchOrganization
  } = model;
  const { data, onNavigate } = utilityProps;

  return (
    <div className="p-3">
      <div className="flex items-center gap-3 rounded border border-[#d8dde6] bg-[#f8f8f8] p-3">
        {data.user.avatarUrl ? (
          <AvatarImage src={String(data.user.avatarUrl)} className="h-14 w-14 rounded-full ring-2 ring-white" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white">
            {data.user.alias.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate font-semibold">{data.user.name}</div>
          <div className="text-xs text-[#706e6b]">{data.user.alias}</div>
          <div className="mt-1 text-xs text-[#706e6b]">
            {locale} - {timezone} - {density}
          </div>
        </div>
      </div>
      {profileEditing ? (
        <div className="mt-3 grid gap-3">
          <FieldShell label="Full Name">
            <input className={inputClass} value={profileName} readOnly />
          </FieldShell>
          <p className="text-xs text-[#706e6b]">A super administrator manages the Keycloak display name and email.</p>
          <FieldShell label="Alias">
            <input
              className={inputClass}
              value={profileAlias}
              maxLength={8}
              onChange={(event) => setProfileAlias(event.target.value)}
            />
          </FieldShell>
          <FieldShell label="Avatar URL">
            <input
              className={inputClass}
              value={profileAvatarUrl}
              onChange={(event) => setProfileAvatarUrl(event.target.value)}
              placeholder="https://..."
            />
          </FieldShell>
          {profileAvatarUrl && (
            <div className="flex items-center gap-2 rounded border border-[#d8dde6] p-2 text-sm">
              <AvatarImage src={profileAvatarUrl} className="h-9 w-9 rounded-full" />
              <span className="text-[#706e6b]">Avatar preview</span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setProfileName(data.user.name);
                setProfileAlias(data.user.alias);
                setProfileAvatarUrl(String(data.user.avatarUrl ?? ""));
                setProfileEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void saveProfile()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-2">
          <div className="rounded border border-[#d8dde6] p-2">
            <div className="mb-2 text-xs font-semibold uppercase text-[#706e6b]">Organization</div>
            <div className="mb-2 text-sm font-semibold">
              {data.organization.name} <span className="font-normal text-[#706e6b]">· {data.organizationRole}</span>
            </div>
            {data.organizations.length > 1 && (
              <select
                className={inputClass}
                value={data.organization.id}
                onChange={(event) => void switchOrganization(event.target.value)}
              >
                {data.organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name} ({organization.role})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setProfileEditing(true)}>Edit Profile</Button>
            <Button onClick={() => onNavigate("/lightning/app/your-account")}>View Account</Button>
          </div>
          <div className="rounded border border-[#d8dde6] p-2">
            <div className="mb-2 text-xs font-semibold uppercase text-[#706e6b]">Personal Settings</div>
            <div className="grid gap-2">
              <FieldShell label="Display Density">
                <NativeSelect
                  options={displayDensityOptions}
                  value={density}
                  onChange={(value) => {
                    setDensity(value);
                    void savePreferences({ displayDensity: value });
                  }}
                />
              </FieldShell>
              <FieldShell label="Timezone">
                <NativeSelect
                  options={timezoneOptions}
                  value={timezone}
                  onChange={(value) => {
                    setTimezone(value);
                    void savePreferences({ timezone: value });
                  }}
                />
              </FieldShell>
              <FieldShell label="Locale">
                <NativeSelect
                  options={localeOptions}
                  value={locale}
                  onChange={(value) => {
                    setLocale(value);
                    void savePreferences({ locale: value });
                  }}
                />
              </FieldShell>
              <label className="flex items-center justify-between rounded border border-[#d8dde6] p-2 text-sm">
                Guidance cards
                <input
                  type="checkbox"
                  checked={guidanceEnabled}
                  onChange={(event) => {
                    setGuidanceEnabled(event.target.checked);
                    void savePreferences({ guidanceEnabled: event.target.checked });
                  }}
                  className={checkboxClass}
                />
              </label>
              <label className="flex items-center justify-between rounded border border-[#d8dde6] p-2 text-sm">
                Console tabs
                <input
                  type="checkbox"
                  checked={consoleTabsEnabled}
                  onChange={(event) => {
                    setConsoleTabsEnabled(event.target.checked);
                    void savePreferences({ consoleTabsEnabled: event.target.checked });
                  }}
                  className={checkboxClass}
                />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => onNavigate("/account/sessions")}>Manage Sessions</Button>
            {data.organizationRole === "ADMIN" && (
              <Button onClick={() => onNavigate("/lightning/setup/users")}>Manage Users</Button>
            )}
            {data.isSuperAdmin && <Button onClick={() => onNavigate("/super-admin")}>Super Admin</Button>}
            <SignOutButton
              formClassName="contents"
              className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-[#cfd4dc] bg-white px-3.5 py-1 text-xs font-semibold text-brand-700 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-[#b5bcc7] hover:bg-[#f8f9fb] active:scale-[0.97]"
            >
              Sign Out
            </SignOutButton>
          </div>
        </div>
      )}
    </div>
  );
}
