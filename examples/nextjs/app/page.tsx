/**
 * This option is equivalent to getServerSideProps() in the pages directory.
 * https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
 */
export const dynamic = 'force-dynamic';

const HOST = 'http://localhost:3000';

async function getData() {
  return fetch(HOST + '/api/milvus').then(res => res.json());
}

export default async function Home() {
  const data = await getData();

  return <>{JSON.stringify(data)}</>;
}
