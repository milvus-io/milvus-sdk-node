'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavbarLinks() {
  const pathname = usePathname();
  const isApiReference = pathname?.includes('/api-reference');

  return (
    <div className="navbar-custom-links">
      <Link
        aria-current={isApiReference ? 'page' : undefined}
        className="navbar-doc-link"
        href="/api-reference"
      >
        API Reference
      </Link>
      <span className="navbar-divider" aria-hidden="true" />
      <a
        href="https://cloud.zilliz.com/signup?utm_page=nodejs-sdk&utm_button=nav_right"
        target="_blank"
        rel="noopener noreferrer"
      >
        Zilliz Cloud
      </a>
      <a href="https://milvus.io" target="_blank" rel="noopener noreferrer">
        Milvus
      </a>
      <a
        href="https://github.com/zilliztech/attu/releases"
        target="_blank"
        rel="noopener noreferrer"
      >
        Attu
      </a>
    </div>
  );
}
