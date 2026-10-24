import React, { useEffect, useState } from "react";

const NAV_ITEMS = [
  { label: "Status", href: "#section-status" },
  { label: "Agent", href: "#section-agent" },
  { label: "Owner", href: "#section-owner" },
  { label: "Attack Lab", href: "#section-attack" },
  { label: "Feed", href: "#section-feed" },
];

export const StickyNav: React.FC = () => {
  const [active, setActive] = useState<string>("#section-status");

  useEffect(() => {
    const sectionIds = NAV_ITEMS.map((n) => n.href.slice(1));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(`#${entry.target.id}`);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(href);
    }
  };

  return (
    <nav className="sticky-nav" aria-label="In-page navigation">
      <div className="sticky-nav-inner">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`sticky-nav-link ${active === item.href ? "active" : ""}`}
            onClick={(e) => handleNav(e, item.href)}
          >
            {item.label}
            <span className="nav-underline" />
          </a>
        ))}
      </div>
    </nav>
  );
};
