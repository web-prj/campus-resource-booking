import Link from "next/link";
import { ArrowUpRightIcon } from "./icons";
import { BrandMark } from "./brand-mark";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <BrandMark />
        <nav className="site-nav" aria-label="Explore this page">
          <a href="#resources">Resources</a>
          <a href="#workflow">How it works</a>
          <a href="#roles">For campus teams</a>
        </nav>
        <Link className="header-login" href="/login">
          <span>Sign in</span>
          <ArrowUpRightIcon width={18} height={18} />
        </Link>
      </div>
    </header>
  );
}
