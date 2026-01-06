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
