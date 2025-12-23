export default {
  logo: <span>Milvus Node.js SDK</span>,
  project: {
    link: 'https://github.com/milvus-io/milvus-sdk-node',
  },
  docsRepositoryBase: 'https://github.com/milvus-io/milvus-sdk-node/tree/main/docs',
  footer: {
    text: `MIT ${new Date().getFullYear()} © Milvus Node.js SDK.`,
  },
  search: {
    placeholder: 'Search documentation...',
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – Milvus Node.js SDK',
    };
  },
};

