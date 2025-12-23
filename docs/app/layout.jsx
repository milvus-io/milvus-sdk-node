import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head, Search } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import themeConfig from '../theme.config.jsx';
import CodeBlockEnhancer from '../components/CodeBlockEnhancer.jsx';
import 'nextra-theme-docs/style.css';
import '../styles/custom.css';

export const metadata = {
  title: {
    default: 'Milvus Node.js SDK',
    template: '%s | Milvus Node.js SDK',
  },
  description: 'The official Milvus client for Node.js',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Milvus Node.js SDK',
  },
};

export default async function RootLayout({ children }) {
  let pageMap = [];
  try {
    pageMap = await getPageMap();
    if (!Array.isArray(pageMap)) {
      pageMap = [];
    }
  } catch (error) {
    console.error('Error fetching page map:', error);
    pageMap = [];
  }

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Layout
          navbar={
            <Navbar
              logo={themeConfig.logo}
              projectLink={themeConfig.project?.link}
            />
          }
          pageMap={pageMap}
          docsRepositoryBase={themeConfig.docsRepositoryBase}
          editLink="Edit this page on GitHub"
          footer={<Footer>{themeConfig.footer?.text}</Footer>}
          search={
            <Search placeholder={themeConfig.search?.placeholder} />
          }
        >
          {children}
          <CodeBlockEnhancer />
        </Layout>
      </body>
    </html>
  );
}
