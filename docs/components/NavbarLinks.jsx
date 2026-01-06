'use client';

export default function NavbarLinks() {
  return (
    <div className="navbar-custom-links">
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
