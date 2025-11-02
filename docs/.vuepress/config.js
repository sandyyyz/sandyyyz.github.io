const head = require('./config/head.js');
const themeConfig = require('./config/themeConfig.js');

const plugins = [
  ...require('./config/plugins.js'),
  [
    "vuepress-plugin-vssue-global",
    {
      platform: "github",
      title: "[Comment]<%- frontmatter.title %>",
      needComments: true,
      autoCreateIssue: true,
      clientId: "Ov23liGQDVSA9fvCIqRm",
      clientSecret: "e79eaa54d211ab06e2f7bc260507eb153af0ff8f",
      owner: "sandyyyz",          // ✅ 改成你自己的用户名
      repo: "sandyyyz-notes",     // ✅ 改成你的博客仓库名
    },
  ],
];

module.exports = {
  theme: 'vdoing',
  title: "sandyyyz-notes",
  description: 'vdoing博客主题模板',
  base: '/', // ✅ 或者 '/'，取决于仓库名
  markdown: {
    lineNumbers: true,
  },
  head,
  plugins,
  themeConfig,
};
