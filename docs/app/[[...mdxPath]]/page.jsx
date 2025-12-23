import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { notFound } from 'next/navigation';
import { useMDXComponents } from '../../mdx-components.jsx';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

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
