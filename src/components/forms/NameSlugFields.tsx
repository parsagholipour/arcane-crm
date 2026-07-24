"use client";

import { useState } from "react";
import { slugify } from "@/lib/utils";

type NameSlugFieldsProps = {
  className?: string;
  nameClassName?: string;
  slugClassName?: string;
  nameDefault?: string;
  slugDefault?: string;
  namePlaceholder?: string;
  slugPlaceholder?: string;
  nameInputName?: string;
  slugInputName?: string;
  required?: boolean;
  slugPattern?: string;
};

/**
 * Paired name + slug inputs. Slug tracks the name until the user edits the slug
 * (or when editing an existing record that already has a slug).
 */
export function NameSlugFields({
  className,
  nameClassName,
  slugClassName,
  nameDefault = "",
  slugDefault = "",
  namePlaceholder = "Name",
  slugPlaceholder = "url-slug",
  nameInputName = "name",
  slugInputName = "slug",
  required = true,
  slugPattern = "[a-z0-9]+(?:-[a-z0-9]+)*"
}: NameSlugFieldsProps) {
  const [name, setName] = useState(nameDefault);
  const [slug, setSlug] = useState(slugDefault);
  const [slugManual, setSlugManual] = useState(Boolean(slugDefault));

  return (
    <div className={className}>
      <input
        className={nameClassName}
        name={nameInputName}
        value={name}
        placeholder={namePlaceholder}
        required={required}
        onChange={(event) => {
          const nextName = event.target.value;
          setName(nextName);
          if (!slugManual) setSlug(slugify(nextName));
        }}
      />
      <input
        className={slugClassName}
        name={slugInputName}
        value={slug}
        placeholder={slugPlaceholder}
        pattern={slugPattern}
        required={required}
        onChange={(event) => {
          setSlugManual(true);
          setSlug(slugify(event.target.value));
        }}
      />
    </div>
  );
}
