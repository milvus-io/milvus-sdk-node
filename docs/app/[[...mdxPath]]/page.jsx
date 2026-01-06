import { importPage } from 'nextra/pages';
import { notFound } from 'next/navigation';
import { useMDXComponents } from '../../mdx-components.jsx';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getAllMdxPaths(dir, basePath = '') {
  const paths = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const subPaths = await getAllMdxPaths(fullPath, relativePath);
      paths.push(...subPaths);
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      const pathWithoutExt = relativePath.replace(/\.mdx$/, '');
      if (pathWithoutExt === 'index') {
        paths.push([]);
      } else {
        paths.push(pathWithoutExt.split('/'));
      }
    }
  }

  return paths;
}

export async function generateStaticParams() {
  const contentDir = join(__dirname, '../../content');
  const paths = await getAllMdxPaths(contentDir);
  
  return paths.map((path) => ({
    mdxPath: path,
  }));
}

export async function generateMetadata(props) {
  const params = await props.params;
  const mdxPath = params?.mdxPath || [];
  const pathSegments = Array.isArray(mdxPath) ? mdxPath : [];

  try {
    const result = await importPage(pathSegments, '');
    if (!result || !result.metadata) {
      return {
        title: 'Milvus Node.js SDK',
        description: 'The official Milvus client for Node.js',
      };
    }

    const { metadata } = result;
    const siteName = 'Milvus Node.js SDK';
    const templateSuffix = ' | Milvus Node.js SDK';
    const maxTotalTitleLength = 60;
    const maxPageTitleLength = maxTotalTitleLength - templateSuffix.length;
    const maxDescriptionLength = 160;
    
    // Extract title from metadata (nextra extracts from first h1)
    let pageTitle = metadata.title || '';
    
    // If no title, try to generate from path
    if (!pageTitle && pathSegments.length > 0) {
      const lastSegment = pathSegments[pathSegments.length - 1];
      pageTitle = lastSegment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    
    // If still no title, use default
    if (!pageTitle) {
      pageTitle = 'Documentation';
    }

    // SEO best practices: total title should be 50-60 characters
    // Layout already has template '%s | Milvus Node.js SDK', so we only return page title
    // Truncate page title if needed to ensure total length stays within limit
    if (pageTitle.length > maxPageTitleLength) {
      pageTitle = pageTitle.substring(0, maxPageTitleLength - 3) + '...';
    }

    // Full title for OpenGraph (without template, we construct it manually)
    const fullTitle = `${pageTitle}${templateSuffix}`;

    // Extract description from metadata or use default
    let description =
      metadata.description ||
      metadata.frontMatter?.description ||
      'The official Milvus client for Node.js';
    
    // Truncate description if too long
    if (description.length > maxDescriptionLength) {
      description = description.substring(0, maxDescriptionLength - 3) + '...';
    }

    return {
      title: pageTitle,
      description,
      openGraph: {
        title: fullTitle,
        description,
        type: 'website',
        siteName: siteName,
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Milvus Node.js SDK',
      description: 'The official Milvus client for Node.js',
    };
  }
}

export default async function Page(props) {
  const params = await props.params;
  const mdxPath = params?.mdxPath || [];
  
  // Ensure mdxPath is always an array
  const pathSegments = Array.isArray(mdxPath) ? mdxPath : [];

  try {
    const result = await importPage(pathSegments, '');
    if (!result || !result.default) {
      console.error('Page not found, pathSegments:', pathSegments);
      notFound();
    }
    
    const { default: MDXContent, toc, metadata } = result;
    const Wrapper = useMDXComponents().wrapper;
    
    if (Wrapper) {
      return (
        <Wrapper toc={toc} metadata={metadata}>
          <MDXContent {...props} params={params} />
        </Wrapper>
      );
    }
    
    return <MDXContent {...props} params={params} />;
  } catch (error) {
    console.error('Error loading page:', error);
    console.error('pathSegments:', pathSegments);
    console.error('error details:', error.message);
    notFound();
  }
}
