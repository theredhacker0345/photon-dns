import { Link, type LinkProps } from "expo-router";
import type { PropsWithChildren } from "react";

/**
 * Lightweight external link wrapper. The control plane does not require the
 * native in-app browser module; Expo Router delegates external navigation to
 * the platform when the link is opened.
 */
export function ExternalLink({
  href,
  children,
}: PropsWithChildren<Pick<LinkProps, "href">>) {
  return (
    <Link href={href} target="_blank">
      {children}
    </Link>
  );
}
