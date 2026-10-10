"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  active: (pathname: string) => boolean;
};

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = item.active(pathname);

  return <Link
    className={`cc-primary-link${active ? " active" : ""}`}
    href={item.href}
    aria-current={active ? "page" : undefined}
  >
    <span className="cc-primary-dot" aria-hidden="true" />
    <span className="cc-primary-label">{item.label}</span>
    {item.shortLabel && <span className="cc-primary-short">{item.shortLabel}</span>}
  </Link>;
}

export function CcNavClient({
  admin,
  publicGuest,
  labAccess,
  identityLabel,
}: {
  admin: boolean;
  publicGuest: boolean;
  labAccess: boolean;
  identityLabel?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems: NavItem[] = [
    {
      href: publicGuest ? "/" : "/creative-circle",
      label: publicGuest ? "Website" : "Home",
      shortLabel: publicGuest ? "Site" : "Home",
      active: (value) => value === "/creative-circle",
    },
    ...(labAccess ? [{
      href: "/creative-circle/lab",
      label: "Video Lab",
      shortLabel: "Video",
      active: (value: string) => value.startsWith("/creative-circle/lab") || value.startsWith("/creative-circle/project"),
    }] : []),
    ...(!publicGuest ? [{
      href: "/creative-circle/teleprompter",
      label: "Teleprompter",
      shortLabel: "Prompt",
      active: (value: string) => value.startsWith("/creative-circle/teleprompter"),
    }] : []),
    ...(labAccess ? [{
      href: "/creative-circle/variations",
      label: "Variation Studio",
      shortLabel: "Variations",
      active: (value: string) => value.startsWith("/creative-circle/variations"),
    }] : []),
    {
      href: "/creative-circle/review",
      label: "Feedback Lab",
      shortLabel: "Feedback",
      active: (value: string) => value.startsWith("/creative-circle/review"),
    },
    ...(admin ? [{
      href: "/creative-circle/admin/ugc-brands",
      label: "UGC Radar",
      shortLabel: "Radar",
      active: (value: string) => value.startsWith("/creative-circle/admin/ugc-brands"),
    }] : []),
  ];

  const initials = identityLabel
    ? identityLabel.replace(/^@/, "").split(/[^a-z0-9]+/i).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TT"
    : "CC";

  async function signOut() {
    await authClient.signOut();
    router.push("/creative-circle/login");
    router.refresh();
  }

  return <header className="cc-topbar">
    <div className="cc-topbar-inner">
      <Link className="cc-modern-brand" href={publicGuest ? "/creative-circle/review" : "/creative-circle"}>
        <span className="cc-modern-mark" aria-hidden="true">
          <i />
          <b>CC</b>
        </span>
        <span className="cc-modern-brand-copy">
          <strong>Creative Circle</strong>
          <small>Creator workspace</small>
        </span>
      </Link>

      <nav className="cc-primary-nav" aria-label="Creative Circle">
        {navItems.map((item) => <NavLink key={item.href} item={item} />)}
      </nav>

      <div className="cc-topbar-actions">
        {admin && <details className="cc-nav-menu">
          <summary className={pathname.startsWith("/creative-circle/admin") && !pathname.startsWith("/creative-circle/admin/ugc-brands") ? "active" : ""}>
            <span className="cc-menu-icon" aria-hidden="true">⌘</span>
            <span>Admin</span>
            <span className="cc-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="cc-nav-popover cc-admin-popover">
            <span className="cc-popover-eyebrow">Manage</span>
            <Link href="/creative-circle/admin">
              <span><b>Site Admin</b><small>Homepage, media, and publishing</small></span>
              <i>↗</i>
            </Link>
            <Link href="/creative-circle/admin/access">
              <span><b>Access</b><small>Members and permissions</small></span>
              <i>↗</i>
            </Link>
          </div>
        </details>}

        {!publicGuest && <details className="cc-nav-menu cc-profile-menu">
          <summary aria-label="Account menu">
            <span className="cc-avatar">{initials}</span>
            <span className="cc-profile-copy">
              <strong>{identityLabel || "Account"}</strong>
              <small>{admin ? "Owner" : "Member"}</small>
            </span>
            <span className="cc-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="cc-nav-popover cc-profile-popover">
            <div className="cc-profile-panel">
              <span className="cc-avatar large">{initials}</span>
              <div>
                <strong>{identityLabel || "Creative Circle"}</strong>
                <small>{admin ? "Owner access" : "Member access"}</small>
              </div>
            </div>
            <Link href="/">
              <span><b>Thibault Solutions</b><small>Return to public portfolio</small></span>
              <i>↗</i>
            </Link>
            <button type="button" onClick={() => void signOut()}>
              <span><b>Log out</b><small>End this session</small></span>
              <i>→</i>
            </button>
          </div>
        </details>}

        {publicGuest && <Link className="cc-site-link" href="/">THIBAULT SOLUTIONS <span>↗</span></Link>}
      </div>
    </div>
  </header>;
}
